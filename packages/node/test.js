import test from 'parallel-test'
import assert from 'assert'
import {
  requireFromDrive
} from './require_from_drive.js'

console.log('see the readme for instructions on testing the apps script')

const testPath = 'testing/test.json'
const testValue = {
  hi: 'there'
}

/**
 * @param {Omit<import('./require_from_drive.js').Options, 'path'>} options
 * @returns {import('./require_from_drive.js').Result}
 */
function requireTestFile ({ cache, cacheInFile } = {}) {
  try {
    return requireFromDrive({ path: testPath, cache, cacheInFile })
  } catch (error) {
    console.log(`This test requires the file ${testPath} to exist in the secret server folder in Google Drive and to contain ${JSON.stringify(testValue)}. If it doesn't exist, this test will fail. Set it up if necessary.`)

    throw error
  }
}

test('can retrieve secrets from Google Drive', async () => {
  assert.deepStrictEqual(
    await requireTestFile(),
    testValue
  )
})

test('rejects for files that do not exist', async () => {
  await assert.rejects(() => requireFromDrive({ path: Math.random().toString() }))
})

test('caches results so that the second retrieval is fast', async () => {
  await requireTestFile()

  const startTime = Date.now()

  await requireTestFile()

  assert.ok(Date.now() - startTime <= 1)
})

test('caches results in a file so that the second retrieval is fast even if the memory cache is not used', async () => {
  await requireTestFile()

  const startTime = Date.now()

  await requireTestFile({ cache: false })

  assert.ok(Date.now() - startTime <= 10)
})

test('can retrieve results without using a cache', async () => {
  await requireTestFile()

  const startTime = Date.now()

  await requireTestFile({ cache: false, cacheInFile: false })

  assert.ok(Date.now() - startTime > 100)
})
