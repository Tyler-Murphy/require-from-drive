import test from 'parallel-test'
import assert from 'assert'
import {
  requireFromDrive
} from './requireFromDrive.ts'
import type { ResponseError } from './schemas.ts'

console.log('see the readme for instructions on testing the apps script')

const testPath = 'testing/test.json'
const testValue = {
  hi: 'there'
}

function requireTestFile ({ cache, cacheInFile }: Omit<Parameters<typeof requireFromDrive>[0], `path`> = {}) {
  try {
    return requireFromDrive({ path: testPath, cache, cacheInFile })
  } catch (error) {
    console.log(`This test requires the file ${testPath} to exist in the secret server folder in Google Drive and to contain ${JSON.stringify(testValue)}. If it doesn't exist, this test will fail. Set it up if necessary.`)

    throw error
  }
}

test('can retrieve secrets from Google Drive', async () => {
  assert.deepStrictEqual(
    await requireTestFile({
      cache: false,
      cacheInFile: false,
    }),
    testValue
  )
})

test('rejects for files that do not exist', async () => {
  const expectedErrorMessage: ResponseError[`message`] = `could not find file`

  await assert.rejects(
    () => requireFromDrive({ path: Math.random().toString() }),
    new Error(expectedErrorMessage),
  )
})
