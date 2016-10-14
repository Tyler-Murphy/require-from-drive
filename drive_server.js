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
  var file
  var fileId
  var fileText
  
  while (directories.length) {
    currentDirectory = currentDirectory.getFoldersByName(directories.pop()).next()
  }
  
  file = currentDirectory.getFilesByName(fileName).next()
  fileId = file.getId()
  fileText = DocumentApp.openById(fileId).getBody().getText()
  
  return text(fileText)
}

function text (string) {
  return ContentService
  .createTextOutput(string)
  .setMimeType(ContentService.MimeType.TEXT)
}
