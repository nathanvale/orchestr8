/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-undef */

/**
 * CommonJS Compatibility Test
 *
 * This test verifies that @orchestr8/testkit utilities can be imported using require()
 * in CommonJS environments. Note: Some modules that depend on testing frameworks
 * are not compatible with CJS due to Vitest's ESM-only nature.
 */

const { test } = require('node:test')
const { strict: assert } = require('node:assert')

test('should import utils submodule using require', () => {
  const utils = require('@orchestr8/testkit/utils')

  // Verify basic utilities are available
  assert.ok(typeof utils.delay === 'function', 'delay should be a function')
  assert.ok(typeof utils.retry === 'function', 'retry should be a function')
  assert.ok(typeof utils.withTimeout === 'function', 'withTimeout should be a function')
  assert.ok(typeof utils.createMockFn === 'function', 'createMockFn should be a function')
})

test('should import fs submodule using require', () => {
  const fs = require('@orchestr8/testkit/fs')

  // Verify fs utilities are available
  assert.ok(typeof fs.createTempDirectory === 'function', 'createTempDirectory should be a function')
  assert.ok(typeof fs.createNamedTempDirectory === 'function', 'createNamedTempDirectory should be a function')
})

test('should import env utilities using require', async () => {
  const env = require('@orchestr8/testkit/env')

  // Verify env utilities are available
  assert.ok(typeof env.getTestEnvironment === 'function', 'getTestEnvironment should be a function')
  assert.ok(typeof env.setupTestEnv === 'function', 'setupTestEnv should be a function')
  assert.ok(typeof env.getTestTimeouts === 'function', 'getTestTimeouts should be a function')

  // Test that they actually work
  const testEnv = env.getTestEnvironment()
  assert.ok(typeof testEnv === 'object', 'getTestEnvironment should return an object')
  assert.ok(typeof testEnv.nodeEnv === 'string', 'should have nodeEnv property')

  const timeouts = env.getTestTimeouts()
  assert.ok(typeof timeouts === 'object', 'getTestTimeouts should return an object')
  assert.ok(typeof timeouts.unit === 'number', 'should have unit timeout')
})

test('should work with utility functions', async () => {
  const utils = require('@orchestr8/testkit/utils')

  // Test delay function
  const start = Date.now()
  await utils.delay(10)
  const elapsed = Date.now() - start
  assert.ok(elapsed >= 10, 'delay should wait at least 10ms')

  // Test withTimeout
  const quickPromise = Promise.resolve('quick')
  const result = await utils.withTimeout(quickPromise, 1000)
  assert.equal(result, 'quick', 'withTimeout should resolve with promise value')

  // Test createMockFn
  const mockFn = utils.createMockFn((x) => x * 2)
  const mockResult = mockFn(5)
  assert.equal(mockResult, 10, 'mock function should work')
  assert.equal(mockFn.calls.length, 1, 'mock function should track calls')
})

test('should work with fs utilities', async () => {
  const fs = require('@orchestr8/testkit/fs')

  // Test createTempDirectory
  const tempDir = await fs.createTempDirectory({ prefix: 'cjs-test-' })
  assert.ok(typeof tempDir.path === 'string', 'should have a path')
  assert.ok(typeof tempDir.cleanup === 'function', 'should have cleanup function')

  // Test writing and reading
  await tempDir.writeFile('test.txt', 'hello world')
  const content = await tempDir.readFile('test.txt')
  assert.equal(content, 'hello world', 'should read written content')

  // Cleanup
  await tempDir.cleanup()
})

console.log('✅ All CommonJS compatibility tests passed!')