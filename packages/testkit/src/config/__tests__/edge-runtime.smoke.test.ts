/**
 * Smoke tests for edge runtime behavior without convex dependencies
 */

import { createBaseVitestConfig } from '../vitest.base.js'

describe('edge runtime smoke test', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv }
    delete process.env.TESTKIT_DISABLE_EDGE_RUNTIME
    delete process.env.TESTKIT_ENABLE_EDGE_RUNTIME
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should not fail when edge runtime dependency is missing and no convex tests exist', () => {
    // Mock a consumer environment without edge-runtime or convex
    process.cwd = vi.fn().mockReturnValue('/some/consumer/without/convex')

    // This should not throw even if @edge-runtime/vm is not available
    expect(() => {
      const config = createBaseVitestConfig()

      // Verify that no edge-runtime project was added when dependencies are missing
      const projects = config.test?.projects as any[]
      const edgeProject = projects?.find((p) => p.test?.environment === 'edge-runtime')

      // Edge runtime project should not be present when deps are missing and no convex dir
      expect(edgeProject).toBeUndefined()
    }).not.toThrow()
  })

  it('should include edge runtime project when explicitly enabled even without dependency', () => {
    process.env.TESTKIT_ENABLE_EDGE_RUNTIME = '1'
    process.cwd = vi.fn().mockReturnValue('/some/consumer/without/convex')

    // This should include the edge runtime project even if dependency resolution fails
    const config = createBaseVitestConfig()
    const projects = config.test?.projects as any[]
    const edgeProject = projects?.find((p) => p.test?.environment === 'edge-runtime')

    // Should be present when explicitly enabled
    expect(edgeProject).toBeDefined()
    expect(edgeProject?.test?.environment).toBe('edge-runtime')
    expect(edgeProject?.test?.include).toEqual([
      '**/convex/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ])
  })

  it('should handle edge runtime dependency resolution gracefully', () => {
    process.cwd = vi.fn().mockReturnValue('/some/consumer/path')

    // Mock the import.meta.resolve to simulate missing dependency
    const originalResolve = import.meta.resolve
    // @ts-expect-error - Mocking for test
    import.meta.resolve = vi.fn().mockImplementation(() => {
      throw new Error('Cannot resolve @edge-runtime/vm')
    })

    try {
      // Should not throw even when dependency resolution fails
      expect(() => {
        const config = createBaseVitestConfig()

        // Verify configuration is still valid
        expect(config.test).toBeDefined()
        expect(config.test?.pool).toBeDefined()

        const projects = config.test?.projects as any[]
        expect(projects).toBeDefined()
        expect(Array.isArray(projects)).toBe(true)
      }).not.toThrow()
    } finally {
      // Restore original resolve
      import.meta.resolve = originalResolve
    }
  })

  it('should maintain stable configuration when edge runtime is disabled', () => {
    process.env.TESTKIT_DISABLE_EDGE_RUNTIME = '1'
    process.cwd = vi.fn().mockReturnValue('/some/consumer/path')

    const config = createBaseVitestConfig()

    // Should have basic unit test project but no edge runtime
    const projects = config.test?.projects as any[]
    expect(projects).toBeDefined()
    expect(projects.length).toBeGreaterThan(0)

    const edgeProject = projects.find((p) => p.test?.environment === 'edge-runtime')
    expect(edgeProject).toBeUndefined()

    // Should still have unit test project
    const unitProject = projects.find((p) =>
      p.test?.include?.some((pattern: string) => pattern.includes('src/')),
    )
    expect(unitProject).toBeDefined()
  })
})
