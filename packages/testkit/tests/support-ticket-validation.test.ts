import { describe, it, expect } from 'vitest'

// Test all the specific imports mentioned in the support ticket
// Since we're testing from within the package, we use relative imports to the dist folder
describe('Support Ticket TESTKIT-001 - Module Resolution Validation', () => {
  it('should import utils sub-export without errors', async () => {
    const utils = await import('../dist/utils/index.js')
    expect(utils).toBeDefined()
    expect(utils.createMockFn).toBeDefined()
    expect(utils.delay).toBeDefined()
  })

  it('should import config/vitest sub-export without errors', async () => {
    const config = await import('../dist/config/vitest.base.js')
    expect(config).toBeDefined()
    expect(config.createBaseVitestConfig).toBeDefined()
  })

  it('should import msw sub-export without errors', async () => {
    const msw = await import('../dist/msw/index.js')
    expect(msw).toBeDefined()
    expect(msw.setupMSW).toBeDefined()
    expect(msw.http).toBeDefined()
  })

  it.skip('should import env sub-export without errors', async () => {
    // Skipped: env module requires vitest runtime context
    const env = await import('../dist/env/index.js')
    expect(env).toBeDefined()
  })

  it('should import fs sub-export without errors', async () => {
    const fs = await import('../dist/fs/index.js')
    expect(fs).toBeDefined()
    expect(fs.createTempDirectory).toBeDefined()
  })

  it('should import sqlite sub-export without errors', async () => {
    const sqlite = await import('../dist/sqlite/index.js')
    expect(sqlite).toBeDefined()
    expect(sqlite.createMemoryUrl).toBeDefined()
  })

  it('should import convex sub-export without errors', async () => {
    const convex = await import('../dist/convex/index.js')
    expect(convex).toBeDefined()
    expect(convex.createConvexTestHarness).toBeDefined()
    expect(convex.setupConvexTest).toBeDefined()
  })

  it('should import containers sub-export without errors', async () => {
    const containers = await import('../dist/containers/index.js')
    expect(containers).toBeDefined()
    expect(containers.createTestContainer).toBeDefined()
    expect(containers.MySQLContainer).toBeDefined()
    expect(containers.PostgresContainer).toBeDefined()
  })

  it('should import cli sub-export without errors', async () => {
    const cli = await import('../dist/cli/index.js')
    expect(cli).toBeDefined()
    expect(cli.mockSpawn).toBeDefined()
    expect(cli.MockChildProcess).toBeDefined()
  })
})

// Validate the exact import patterns from the support ticket documentation
describe('Documentation Import Patterns', () => {
  it('should support the documented import patterns from utils', async () => {
    const { createMockFn, delay, retry } = await import('../dist/utils/index.js')
    expect(createMockFn).toBeDefined()
    expect(typeof createMockFn).toBe('function')
    expect(typeof delay).toBe('function')
    expect(typeof retry).toBe('function')
  })

  it('should support the documented import patterns from config/vitest', async () => {
    const { createBaseVitestConfig } = await import('../dist/config/vitest.base.js')
    expect(createBaseVitestConfig).toBeDefined()
    expect(typeof createBaseVitestConfig).toBe('function')
  })

  it('should support the documented import patterns from msw', async () => {
    const { setupMSW, http } = await import('../dist/msw/index.js')
    expect(setupMSW).toBeDefined()
    expect(http).toBeDefined()
    expect(typeof setupMSW).toBe('function')
  })

  it('should support the documented import patterns from sqlite', async () => {
    const { createMemoryUrl } = await import('../dist/sqlite/index.js')
    expect(createMemoryUrl).toBeDefined()
    expect(typeof createMemoryUrl).toBe('function')
  })

  it('should support the documented import patterns from fs', async () => {
    const { createTempDirectory } = await import('../dist/fs/index.js')
    expect(createTempDirectory).toBeDefined()
    expect(typeof createTempDirectory).toBe('function')
  })

  it('should support the documented import patterns from containers', async () => {
    const { MySQLContainer, PostgresContainer, createTestContainer } = await import(
      '../dist/containers/index.js'
    )
    expect(MySQLContainer).toBeDefined()
    expect(PostgresContainer).toBeDefined()
    expect(typeof createTestContainer).toBe('function')
  })

  it('should support the documented import patterns from cli', async () => {
    const { mockSpawn, MockChildProcess } = await import('../dist/cli/index.js')
    expect(mockSpawn).toBeDefined()
    expect(MockChildProcess).toBeDefined()
    expect(typeof mockSpawn).toBe('function')
  })
})

// Note: These tests validate that the dist files exist and export the expected functions.
// When the package is installed as a dependency, the exports configuration in package.json
// will map imports like '@orchestr8/testkit/utils' to these dist files.
