const request = require('sync-request')
const requireFromString = require('require-from-string')

const addressVariableName = 'REQUIRE_FROM_DRIVE_SERVER_ADDRESS'
const tokenVariableName = 'REQUIRE_FROM_DRIVE_SERVER_TOKEN'
const address = process.env[addressVariableName]
const token = process.env[tokenVariableName]
const requestCache = new Map()

if (!address) {
  throw new Error(`Set the ${addressVariableName} environment variable`)
}

if (!token) {
  throw new Error(`Set the ${tokenVariableName} environment variable`)
}

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
