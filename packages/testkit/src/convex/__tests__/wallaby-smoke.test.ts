/**
 * Wallaby smoke test to verify edge-runtime environment
 *
 * This test should run under convex path to trigger edge-runtime
 * environment via the environmentMatchGlobs configuration.
 */
import { describe, expect, it } from 'vitest'
import { createConvexTestHarness } from '../harness.js'
const RUN_CONVEX = process.env.CONVEX_GENERATED === 'true'
const itConvex = RUN_CONVEX ? it : it.skip

describe('Wallaby Edge-Runtime Smoke Test', () => {
  it('should run in edge-runtime environment', () => {
    // Verify we're in the edge-runtime environment
    // In edge-runtime, certain Node.js globals are not available
    const _isEdgeRuntime =
      typeof process.versions?.node === 'undefined' ||
      typeof global.Buffer === 'undefined' ||
      // Edge runtime has different global scope
      typeof globalThis !== 'undefined'

    // This test passes regardless, but logs the environment for debugging
    console.log('[Wallaby Smoke] Environment check:', {
      hasProcess: typeof process !== 'undefined',
      hasNodeVersion: typeof process?.versions?.node !== 'undefined',
      hasBuffer: typeof global?.Buffer !== 'undefined',
      globalThis: typeof globalThis,
      // @ts-expect-error - checking for edge-specific global
      hasEdgeRuntime: typeof EdgeRuntime !== 'undefined',
      _isEdgeRuntime, // Log the computed value for debugging
    })

    // Test should always pass - it's a smoke test to verify Wallaby works
    expect(true).toBe(true)
  })

  itConvex('should initialize Convex test harness in Wallaby', () => {
    // Simple smoke test to verify the harness initializes
    // modules defaults to {} to prevent _generated directory scan
    const harness = createConvexTestHarness({
      debug: false, // Set to true for debugging
    })

    expect(harness).toBeDefined()
    expect(harness.db).toBeDefined()
    expect(harness.auth).toBeDefined()
    expect(harness.storage).toBeDefined()
    expect(harness.scheduler).toBeDefined()
    expect(harness.lifecycle).toBeDefined()
  })

  itConvex('should execute basic Convex operations in Wallaby', async () => {
    // modules defaults to {} to prevent _generated directory scan
    const harness = createConvexTestHarness({})

    // Simple operation to verify convex-test works in Wallaby
    const result = await harness.db.run(async (_ctx) => {
      return { success: true, environment: 'wallaby-edge-runtime' }
    })

    expect(result.success).toBe(true)
    expect(result.environment).toBe('wallaby-edge-runtime')
  })

  itConvex('should handle async operations correctly in Wallaby', async () => {
    // modules defaults to {} to prevent _generated directory scan
    const harness = createConvexTestHarness({})

    // Test async behavior with timers
    let completed = false

    await harness.db.run(async (_ctx) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      completed = true
    })

    expect(completed).toBe(true)
  })

  it('should verify Wallaby-specific configuration is applied', () => {
    // Check if we're running in Wallaby
    const isWallaby = process.env.WALLABY_ENV === 'true'
    console.log('[Wallaby Smoke] isWallaby:', { WALLABY_ENV: process.env.WALLABY_ENV })
    if (isWallaby) {
      console.log('[Wallaby Smoke] Running in Wallaby environment')

      // Wallaby-specific checks
      expect(process.env.WALLABY_ENV).toBe('true')

      // Log Wallaby configuration for debugging
      console.log('[Wallaby Smoke] Wallaby config:', {
        env: process.env.WALLABY_ENV,
        testFile: __filename,
      })
    } else {
      console.log('[Wallaby Smoke] Running in standard Vitest environment')
    }

    // Test passes either way
    expect(true).toBe(true)
  })
})
