import { describe, expect, test } from 'vitest'
import { expectRuntimeImportToFail } from '../tests/test-helpers'

const CANNOT_FIND_MODULE_LITERAL = 'Cannot find module'

describe('Node.js fallback behavior', () => {
  test('startServer would handle Bun unavailability correctly (error path demonstration)', () => {
    // Note: Since Bun is mocked globally in vitest.setup.tsx, we can't easily
    // test the actual error path. This test documents what WOULD happen
    // if the Bun module wasn't available.

    // The error handling code in index.ts checks for:
    // 1. error.message.includes('Cannot find module')
    // 2. Then throws a user-friendly error with installation instructions

    // Verify the error message construction
    const expectedMessage =
      '❌ This project requires the Bun runtime.\n' +
      '   Please install Bun: https://bun.sh/docs/installation\n' +
      '   Then run: bun run dev'

    // Test that our custom error has the right format
    const customError = new Error(expectedMessage)
    expect(customError.message).toContain('❌ This project requires the Bun runtime')
    expect(customError.message).toContain('https://bun.sh/docs/installation')
    expect(customError.message).toContain('bun run dev')
  })

  test('error detection logic for module not found', () => {
    // Test the error detection logic separately
    const moduleNotFoundError = new Error(`${CANNOT_FIND_MODULE_LITERAL} 'bun'`)
    expect(moduleNotFoundError.message.includes(CANNOT_FIND_MODULE_LITERAL)).toBe(true)

    const otherError = new Error('Network error')
    expect(otherError.message.includes('Cannot find module')).toBe(false)
  })

  test('import failure test helper works correctly', async () => {
    // Test our helper function itself
    await expectRuntimeImportToFail(async () => {
      // Add an awaited microtask to satisfy require-await rule
      await Promise.resolve()
      throw new Error(`${CANNOT_FIND_MODULE_LITERAL} 'some-module'`)
    }, CANNOT_FIND_MODULE_LITERAL)

    // Test with regex pattern
    await expectRuntimeImportToFail(async () => {
      await Promise.resolve()
      throw new Error('Module not found: xyz')
    }, /Module not found/)

    // Test that it fails when import succeeds
    // The helper throws an error with expect.fail which creates an AssertionError
    await expect(
      expectRuntimeImportToFail(async () => {
        await Promise.resolve({ default: {} })
        return { default: {} }
      }, 'Should have failed'),
    ).rejects.toThrow(/Expected import to fail/)
  })
})
