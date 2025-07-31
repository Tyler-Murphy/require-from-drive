This library lets you load JSON-containing Google Docs. Loading is fingerprint-protected on macOS laptops or can be token-protected for servers and other computers.

There are two parts:
  - an Apps Script you'll put in Google Drive
  - A node module to load things from Google drive

### Install

**As of v4, node >= 24.0.0 is required and macOS with a fingerprint reader is recommended**

```
npm install --save require-from-drive
```

### Use

**IMPORTANT: Each time the apps script is changed, you'll need to deploy a new version as a web app. Otherwise, your changes won't end up in the live version.**

First, follow these steps to set up Google Drive:

1. Create a folder on Google Drive. Name it something like "app secrets"
2. Create an apps script in the folder, and paste the contents of `packages/appsScript/server.js` in it.
3. Get the folder ID and put it in the Apps Script's `thisFolderId` variable
4. Create a blank, single-column spreadsheet in the folder, and paste its entire URL in the Apps Script's `spreadsheetLoggingUrl` variable. Logs about requests will be stored in this spreadsheet.
5. Deploy as a web app, and copy the url.
6. Set the local `REQUIRE_FROM_DRIVE_SERVER_ADDRESS` environment variable to the web app url
7. Run `npx require-from-drive generate-secret` and follow the prompts to generate a secret. Repeat as necessary to generate separate tokens for each app or server that will request files.
8. Add sub-directories and Google Docs containing JSON. Paths to Docs are relative to the folder containing the apps script

Then do this!

```js
import { requireFromDrive } from 'require-from-drive'

const config = await requireFromDrive({ path: 'path/to/project/config.json' })
```

A memory cache and a file cache are enabled by default. The file cache uses file names prefixed with `.require-from-drive`.

The memory cache can be disabled by setting the `cache` option to `false`. The file cache can be disabled by setting the `cacheInFile` option to `false`.

**IMPORTANT: Because there's a file cache, you should add `.require-from-drive*` to your `.gitignore`**

### Test

To run the Apps Script tests, use the Apps Script IDE to select "test" from the "Run" menu. An error will be thrown and a message will pop up if any test fails.
