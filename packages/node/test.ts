import test from 'parallel-test'
import pLimit from 'p-limit'
import assert from 'assert'
import {
  deleteAsync
} from 'del'
import {
  fileCachePrefix,
  requireFromDrive
} from './requireFromDrive.js'
import {
  assertIsDefined,
  type ResponseError
} from './schemas.js'
import {
  glob,
  readFile
} from 'fs/promises'

const ensureFileCacheIsEmpty = () => deleteAsync(`${fileCachePrefix}*`)
const limiter = pLimit(1)
const requireFromDriveSingleConcurrency = (...args: Parameters<typeof requireFromDrive>): ReturnType<typeof requireFromDrive> => limiter(async () => {
  await ensureFileCacheIsEmpty()
  return requireFromDrive(...args)
})
const testPath = 'testing/test.json'
const testValue = {
  hi: 'there'
}
const tokenWithTotp = `token with TOTP`
const tokenWithoutTotp = `token without TOTP`

console.log(`To run these tests for the first time`)
console.log(`1. Create and deploy an apps script according to the readme instruction. Set up a token without TOTP using the generate-secret script as described in the readme.`)
console.log(`2. Add a token that requires TOTP: "${tokenWithTotp}": {
  "description": "test with TOTP",
  "totpSecret": null
}`)
console.log(`2. Add a token that doesn't require TOTP: "${tokenWithoutTotp}": {
  "description": "test without TOTP",
  "totpSecret": "NTXCGZWVC2X6CZ3BBDLO64FB4QNUQPMZ"
}`)
console.log(`    - When the test with TOTP runs, use the TOTP secret above to generate a token by adding it to your phone or using an online TOTP generator like https://totp.danhersam.com/`)
console.log(`3. Deploy a new version of the apps script now that those two tokens are added`)
console.log(`4. Make a Google Doc at ${testPath} relative to the apps script. Its contents should be ${JSON.stringify(testValue)}`)


test('can retrieve when TOTP is required', async () => {
  assert.deepStrictEqual(
    await requireFromDriveSingleConcurrency({
      token: tokenWithTotp,
      path: testPath,
      cache: false,
      cacheInFile: false,
    }),
    testValue
  )
})

test('rejects when TOTP is required and invalid TOTP is provided', async () => {
  const expectedErrorMessage: ResponseError[`message`] = `invalid totp query parameter`

  await assert.rejects(() => requireFromDriveSingleConcurrency({
      token: tokenWithTotp,
      path: testPath,
      cache: false,
      cacheInFile: false,
    }),
    new Error(expectedErrorMessage),
    `For this test to pass, be sure to enter an invalid TOTP value when prompted`
  )
})

test('can retrieve using fingerprint-protected token from keychain', async () => {
  assert.deepStrictEqual(
    await requireFromDriveSingleConcurrency({
      path: testPath,
      cache: false,
      cacheInFile: false,
    }),
    testValue
  )
})

test('can retrieve when TOTP is not required', async () => {
  assert.deepStrictEqual(
    await requireFromDriveSingleConcurrency({
      token: `token without TOTP`,
      path: testPath,
      cache: false,
      cacheInFile: false,
    }),
    testValue
  )
})

test(`cached content isn't stored as plain text`, async () => {
  assert.deepStrictEqual(
    await requireFromDriveSingleConcurrency({
      token: tokenWithoutTotp,
      path: testPath,
      cache: false,
      cacheInFile: true,
    }),
    testValue
  )

  const cacheFiles = await Array.fromAsync(await glob(`${fileCachePrefix}*`))

  assert.strictEqual(cacheFiles.length, 1)

  const cacheContents = JSON.parse(await readFile(assertIsDefined(cacheFiles[0]), `utf-8`))

  assert.notDeepStrictEqual(cacheContents, testValue)

  for (const [key, value] of Object.entries(testValue)) {
    assert.ok(!JSON.stringify(cacheContents).includes(`"${key}"`))
    assert.ok(!JSON.stringify(cacheContents).includes(JSON.stringify(value)))
  }
})

test('rejects for files that do not exist', async () => {
  const expectedErrorMessage: ResponseError[`message`] = `could not find file`

  await assert.rejects(
    () => requireFromDriveSingleConcurrency({
      token: tokenWithoutTotp,
      path: Math.random().toString(),
      cache: false,
      cacheInFile: false,
    }),
    new Error(expectedErrorMessage),
  )
})

test('rejects for bad directory traversal', async () => {
  const path = testPath.replace(`/`, `/../`)
  const expectedErrorMessage: ResponseError[`message`] = `could not find folder ..`

  await assert.rejects(
    () => requireFromDriveSingleConcurrency({
      token: tokenWithoutTotp,
      path,
      cache: false,
      cacheInFile: false,
    }),
    new Error(expectedErrorMessage),
  )
})

test('rejects for bad token', async () => {
  const expectedErrorMessage: ResponseError[`message`] = `invalid token query parameter`

  await assert.rejects(
    () => requireFromDriveSingleConcurrency({
      token: `invalidToken`,
      path: testPath,
      cache: false,
      cacheInFile: false,
    }),
    new Error(expectedErrorMessage),
  )
})
