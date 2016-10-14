const request = require('sync-request')
const requireFromString = require('require-from-string')
const path = require('path')

const address = process.env.REQUIRE_FROM_DRIVE_SERVER_ADDRESS
const token = process.env.REQUIRE_FROM_DRIVE_SERVER_TOKEN
const requestCache = new Map()

module.exports = {
  requireFromDrive
}

function requireFromDrive (filePath) {
  let response = requestWithCache(filePath)

  try {
    return JSON.parse(response)
  } catch (error) {
    return requireFromString(response, filePath)
  }
}

function requestWithCache (filePath) {
  if (requestCache.has(filePath)) {
    return requestCache.get(filePath)
  }

  let splitPath = filePath.split(path.posix.sep)
  let response = request('GET', address, {
    qs: {
      splitPath: JSON.stringify(splitPath),
      token
    },
    cache: 'file'
  }).getBody('utf-8')

  requestCache.set(filePath, response)
  return response
}
