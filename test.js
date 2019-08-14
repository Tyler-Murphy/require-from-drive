const test = require('parallel-test').default
const assert = require('assert')
const requireFromDrive = require('./require_from_drive').requireFromDrive

console.log('see the readme for instructions on testing the apps script')

const testPath = `testing/test.json`
const testValue = {
  hi: 'there'
}

function requireTestFile (cache = true) {
  try {
    return requireFromDrive(testPath, cache)
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
  assert.throws(() => requireFromDrive(Math.random().toString()))
})

test('caches results so that the second retrieval is fast', () => {
  requireTestFile()

  const startTime = Date.now()

  requireTestFile()

  assert.ok(Date.now() - startTime <= 1)
})

test('can retrieve results without using the cache for cases where files are expected to change frequently and must remain up to date', () => {
  requireTestFile()

  const startTime = Date.now()

  requireTestFile(false)

  assert.ok(Date.now() - startTime > 100)
})
