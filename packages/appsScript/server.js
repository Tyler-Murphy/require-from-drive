/* global DocumentApp, ContentService, Logger, Utilities, DriveApp, SpreadsheetApp */

const version = '4.0.3'
const thisFolderId = 'your ID here'
const spreadsheetLoggingUrl = 'your spreadsheet URL here'

/**
 * If a `totpSecret` is null, TOTP-based MFA won't be required. If the secret is not null, then in addition to providing a valid token, the requester must provide a valid TOTP (e.g. from an authenticator app on their phone)
 *
 * @type {import('../node/schemas.ts').ServerTokenConfiguration}
 */
const tokens = {
  token: {
    description: 'device or user name',
    totpSecret: null,
  }
}

/**
 * @param {GoogleAppsScript.Events.DoGet} request
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doGet (request) {
  const startTime = Date.now()
  const token = request.parameter.token
  const path = request.parameter.path

  if (token == null) {
    return errorResponse('missing token query parameter')
  }

  if (!(token in tokens)) {
    return errorResponse('invalid token query parameter')
  }

  if (!path) {
    return errorResponse('missing path query parameter')
  }

  const totpSecret = assertIsNotNullish(tokens[token]).totpSecret

  if (totpSecret != null) {
    // TOTP is required
    const totp = request.parameter.totp

    if (totp == null) {
      return errorResponse('missing totp query parameter')
    }

    if (!isValidTotp(totpSecret, totp)) {
      return errorResponse('invalid totp query parameter')
    }
  }

  const splitPath = path.split('/')
  const directories = splitPath.slice(0, -1)
  const fileName = assertIsNotNullish(splitPath.slice(-1)[0])

  let currentDirectory = DriveApp.getFolderById(thisFolderId)
  /** @type {string} */
  let directoryName

  while (directories.length) {
    directoryName = assertIsNotNullish(directories.shift())

    try {
      currentDirectory = currentDirectory.getFoldersByName(directoryName).next()
    } catch {
      return errorResponse(`could not find folder ${directoryName}`)
    }
  }

  /** @type {GoogleAppsScript.Drive.File} */
  let file

  try {
    file = currentDirectory.getFilesByName(fileName).next()
  } catch {
    return errorResponse('could not find file')
  }

  /** @type {string} */
  let fileText

  try {
    fileText = DocumentApp.openById(file.getId()).getBody().getText()
  } catch {
    return errorResponse('found file but could not read')
  }

  log(`Success: Token ${assertIsNotNullish(tokens[token]).description} used to retrieve path "${path}" in ${(Date.now() - startTime).toString()} milliseconds`)

  return response({
    version,
    status: 'success',
    content: fileText
  })
}

/**
 * @param {import('../node/schemas.ts').ResponseError['message']} message
 */
function errorResponse (message) {
  log(`Error: ${message}`)

  return response({
    version,
    status: 'error',
    message,
  })
}

/**
 * @param {import('../node/schemas.ts').Response} data
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function response (data) {
  return ContentService
    .createTextOutput(JSON.stringify(data, null, '  '))
    .setMimeType(ContentService.MimeType.TEXT)
}

/**
 * @param {string} string
 */
function log (string) {
  const messageWithTimestamp = (new Date()).toISOString() + ' ' + string

  Logger.log(messageWithTimestamp)

  if (spreadsheetLoggingUrl.length > 0) {
    SpreadsheetApp.openByUrl(spreadsheetLoggingUrl).appendRow([messageWithTimestamp])
  }
}

/**
 * @template T
 * @param {T} thing
 * @return {NonNullable<T>}
 */
function assertIsNotNullish (thing) {
  if (thing == null) {
    throw new Error('Expected value not to be nullish')
  }

  return thing
}

/**
 * @template T
 * @param {T} thing
 * @return {Exclude<T, undefined>}
 */
function assertIsNotUndefined (thing) {
  if (thing === undefined) {
    throw new Error('Expected value not to be undefined')
  }

  // @ts-expect-error these types don't work for some reason - not sure
  return thing
}

// TOTP code

/**
 * Verifies a Time-based One-Time Password (TOTP).
 *
 * @param {string} secret The base32 encoded secret key.
 * @param {string} code The TOTP code to verify.
 * @return {boolean} True if the code is valid, false otherwise.
 */
function isValidTotp (secret, code) {
  try {
    // Check the current time step, the previous one, and the next one to account for slight time drifts between the server and the client.
    const timeStepOffsets = /** @type {const} */ ([-1, 0, 1])

    for (const offset of timeStepOffsets) {
      const generatedCode = generateTOTP(secret, offset)
      if (generatedCode === code) {
        return true
      }
    }

    return false
  } catch (e) {
    Logger.log('Error verifying TOTP: ' + String(e))
    return false
  }
}

/**
 * Generates a TOTP for a given secret and time step offset. Uses a time step of 30 seconds which is the default almost everywhere.
 *
 * @param {string} secret The base32 encoded secret key.
 * @param {-1 | 0 | 1} offset The time step offset.
 * @return {string} The generated TOTP code.
 * @private
 */
function generateTOTP (secret, offset = 0) {
  const timeStep = 30
  const epoch = Math.floor(Date.now() / 1000)
  const time = Math.floor(epoch / timeStep) + offset

  // Convert the time to a byte array.
  const timeBytes = intToBytes(time)

  // Decode the base32 secret.
  const secretBytes = base32Decode(secret)

  // Calculate the HMAC-SHA1 hash.
  const hmac = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_1,
    timeBytes,
    secretBytes
  )

  // Get the last nibble of the hash, which is the offset.
  const offsetValue = assertIsNotNullish(hmac[hmac.length - 1]) & 0x0f

  // Get the 4-byte dynamic binary code from the hash.
  const dbc1 = (assertIsNotNullish(hmac[offsetValue]) & 0x7f) << 24
  const dbc2 = (assertIsNotNullish(hmac[offsetValue + 1]) & 0xff) << 16
  const dbc3 = (assertIsNotNullish(hmac[offsetValue + 2]) & 0xff) << 8
  const dbc4 = assertIsNotNullish(hmac[offsetValue + 3]) & 0xff

  const dynamicBinaryCode = dbc1 | dbc2 | dbc3 | dbc4

  // Get the 6-digit code.
  let totp = (dynamicBinaryCode % 1000000).toString()

  // Pad with leading zeros if necessary.
  while (totp.length < 6) {
    totp = '0' + totp
  }

  return totp
}

/**
 * Decodes a base32 string.
 *
 * @param {string} encoded The base32 encoded string.
 * @return {Array<number>} The decoded byte array.
 * @private
 */
function base32Decode(encoded) {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = encoded
    .toUpperCase()
    .split('')
    .map((char) => {
      const index = base32Chars.indexOf(char);
      if (index === -1) {
        throw new Error('Invalid base32 character: ' + char);
      }
      return index.toString(2).padStart(5, '0');
    })
    .join('');

  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    // Replaced substr with slice
    const chunk = bits.slice(i, i + 8);
    if (chunk.length === 8) {
      bytes.push(parseInt(chunk, 2));
    }
  }
  return bytes;
}

/**
 * Converts an integer to a byte array.
 *
 * @param {number} num The integer to convert.
 * @return {Array<number>} The resulting byte array.
 * @private
 */
function intToBytes (num) {
  const bytes = []
  for (let i = 7; i >= 0; --i) {
    bytes[i] = num & 255
    num = num >> 8
  }
  return bytes
}

// Tests

// @ts-expect-error because this is only used for testing in the web-based Apps Script IDE
function test () {
  const tests = []
  const validToken = 'valid'
  const invalidToken = Math.random().toString()
  const thisFolder = DriveApp.getFolderById(thisFolderId)

  tokens[validToken] = {
    description: 'description',
    totpSecret: null,
  }

  tests.push(function missingTokenCausesError () {
    assertDeepStrictEqual(
      // @ts-expect-error because `token` is being left out intentionally
      testGetResponse({
        path: 'path',
        totp: null,
      }),
      {
        version,
        status: 'error',
        message: 'missing token query parameter',
      }
    )
  })

  tests.push(function invalidTokenCausesError () {
    assertDeepStrictEqual(
      testGetResponse({
        token: invalidToken,
        path: 'path',
        totp: null,
      }),
      {
        version,
        status: 'error',
        message: 'invalid token query parameter',
      }
    )
  })

  tests.push(function missingPathCausesError () {
    assertDeepStrictEqual(
      // @ts-expect-error because `path` is being left out intentionally
      testGetResponse({
        token: validToken,
        totp: null,
      }),
      {
        version,
        status: 'error',
        message: 'missing path query parameter'
      }
    )
  })

  tests.push(function missingTotpCausesError () {
    const totpSecret = 'JBSWY3DPEHPK3PXP'

    assertIsNotNullish(tokens[validToken]).totpSecret = totpSecret

    assertDeepStrictEqual(
      testGetResponse({
        token: validToken,
        path: 'path',
        totp: null,
      }),
      {
        version,
        status: 'error',
        message: 'missing totp query parameter',
      }
    )

    assertIsNotNullish(tokens[validToken]).totpSecret = null
  })

  tests.push(function invalidTotpCausesError () {
    const totpSecret = 'JBSWY3DPEHPK3PXP'

    assertIsNotNullish(tokens[validToken]).totpSecret = totpSecret

    assertDeepStrictEqual(
      testGetResponse({
        token: validToken,
        path: 'path',
        totp: 'invalid',
      }),
      {
        version,
        status: 'error',
        message: 'invalid totp query parameter',
      }
    )

    assertIsNotNullish(tokens[validToken]).totpSecret = null
  })

  tests.push(function fileOfWrongTypeCausesError () {
    const path = 'secrets server invalid format test file'
    const file = thisFolder.createFile(path, 'content')

    assertDeepStrictEqual(
      testGetResponse({
        token: validToken,
        path,
        totp: null,
      }),
      {
        version,
        status: 'error',
        message: 'found file but could not read'
      }
    )

    file.setTrashed(true)
  })

  tests.push(function missingFileCausesError () {
    assertDeepStrictEqual(
      testGetResponse({
        token: validToken,
        path: 'not a real file',
        totp: null,
      }),
      {
        version,
        status: 'error',
        message: 'could not find file'
      }
    )
  })

  tests.push(function missingDirectoryCausesError () {
    const nonExistentDir = 'missingDir'

    assertDeepStrictEqual(
      testGetResponse({
        token: validToken,
        path: `${nonExistentDir}/someFile`,
        totp: null,
      }),
      {
        version,
        status: 'error',
        message: `could not find folder ${nonExistentDir}`,
      }
    )
  })

  tests.push(function rootFileOfCorrectTypeIsRetrieved () {
    const path = 'secrets server valid format test file'
    const document = DocumentApp.create(path)
    const file = DriveApp.getFileById(document.getId())
    const documentContent = Math.random().toString()

    document.getBody().setText(documentContent)
    thisFolder.addFile(file)

    assertDeepStrictEqual(
      testGetResponse({
        token: validToken,
        path,
        totp: null,
      }),
      {
        version,
        status: 'success',
        content: documentContent,
      }
    )

    file.setTrashed(true)
  })

  tests.push(function rootFileOfCorrectTypeIsRetrievedWithTotp () {
    const totpSecret = 'JBSWY3DPEHPK3PXP'
    const path = 'secrets server valid format test file'
    const document = DocumentApp.create(path)
    const file = DriveApp.getFileById(document.getId())
    const documentContent = Math.random().toString()

    assertIsNotNullish(tokens[validToken]).totpSecret = totpSecret
    document.getBody().setText(documentContent)
    thisFolder.addFile(file)

    assertDeepStrictEqual(
      testGetResponse({
        token: validToken,
        path,
        totp: generateTOTP(totpSecret)
      }),
      {
        version,
        status: 'success',
        content: documentContent,
      }
    )

    file.setTrashed(true)
    assertIsNotNullish(tokens[validToken]).totpSecret = null
  })

  tests.push(function nestedFileOfCorrectTypeIsRetrieved () {
    const dirName = 'valid directory test'
    const nextDirName = 'valid directory test subdirectory'
    const fileName = 'valid test file'
    const documentContent = Math.random().toString()
    const topDir = thisFolder.createFolder(dirName)
    const nextDir = topDir.createFolder(nextDirName)
    const document = DocumentApp.create(fileName)

    document.getBody().setText(documentContent)
    nextDir.addFile(DriveApp.getFileById(document.getId()))

    assertDeepStrictEqual(
      testGetResponse({
        token: validToken,
        path: [dirName, nextDirName, fileName].join('/'),
        totp: null,
      }),
      {
        version,
        status: 'success',
        content: documentContent
      }
    )

    topDir.setTrashed(true)
  })

  // Run the tests
  tests.forEach(function (test) { test() })
  Logger.log(`all ${tests.length.toString()} tests passed`)
}

/**
 *
 * @param {import('../node/schemas.ts').RequestQueryParameters} params
 * @returns {import('../node/schemas.ts').Response}
 */
function testGetResponse (params) {
  const responseText = doGet({
    parameter: {
      token: params.token,
      path: params.path,
      ...(params.totp === null ? {} : {
        totp: params.totp,
      })
    },
    // All these additional properties might be provided when a real HTTP request happens, but we shouldn't care about them.
    contentLength: 0,
    contextPath: '',
    parameters: {},
    pathInfo: '',
    queryString: '',
  })
    .getContent()

  const unvalidatedResponse = JSON.parse(responseText)

  if (typeof unvalidatedResponse !== 'object' || unvalidatedResponse === null || Array.isArray(unvalidatedResponse)) {
    throw new Error('Didn\'t get object response')
  }

  if (!('version' in unvalidatedResponse) || typeof unvalidatedResponse.version !== 'string' || !isSemverString(unvalidatedResponse.version)) {
    throw new Error('\'version\' value should be a string with a semver version')
  }

  if (!('status' in unvalidatedResponse) || (unvalidatedResponse.status !== 'success' && unvalidatedResponse.status !== 'error')) {
    throw new Error('\'status\' value should be \'success\' or \'error\'')
  }

  const status = unvalidatedResponse.status

  if (status === 'success') {
    if (!('content' in unvalidatedResponse) || (typeof unvalidatedResponse.content !== 'string')) {
      throw new Error('\'content\' should be a string')
    }

    return {
      version: unvalidatedResponse.version,
      status,
      content: unvalidatedResponse.content,
    }
  } else {
    if (!('message' in unvalidatedResponse) || (typeof 'message' !== 'string')) {
      throw new Error('\'message\' should be a string')
    }

    return {
      version: unvalidatedResponse.version,
      status,
      // @ts-expect-error because this is just for testing and the tests will check exact error values
      message: unvalidatedResponse.message,
    }
  }
}

/**
 * @param {string} text
 * @returns {text is import('../node/schemas.ts').Response['version']}
 */
function isSemverString (text) {
  return /\d+\.\d+\.\d+/.test(text)
}

/**
 * @template {import('../node/schemas.ts').JSONValue} T
 * @param {T} a
 * @param {T} b
 * @returns {boolean}
 */
function deepStrictEqual (a, b) {
  if (a === b) {
    return true
  }

  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) {
      return false
    }

    for (let i = 0; i < a.length; i++) {
      if (!deepStrictEqual(assertIsNotUndefined(a[i]), assertIsNotUndefined(b[i]))) {
        return false
      }
    }

    return true
  }

  if (Array.isArray(b)) {
    return false
  }

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) {
    return false
  }

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !deepStrictEqual(assertIsNotUndefined(a[key]), assertIsNotUndefined(b[key]))) {
      return false
    }
  }

  return true
}

/**
 * @template {import('../node/schemas.ts').JSONValue} T
 * @param {T} a
 * @param {T} b
 */
function assertDeepStrictEqual (a, b) {
  if (!deepStrictEqual(a, b)) {
    throw new Error(`${JSON.stringify(a)} is not equal to ${JSON.stringify(b)}`)
  }
}
