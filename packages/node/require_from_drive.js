import requireFromString from 'require-from-string'
import * as fs from 'node:fs/promises'

const addressVariableName = 'REQUIRE_FROM_DRIVE_SERVER_ADDRESS'
const tokenVariableName = 'REQUIRE_FROM_DRIVE_SERVER_TOKEN'
const address = process.env[addressVariableName]
const token = process.env[tokenVariableName]
/** @type {Map<string, string>} */
const requestCache = new Map()
const fileCachePrefix = '.require-from-drive'
const maximumFileCacheAgeMilliseconds = 3600e3

/**
 * @type {typeof console.log}
 */
const debugLog = (...messages) => {
  if (process.env.DEBUG === 'true') {
    console.log('[require-from-drive debug]:', ...messages)
  }
}

if (!address) {
  throw new Error(`Set the ${addressVariableName} environment variable`)
}

if (!token) {
  throw new Error(`Set the ${tokenVariableName} environment variable`)
}

export {
  requireFromDrive
}

/**
 * @typedef {{
 *   path: string,
 *   cache?: boolean,
 *   cacheInFile?: boolean,
 * }} Options
 */

/**
 * @typedef {{ [key: string]: any }} Result
 */

/**
 * @param {Options} options
 * @returns {Promise<Result>}
 */
async function requireFromDrive ({
  path,
  cache = true,
  cacheInFile = true
}) {
  let responseFromMemoryCache
  let responseFromFileCache

  debugLog(path, 'starting load process')

  if (cache) {
    responseFromMemoryCache = requestCache.get(path)
    debugLog(path, 'retrieved from memory cache', responseFromMemoryCache)
  }

  if (cacheInFile && !responseFromMemoryCache) {
    responseFromFileCache = await loadFromCacheFile(path)
    debugLog(path, 'retrieved from file cache', responseFromFileCache)
  }

  const response = responseFromMemoryCache || responseFromFileCache || await getFromDrive(path)

  if (cacheInFile && !responseFromFileCache) {
    debugLog(path, 'caching response in file in background')
    fs.writeFile(getCacheFileName(path), response)
      .catch(error => debugLog('Failed to save response in file:', String(error)))
  }

  if (cache && !responseFromMemoryCache) {
    debugLog(path, 'caching response in memory')
    requestCache.set(path, response)
  }

  try {
    debugLog(path, 'attempting to parse as JSON')

    return JSON.parse(response)
  } catch (error) {
    debugLog(path, 'failed to parse as JSON... falling back to parsing as a module')

    try {
      return requireFromString(response, path)
    } catch (error) {
      throw new Error(`Failed to parse Drive path "${path}" as JSON or as module. Here's the raw response: ${response}`)
    }
  }
}

/**
 * @param {Options['path']} path
 * @returns {Promise<string | null>}
 */
async function loadFromCacheFile (path) {
  const fileName = getCacheFileName(path)

  try {
    const { mtime: lastModifiedTime } = await fs.stat(fileName)
    const ageMilliseconds = Date.now() - lastModifiedTime.getTime()

    debugLog(fileName, `found cache file with age ${ageMilliseconds} milliseconds`)

    if (Date.now() - lastModifiedTime.getTime() > maximumFileCacheAgeMilliseconds) {
      debugLog(fileName, 'cache file is too old... ignoring it')

      return null
    }
  } catch (error) {
    if (!error.message.includes('ENOENT')) {
      throw error
    }

    debugLog(fileName, 'no cache file exists')

    return null // the file doesn't exist
  }

  debugLog(fileName, 'reading cache file')

  return fs.readFile(fileName, 'utf-8')
}

/**
 * @param {Options['path']} path
 * @returns {string}
 */
function getCacheFileName (path) {
  return fileCachePrefix + encodeURIComponent(path)
}

/**
 * @param {Options['path']} path
 * @returns {Promise<string>}
 */
async function getFromDrive (path) {
  debugLog(path, 'retrieving from Drive')

  const startTime = Date.now()
  const response = await fetch(`${assertDefined(address)}?path=${encodeURIComponent(path)}&token=${encodeURIComponent(assertDefined(token))}`)
  const responseText = await response.text()

  if (response.status !== 200) {
    throw new Error(`${response.status} - ${response.statusText} - Failed to retrieve from Drive: ${responseText}`)
  }

  debugLog(path, `retrieved from Drive in ${Date.now() - startTime} milliseconds`)

  if (/^Error: /.test(responseText)) {
    throw new Error(responseText)
  }

  return responseText
}

/** @type {<T>(thing: T) => NonNullable<T>} */
function assertDefined (thing) {
  if (thing == null) {
    throw new Error('Not defined')
  }

  return thing
}
