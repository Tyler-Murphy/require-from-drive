#!/usr/bin/env node

import { randomBytes } from 'crypto'
import encodeQR from '../vendor/qr/src/index.js'
import { execSync } from 'child_process'
import { requireFromDrive } from '../requireFromDrive.js'
import path from 'node:path'
import url from 'node:url'
import { getInput } from '../terminal.js'
import {
  assertIsDefined,
  type ServerTokenConfiguration
} from '../schemas.js'

const keymasterPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../vendor/keymaster/require-from-drive');
const credentialManagerTokenName = `require-from-drive`
const tokenByteLength = 40
const token = toBase32(randomBytes(tokenByteLength))
let totpSecret: string | null = null

console.log(`✔ Generated ${tokenByteLength.toString()}-byte secret token`)

const isValidTotpAnswer = (answer: string) => answer === `yes` || answer === `no`
const requireTotp = await getInput(`Require TOTP for requests? (yes/no)`, {
  validate: {
    condition: (raw: string) => isValidTotpAnswer(raw) ? true : `Please enter "yes" or "no"`,
    maximumTries: 3,
  }
})

if (!isValidTotpAnswer(requireTotp)) {
  throw new Error(`Something went wrong`)
}

if (requireTotp === `yes`) {
  const totpSecretByteLength = 20 // As recommended in https://datatracker.ietf.org/doc/html/rfc4226
  totpSecret = toBase32(randomBytes(totpSecretByteLength))

  console.log(`✔ Generated ${totpSecretByteLength.toString()}-byte TOTP secret`)

  /** The name that will be displayed in the TOTP generator */
  const totpName = await getInput('TOTP app display name:')
  const qrCodeURL = `otpauth://totp/${encodeURIComponent(totpName)}?secret=${totpSecret}&issuer=require-from-drive`
  const qrCode = encodeQR(qrCodeURL, `ascii`, {
    border: 1,
    ecc: `low`,
  })

  console.log('Scan the QR code with your TOTP app:')
  console.log(qrCode)
  await getInput('For security, press enter to clear the QR code after scanning')
  process.stdout.moveCursor(0, -(qrCode.split('\n').length + 2))
  process.stdout.clearScreenDown()
  console.log('<QR code redacted>')
}

const tokenDescription = (
  await getInput(`Enter a description for this token (e.g. "so-and-so's laptop"):`, {
    validate: {
      condition: (raw: string) => raw.length > 0 ? true : `Description must be at least 1 character`,
      maximumTries: 3,
    }
  })
).trim()

console.log('✔ Generated new token key/value pair, printed on the following lines')

const tokenConfiguration: ServerTokenConfiguration = {
  [token]: {
    description: tokenDescription,
    totpSecret,
  }
}

console.log(JSON.stringify(tokenConfiguration, null, '  '))

await getInput('Copy the token key/value above. For security, press enter to clear the screen after copying.')

process.stdout.moveCursor(0, -7)
process.stdout.clearScreenDown()
console.log('<token key/value redacted>')

await getInput(`Add the copied token key/value to the 'tokens' object in your server's Apps Script code. Deploy a new revision of the server for changes to take effect. Press enter when done.`)

await getInput('Press enter to be prompted to add the token to your computer\'s credentials manager.')

try {
  execSync(`${keymasterPath} set ${credentialManagerTokenName} ${token}`)
} catch (error: unknown) {
  if (error instanceof Error && `stdout` in error && Buffer.isBuffer(error.stdout)) {
    console.error(`Failed to store token in credentials manager. You might need to delete the "${credentialManagerTokenName}" credential: ${error.stdout.toString()}`)
    process.exit(1)
  }

  throw error
}

console.log('✔ Added token to credentials manager')

const testPath = await getInput('Enter a Google Drive file path to test the new token or leave blank to skip testing:')

if (testPath !== '') {
  console.log('Testing new token...')
  await requireFromDrive({
    path: testPath,
    cache: false,
    cacheInFile: false,
  })
  console.log('✔ New token works. ')
}

console.log('All done!')

function toBase32(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      output += assertIsDefined(alphabet[(value >>> (bits - 5)) & 31])
      bits -= 5
    }
  }

  if (bits > 0) {
    output += assertIsDefined(alphabet[(value << (5 - bits)) & 31])
  }

  while (output.length % 8 !== 0) {
    output += '='
  }

  return output
}
