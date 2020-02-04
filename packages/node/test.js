const test = require('parallel-test').default
const assert = require('assert')
const {
  requireFromDrive,
  requireFromDriveAsynchronously
} = require('./require_from_drive')

console.log('see the readme for instructions on testing the apps script')

const testPath = 'testing/test.json'
const testValue = {
  hi: 'there'
}

function requireTestFile ({ cache, cacheInFile } = {}) {
  try {
    return requireFromDrive({ path: testPath, cache, cacheInFile })
  } catch (error) {
    console.log(`This test requires the file ${testPath} to exist in the secret server folder in Google Drive and to contain ${JSON.stringify(testValue)}. If it doesn't exist, this test will fail. Set it up if necessary.`)

    throw error
  }
}

test('can retrieve secrets from Google Drive', () => {
  assert.deepStrictEqual(
    requireTestFile(),
    testValue
  )
})

test('throws for files that do not exist', () => {
  assert.throws(() => requireFromDrive({ path: Math.random().toString() }))
})

test('caches results so that the second retrieval is fast', () => {
  requireTestFile()

  const startTime = Date.now()

  requireTestFile()

  assert.ok(Date.now() - startTime <= 1)
})

test('caches results in a file so that the second retrieval is fast even if the memory cache is not used', () => {
  requireTestFile()

  const startTime = Date.now()

  requireTestFile({ cache: false })

  assert.ok(Date.now() - startTime <= 10)
})

test('can retrieve results without using a cache', () => {
  requireTestFile()

  const startTime = Date.now()

  requireTestFile({ cache: false, cacheInFile: false })

  assert.ok(Date.now() - startTime > 100)
})

test('can retrieve results asynchronously, for use in cases where it is not helpful for the load to be blocking', async () => {
  const result = await requireFromDriveAsynchronously({ path: testPath })

  assert.deepStrictEqual(
    result,
    testValue
  )
})
