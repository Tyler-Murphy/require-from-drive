const request = require('sync-request')
const fetch = require('node-fetch')
const requireFromString = require('require-from-string')
const fs = require('fs')

const addressVariableName = 'REQUIRE_FROM_DRIVE_SERVER_ADDRESS'
const tokenVariableName = 'REQUIRE_FROM_DRIVE_SERVER_TOKEN'
const address = process.env[addressVariableName]
const token = process.env[tokenVariableName]
const requestCache = new Map()
const fileCachePrefix = '.require-from-drive'
const maximumFileCacheAgeMilliseconds = 3600e3
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

module.exports = {
  requireFromDrive,
  requireFromDriveAsynchronously
}

function requireFromDrive ({
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
    responseFromFileCache = loadFromCacheFile(path)
    debugLog(path, 'retrieved from file cache', responseFromFileCache)
  }

  const response = responseFromMemoryCache || responseFromFileCache || getFromDrive(path)

  if (cacheInFile && !responseFromFileCache) {
    debugLog(path, 'caching response in file')
    fs.writeFileSync(getCacheFileName(path), response)
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

    return requireFromString(response, path)
  }
}

/** Caching is not supported for asynchronous requires */
async function requireFromDriveAsynchronously ({ path }) {
  debugLog(path, 'starting asynchronous load')

  const response = await getFromDriveAsynchronously(path)

  try {
    debugLog(path, 'attempting to parse as JSON')

    return JSON.parse(response)
  } catch (error) {
    debugLog(path, 'failed to parse as JSON... falling back to parsing as a module')

    return requireFromString(response, path)
  }
}

function loadFromCacheFile (path) {
  const fileName = getCacheFileName(path)

  try {
    const { mtime: lastModifiedTime } = fs.statSync(fileName)
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

  return fs.readFileSync(fileName, 'utf-8')
}

function getCacheFileName (path) {
  return fileCachePrefix + encodeURIComponent(path)
}

function getFromDrive (path) {
  debugLog(path, 'retrieving from Drive')

  const startTime = Date.now()
  const response = request('GET', address, {
    qs: {
      path,
      token
    }
  }).getBody('utf-8')

  debugLog(path, `retrieved from Drive in ${Date.now() - startTime} milliseconds`)

  if (/^Error: /.test(response)) {
    throw new Error(response)
  }

  return response
}

async function getFromDriveAsynchronously (path) {
  debugLog(path, 'retrieving from Drive asynchronously')

  const startTime = Date.now()
  const response = await (await fetch(`${address}?path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}`)).text()

  debugLog(path, `retrieved from Drive asynchronously in ${Date.now() - startTime} milliseconds`)

  if (/^Error: /.test(response)) {
    throw new Error(response)
  }

  return response
}
