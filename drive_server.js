/* global
DriveApp,
DocumentApp,
ContentService,
Logger
*/

var thisFolderId = 'your ID here'
var tokens = {
  'token': 'token description'
}

// Constants
var errorPrefix = 'Error: '
var invalidTokenError = 'invalid token query parameter'
var missingPathError = 'missing splitPath query parameter'
var missingFolderError = 'could not find folder'
var missingFileError = 'could not find file'
var unreadableFileError = 'found file, but could not read file'

function doGet (request) {
  if (!(request.parameters.token in tokens)) {
    return errorText(invalidTokenError)
  }

  if (!request.parameters.path) {
    return errorText(missingPathError)
  }

  var splitPath = request.parameters.path.toString().split('/')
  var directories = splitPath.slice(0, -1)
  var fileName = splitPath.slice(-1)[0]
  var currentDirectory = DriveApp.getFolderById(thisFolderId)
  var directoryName
  var file
  var fileId
  var fileText

  while (directories.length) {
    directoryName = directories.shift()

    try {
      currentDirectory = currentDirectory.getFoldersByName(directoryName).next()
    } catch (error) {
      return errorText(missingFolderError + ' ' + directoryName)
    }
  }

  try {
    file = currentDirectory.getFilesByName(fileName).next()
  } catch (error) {
    return errorText(missingFileError)
  }

  fileId = file.getId()

  try {
    fileText = DocumentApp.openById(fileId).getBody().getText()
  } catch (error) {
    return errorText(unreadableFileError)
  }

  return text(fileText)
}

function text (string) {
  return ContentService
  .createTextOutput(string)
  .setMimeType(ContentService.MimeType.TEXT)
}

function errorText (string) {
  return text(errorPrefix + string)
}

// Tests

/* eslint-disable no-unused-vars */
function test () {
/* eslint-enable no-unused-vars */
  var tests = []
  var validToken = 'valid'
  var invalidToken = Math.random()
  var thisFolder = DriveApp.getFolderById(thisFolderId)

  tokens[validToken] = 'description'

  tests.push(function missingOrInvalidTokenCausesError () {
    assertEqual(
      stringGetResponse({
        token: invalidToken
      }),
      errorPrefix + invalidTokenError
    )
  })

  tests.push(function missingPathCausesError () {
    assertEqual(
      stringGetResponse({
        token: validToken
      }),
      errorPrefix + missingPathError
    )
  })

  tests.push(function fileOfWrongTypeCausesError () {
    var fileName = 'secrets server invalid format test file'
    var file = thisFolder.createFile(fileName, 'content')

    assertEqual(
      stringGetResponse({
        token: validToken,
        path: fileName
      }),
      errorPrefix + unreadableFileError
    )

    file.setTrashed(true)
  })

  tests.push(function missingFileCausesError () {
    assertEqual(
      stringGetResponse({
        token: validToken,
        path: 'not a real file'
      }),
      errorPrefix + missingFileError
    )
  })

  tests.push(function missingDirectoryCausesError () {
    assertEqual(
      stringGetResponse({
        token: validToken,
        path: 'missingDir/someFile'
      }).indexOf(missingFolderError) !== -1,
      true
    )
  })

  tests.push(function nestedFileOfCorrectTypeIsRetrieved () {
    var dirName = 'valid directory test'
    var nextDirName = 'valid directory test subdirectory'
    var fileName = 'valid test file'
    var fileContent = 'content'
    var topDir = thisFolder.createFolder(dirName)
    var nextDir = topDir.createFolder(nextDirName)
    var file = DocumentApp.create(fileName)

    file.getBody().setText(fileContent)
    nextDir.addFile(DriveApp.getFileById(file.getId()))

    assertEqual(
      stringGetResponse({
        token: validToken,
        path: [dirName, nextDirName, fileName].join('/')
      }),
      fileContent
    )

    topDir.setTrashed(true)
  })

  tests.forEach(function (test) { test() })
  Logger.log('all tests passed')
}

function stringGetResponse (params) {
  return doGet({ parameters: params })
  .getContent()
  .toString()
}

function assertEqual (a, b) {
  if (a !== b) {
    throw new Error(a + ' does not equal ' + b)
  }
}
