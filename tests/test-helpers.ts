import { expect } from 'vitest'

/**
 * Helper to test runtime import failures gracefully.
 * Useful for testing fallback behavior when certain modules aren't available.
 *
 * @param importFn - Function that performs the dynamic import
 * @param expectedError - RegExp or string to match against error message
 * @returns Promise that resolves when the import fails as expected
 */
export async function expectRuntimeImportToFail(
  importFn: () => Promise<any>,
  expectedError?: RegExp | string,
): Promise<void> {
  try {
    await importFn()
    // If we reach here, the import succeeded when it shouldn't have
    expect.fail('Expected import to fail but it succeeded')
  } catch (error) {
    // Ensure at least one awaited microtask for require-await rule
    await Promise.resolve()
    // Import failed as expected
    expect(error).toBeInstanceOf(Error)

    if (expectedError) {
      const errorMessage = (error as Error).message
      if (typeof expectedError === 'string') {
        expect(errorMessage).toContain(expectedError)
      } else {
        expect(errorMessage).toMatch(expectedError)
      }
    }
  }
}

/**
 * Helper to test synchronous runtime import failures.
 *
 * @param importFn - Function that performs the import
 * @param expectedError - RegExp or string to match against error message
 */
export function expectSyncImportToFail(importFn: () => any, expectedError?: RegExp | string): void {
  expect(() => importFn()).toThrow(expectedError)
}

/**
 * Mock a module to simulate it not being available (e.g., Node.js environment).
 * Returns a cleanup function to restore the original behavior.
 *
 * @param moduleName - Name of the module to mock as unavailable
 * @returns Cleanup function to restore original behavior
 */
export function mockModuleAsUnavailable(moduleName: string): () => void {
  const g: any = globalThis as any
  const originalImport = g.import
  const originalRequire = g.require

  // Override dynamic import
  // Override dynamic import
  g.import = async (specifier: string) => {
    if (specifier === moduleName) {
      const error = new Error(`Cannot find module '${moduleName}'`)
      ;(error as any).code = 'ERR_MODULE_NOT_FOUND'
      throw error
    }
    // microtask to satisfy require-await rule
    await Promise.resolve()
    return originalImport(specifier)
  }

  // Override require if it exists
  if (typeof originalRequire === 'function') {
    g.require = (id: string) => {
      if (id === moduleName) {
        const error = new Error(`Cannot find module '${moduleName}'`)
        ;(error as any).code = 'MODULE_NOT_FOUND'
        throw error
      }
      return originalRequire(id)
    }
  }

  // Return cleanup function
  return () => {
    g.import = originalImport
    if (typeof originalRequire === 'function') {
      g.require = originalRequire
    }
  }
}
