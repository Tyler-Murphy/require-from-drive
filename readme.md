### Install

```
npm install --save require-from-drive
```

### Use

**IMPORTANT: Each time the apps script is changed, you'll need to deploy a new version as a web app. Otherwise, your changes won't end up in the live version.**

First, follow these steps to set up Google Drive:

1. Create a folder on Google Drive. Name it something like "app secrets"
2. Create an apps script in the folder, and paste the contents of drive_server.js in it.
3. Get the folder ID and put it in line 1 of the apps script
4. Change the default token to something more secure, and give it a description
5. Add separate tokens for each app or server that will request secrets
6. Create a version of the apps script
7. Deploy as a web app, and get the url.
8. Set the `REQUIRE_FROM_DRIVE_SERVER_ADDRESS` environment variable to the web app url
9. Set the `REQUIRE_FROM_DRIVE_SERVER_TOKEN` to one of the tokens
10. Add sub-directories and files. Paths to files are relative to the folder containing the apps script

Then do this!

```js
const requireFromDrive = require('require-from-drive').requireFromDrive
const myModule = requireFromDrive('path/to/project/module.js')
const config = requireFromDrive('path/to/project/config.json')
```

### Test

To run the apps script tests, use the apps script viewer/editor to select "test" from the "Run" menu. An error will be thrown and a message will pop up if any test fails.

### Possible improvements

- Limit token access to particular subdirectories or files
- Add pictures to the setup instructions
- Client libraries for other languages
- Client library tests... maybe a public google drive folder with some test folders and files could be set up. Apps script execution limits might be reached if tests are run too frequently.
- Access logs
