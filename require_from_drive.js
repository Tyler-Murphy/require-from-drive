const request = require('sync-request')
const requireFromString = require('require-from-string')

const address = process.env.REQUIRE_FROM_DRIVE_SERVER_ADDRESS
const token = process.env.REQUIRE_FROM_DRIVE_SERVER_TOKEN
const requestCache = new Map()

module.exports = {
  requireFromDrive
}

function requireFromDrive (path) {
  let response = requestWithCache(path)

  try {
    return JSON.parse(response)
  } catch (error) {
    return requireFromString(response, path)
  }
}

function requestWithCache (path) {
  if (requestCache.has(path)) {
    return requestCache.get(path)
  }

  let response = request('GET', address, {
    qs: {
      path,
      token
    }
  }).getBody('utf-8')

  if (/^Error: /.test(response)) {
    throw new Error(response)
  }

  requestCache.set(path, response)
  return response
}
