/**
 * Console suppression for test output noise reduction
 * Only active when VITEST_SILENT=true
 */

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
}

/**
 * Determines if an error should be shown even in silent mode
 * - Actual test failures should always be visible
 * - Critical errors should be visible
 */
function isActualTestFailure(args: unknown[]): boolean {
  const errorString = args.map((arg) => String(arg)).join(' ')

  // Patterns that indicate actual test failures
  const testFailurePatterns = [
    /AssertionError/i,
    /expect\(.+\)/i,
    /test failed/i,
    /✗ \d+ test/i,
    /FAIL /,
    /Error: /,
    /TypeError: /,
    /ReferenceError: /,
    /SyntaxError: /,
  ]

  return testFailurePatterns.some((pattern) => pattern.test(errorString))
}

/**
 * Setup console suppression based on environment
 */
export function setupConsoleSuppression(): void {
  // Only suppress if explicitly enabled
  if (process.env['VITEST_SILENT'] !== 'true') {
    return
  }

  // Allow memory debugging to override silent mode
  const memoryDebugEnabled = process.env['MEMORY_DEBUG'] === 'true'

  // Suppress console.log unless memory debugging
  console.log = memoryDebugEnabled ? originalConsole.log : () => {}

  // Suppress console.info unless memory debugging
  console.info = memoryDebugEnabled ? originalConsole.info : () => {}

  // Suppress console.debug always in silent mode
  console.debug = () => {}

  // Suppress console.warn unless memory debugging
  console.warn = memoryDebugEnabled ? originalConsole.warn : () => {}

  // Keep console.error but filter non-critical errors
  console.error = (...args: unknown[]) => {
    // Always show actual test failures
    if (isActualTestFailure(args)) {
      originalConsole.error(...args)
      return
    }

    // Show errors if memory debugging is enabled
    if (memoryDebugEnabled) {
      originalConsole.error(...args)
      return
    }

    // Otherwise suppress the error in silent mode
  }
}

/**
 * Restore original console methods
 */
export function restoreConsole(): void {
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
  console.info = originalConsole.info
  console.debug = originalConsole.debug
}

// Auto-setup on import
setupConsoleSuppression()
