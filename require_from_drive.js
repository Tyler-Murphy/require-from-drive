const request = require('sync-request')
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
  requireFromDrive
}

function requireFromDrive ({
  path,
  cache = true,
  cacheInFile = true,
}) {
  let responseFromFileCache

  debugLog(path, 'starting load process')

  if (cacheInFile) {
    responseFromFileCache = loadFromCacheFile(path)
    debugLog(path, 'retrieved from file cache', responseFromFileCache)
  }

  const response = responseFromFileCache || (cache ? requestWithCache(path) : requestWithoutCache(path))

  if (cacheInFile && !responseFromFileCache) {
    debugLog(path, 'caching response in file')
    fs.writeFileSync(getCacheFileName(path), response)
  }

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
      debugLog(fileName, `cache file is too old... ignoring it`)

      return null
    }
  } catch(error) {
    if (!error.message.includes('ENOENT')) {
      throw error
    }

    debugLog(fileName, 'no cache file exists')

    return null  // the file doesn't exist
  }

  debugLog(fileName, `reading cache file`)

  return fs.readFileSync(fileName, 'utf-8')
}

function getCacheFileName(path) {
  return fileCachePrefix + encodeURIComponent(path)
}

function requestWithCache (path) {
  if (!requestCache.has(path)) {
    debugLog(path, 'using in-memory cache')

    requestCache.set(path, requestWithoutCache(path))
  }

  return requestCache.get(path)
}

function requestWithoutCache (path) {
  debugLog(path, 'retrieving from Drive')

  const startTime = Date.now()
  let response = request('GET', address, {
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
