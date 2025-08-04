import * as fs from 'node:fs/promises'
import packageJson from '../../package.json' with { type: 'json' }
import { exec as execCallback } from 'node:child_process'
import { promisify } from 'node:util'
import nodePath from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { assertIsResponse, type JSONValue, type RequestQueryParameters } from './schemas.js'
import { getInput } from './terminal.js'

export {
  requireFromDrive,
  fileCachePrefix,
}

const thisModuleDir = nodePath.dirname(fileURLToPath(import.meta.url))
const version = packageJson.version
const addressVariableName = 'REQUIRE_FROM_DRIVE_SERVER_ADDRESS'
const tokenVariableName = 'REQUIRE_FROM_DRIVE_SERVER_TOKEN'
const requestCache = new Map<string, string>()
const fileCachePrefix = '.require-from-drive'
const maximumFileCacheAgeMilliseconds = 3600e3
const debugLog = (message: string): void => {
  if (process.env.DEBUG === 'true') {
    console.log('[require-from-drive debug]:', message)
  }
}

async function requireFromDrive ({
  path,
  cache = true,
  cacheInFile = true,
  token,
}: {
  path: string,
  cache?: boolean | undefined,
  cacheInFile?: boolean | undefined,
  token?: string | undefined,
}): Promise<JSONValue> {
  const address = process.env[addressVariableName]
  token ??= process.env[tokenVariableName]

  if (!address) {
    throw new Error(`Set the ${addressVariableName} environment variable`)
  }

  if (!token) {
    token = await getToken()

    if (!token) {
      throw new Error('Run \'npx require-from-drive generate-secret\' to set up an access token')
    }
  }

  let responseFromMemoryCache
  let responseFromFileCache

  debugLog(`${path} starting load process`)

  if (cache) {
    responseFromMemoryCache = requestCache.get(path)
    debugLog(`${path} retrieved from memory cache ${responseFromMemoryCache ?? `undefined`}`)
  }

  if (cacheInFile && !responseFromMemoryCache) {
    responseFromFileCache = await loadFromCacheFile(token, path)
    debugLog(`${path} retrieved from file cache ${responseFromFileCache ?? `null`}`)
  }

  const response = responseFromMemoryCache ?? responseFromFileCache ?? await getFromDrive({
    address,
    path,
    token,
    totp: null,
  })

  if (cacheInFile && !responseFromFileCache) {
    debugLog(`${path} caching response in file in background`)
    fs.writeFile(getCacheFileName(path), JSON.stringify(encryptContent(token, response)))
    .catch((error: unknown) => { debugLog(`Failed to save response in file: ${String(error)}`); })
  }

  if (cache && !responseFromMemoryCache) {
    debugLog(`${path} caching response in memory`)
    requestCache.set(path, response)
  }

  try {
    debugLog(`${path} attempting to parse as JSON`)

    return JSON.parse(response)
  } catch (error: unknown) {
    throw new Error(`Failed to parse Drive path "${path}". Here's the raw response: ${response}`, {
      cause: error,
    })
  }
}

let pendingToken: Promise<string> | null = null

async function getToken(): Promise<string> {
  pendingToken ??= promisify(execCallback)(`${nodePath.join(thisModuleDir, 'vendor', 'keymaster', 'require-from-drive')} get require-from-drive`)
  .then(process => process.stdout.trim())
  .finally(() => pendingToken = null)

  return pendingToken
}

async function loadFromCacheFile (token: string, path: string): Promise<string | null> {
  const fileName = getCacheFileName(path)

  try {
    const { mtime: lastModifiedTime } = await fs.stat(fileName)
    const ageMilliseconds = Date.now() - lastModifiedTime.getTime()

    debugLog(`${fileName} found cache file with age ${ageMilliseconds.toString()} milliseconds`)

    if (Date.now() - lastModifiedTime.getTime() > maximumFileCacheAgeMilliseconds) {
      debugLog(`${fileName} cache file is too old... ignoring it`)

      return null
    }
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('ENOENT')) {
      throw error
    }

    debugLog(`${fileName} no cache file exists`)

    return null // the file doesn't exist
  }

  debugLog(`${fileName} reading cache file`)

  return decryptContent(token, assertIsEncryptedContent(JSON.parse(await fs.readFile(fileName, 'utf-8'))))
}

function getCacheFileName (path: string): string {
  return fileCachePrefix + encodeURIComponent(path)
}

async function getFromDrive ({ address, path, totp, token }: RequestQueryParameters & { address: string }): Promise<string> {
  debugLog(`${path} retrieving from Drive${totp == null ? '' : ' with TOTP'}`)

  const startTime = Date.now()
  const httpResponse = await fetch(`${address}?path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}${totp == null ? '' : `&totp=${encodeURIComponent(totp)}`}`)

  if (httpResponse.status !== 200) {
    throw new Error(`${httpResponse.status.toString()} - ${httpResponse.statusText} - Failed to retrieve from Drive: ${await httpResponse.text()}`)
  }

  const response = assertIsResponse(await httpResponse.json() as JSONValue)

  debugLog(`${path} response from Drive in ${(Date.now() - startTime).toString()} milliseconds`)

  if (response.version !== version) {
    throw new Error(`require-from-drive is using version ${version} locally but the server is using version ${response.version}`)
  }

  if (response.status === 'error') {
    if (response.message === 'missing totp query parameter') {
      const totpFromUser = await getInput(`Enter your 6-digit TOTP:`, {
        validate: {
          condition: (raw: string) => /^\d{6}$/.test(raw) ? true : `TOTP must be 6 digits with no other characters`,
          maximumTries: 3,
        }
      })

      return getFromDrive({
        address,
        path,
        token,
        totp: totpFromUser,
      })
    }

    throw new Error(response.message)
  }

  return response.content
}

/** For encrypting if a file cache is used */
const encryptionAlgorithm = 'aes-256-cbc'
const encryptionKeyLengthBytes = 32
const encryptionInitializationVectorLengthBytes = encryptionKeyLengthBytes / 2
const encryptionKeyStringEncoding = 'hex'
interface EncryptedContent {
  initializationVector: string,
  encryptedData: string,
}

function encryptContent (token: string, content: string): EncryptedContent {
  const initializationVector = crypto.randomBytes(encryptionInitializationVectorLengthBytes)

  debugLog('encrypting')

  const cipher = crypto.createCipheriv(
    encryptionAlgorithm,
    getEncryptionKey(token),
    initializationVector
  )

  let encryptedData = cipher.update(content, 'utf8', encryptionKeyStringEncoding)
  encryptedData += cipher.final(encryptionKeyStringEncoding)

  return {
    initializationVector: initializationVector.toString(encryptionKeyStringEncoding),
    encryptedData,
  }
}

function decryptContent (token: string, encryptedContent: EncryptedContent): string {
  debugLog('decrypting')

  const decipher = crypto.createDecipheriv(
    encryptionAlgorithm,
    getEncryptionKey(token),
    Buffer.from(encryptedContent.initializationVector, 'hex')
  )

  let decryptedContent = decipher.update(encryptedContent.encryptedData, encryptionKeyStringEncoding, 'utf8')
  decryptedContent += decipher.final('utf8')

  return decryptedContent
}

function assertIsEncryptedContent(value: JSONValue): EncryptedContent {
  if (typeof value !== `object` || value == null || Array.isArray(value)) {
    throw new Error(`Got non-object`)
  }

  if (!(
    `initializationVector` in value
    &&
    typeof value.initializationVector === `string`
    &&
    `encryptedData` in value
    &&
    typeof value.encryptedData === `string`
  )) {
    throw new Error(`Object has wrong shape`)
  }

  return {
    initializationVector: value.initializationVector,
    encryptedData: value.encryptedData,
  }
}

/**
 * Use the token to generate a 32-byte encryption key because the token has more than 32 bytes of randomness
 */
const getEncryptionKey = (token: string): Buffer => {
  debugLog('generating encryption key from token')

  const key = crypto.createHash('sha256').update(token).digest()

  if (key.length !== encryptionKeyLengthBytes) {
    throw new Error(`Encryption key generated from token should be ${encryptionKeyLengthBytes.toString()} long but is ${key.length.toString()} bytes long.`)
  }

  return key
}
