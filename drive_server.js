var thisFolder = DriveApp.getFolderById('your ID here')
var tokens = {
  'token': 'token description'
}

function doGet (request) {
  if (!(request.parameters.token in tokens)) {
    return text('Error: invalid token query parameter')
  }
  
  if (!request.parameters.splitPath) {
    return text('Error: missing splitPath query parameter')
  }
  
  var splitPath = JSON.parse(request.parameters.splitPath)
  var directories = splitPath.slice(0, -1)
  var fileName = splitPath.slice(-1)[0]
  var currentDirectory = thisFolder
  var directoryName
  var file
  var fileId
  var fileText
  
  while (directories.length) {
    directoryName = directories.shift()

    try {
      currentDirectory = currentDirectory.getFoldersByName(directoryName).next()
    } catch (error) {
      return text('Error: could not find folder ' + directoryName)
    }
  }
  
  try {
    file = currentDirectory.getFilesByName(fileName).next()
  } catch (error) {
    return text('Error: could not find file')
  }

  fileId = file.getId()

  try {
    fileText = DocumentApp.openById(fileId).getBody().getText()
  } catch (error) {
    return text('Error: could not read file with id ' + fileId)
  }
  
  return text(fileText)
}

function text (string) {
  return ContentService
  .createTextOutput(string)
  .setMimeType(ContentService.MimeType.TEXT)
}
