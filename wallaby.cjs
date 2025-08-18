/* wallaby.js */

// Set critical environment variables immediately when config loads
process.env.NODE_ENV = 'test'
process.env.VITEST = 'true'
process.env.WALLABY_WORKER = 'true'

// eslint-disable-next-line no-undef
module.exports = (wallaby) => {
  // Force NODE_ENV to test at the wallaby object level
  process.env.NODE_ENV = 'test'

  return {
    autoDetect: true,

    // Configure file patterns with ESM-safe exclusions
    files: {
      override: (filePatterns) => {
        // Return the patterns as-is for now, we can add exclusions later if needed
        return filePatterns
      },
    },

    // Exclude problematic test patterns
    tests: {
      override: (testPatterns) => {
        return [
          ...testPatterns,
          // Exclude any performance-intensive tests
          '!**/performance*.test.ts',
          // Exclude integration tests that spawn processes
          '!**/integration/**/*.test.ts',
        ]
      },
    },

    workers: {
      // Single worker to eliminate output duplication and minimize race conditions
      initial: 1,
      regular: 1,
      recycle: true,
      // Restart workers more frequently to prevent memory leaks
      restart: {
        onFailure: true,
        onRun: false,
        onProject: true,
      },
    },

    // Add delays to reduce race conditions and output frequency
    delays: {
      run: 200, // Delay to reduce rapid-fire output
      update: 500, // Reduce update frequency
    },

    // Limit progress reporting to reduce output volume
    reportConsoleErrorAsError: false, // Don't report console.error as test failures
    reportUnhandledPromises: false, // Reduce unhandled promise noise

    // Improve test isolation and error handling
    testFramework: {
      // Force test isolation for Vitest
      isolate: true,
    },

    // Additional Wallaby configuration for better stability
    maxConsoleMessagesPerTest: 1000, // Increase console message limit
    slowTestThreshold: 2000, // Increase slow test threshold for integration tests
    runMode: 'automatic', // Ensure automatic run mode
    lowCoverageThreshold: 50, // Lower coverage threshold to reduce noise

    // Improve debugging and error handling
    trace: false, // Enable if debugging is needed
    preserveComments: false, // Keep false for performance

    // File scanning optimizations
    fileScanMethod: 'native', // Use native file scanner for performance

    // Log limits for better performance
    maxLogEntrySize: 8192, // Limit log entry size

    // Handle ESM-specific issues
    ignoreFileLoadingDependencyTracking: false, // Keep dependency tracking

    env: {
      type: 'node',
      // Set memory limits to prevent leaks
      runner: 'node',
      params: {
        runner: '--max-old-space-size=4096 --enable-source-maps',
        // Set environment variables BEFORE node process starts
        env: 'NODE_ENV=test;VITEST=true;WALLABY_WORKER=true',
      },
    },

    setup: function (wallaby) {
      // Environment variables should already be set at config load time
      // Here we add worker-specific variables and verify environment

      // Verify test mode is active
      if (process.env.NODE_ENV !== 'test') {
        console.error(
          '[wallaby-setup] ERROR: NODE_ENV is not test, it is:',
          process.env.NODE_ENV,
        )
        // Force it to test mode
        process.env.NODE_ENV = 'test'
      }

      // Add worker-specific environment variables
      process.env.WALLABY_WORKER_ID = wallaby.workerId || '0'
      process.env.WALLABY_QUIET = 'true' // Enable quiet mode for reduced output
      process.env.VITEST_WORKER_ID = wallaby.workerId || '0' // Ensure Vitest worker ID is set

      // Preserve working directory early
      const originalCwd = process.cwd()

      // Store original working directory for restoration
      global.__wallaby_original_cwd = originalCwd

      // Clear any global state that might persist
      if (global.gc) {
        global.gc()
      }

      // Reset console to prevent log pollution
      console.clear?.()

      // Create output interceptor to limit message length
      const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
      }

      // Truncate long messages to prevent token overflow
      const truncateMessage = (msg, maxLength = 100) => {
        if (typeof msg === 'string' && msg.length > maxLength) {
          return msg.substring(0, maxLength) + '...[truncated]'
        }
        return msg
      }

      // Override console methods with truncation
      console.log = (...args) => {
        if (process.env.WALLABY_QUIET === 'true') return // Silent mode
        originalConsole.log(...args.map((arg) => truncateMessage(arg)))
      }

      console.warn = (...args) => {
        // Always show warnings but truncate them
        originalConsole.warn(...args.map((arg) => truncateMessage(arg)))
      }

      console.error = (...args) => {
        // Always show errors but truncate them
        originalConsole.error(...args.map((arg) => truncateMessage(arg)))
      }

      // Store original methods for restoration if needed
      global.__originalConsole = originalConsole
    },

    teardown: function () {
      // Restore original working directory if needed
      try {
        const originalCwd = global.__wallaby_original_cwd
        if (originalCwd && process.cwd() !== originalCwd) {
          process.chdir(originalCwd)
        }
      } catch (error) {
        // Non-fatal, but log the issue
        console.warn(
          '[wallaby-teardown] Working directory restoration failed:',
          error.message,
        )
      }

      // Clean up global state
      if (global.gc) {
        global.gc()
      }

      // Restore console methods if they were overridden
      if (global.__originalConsole) {
        Object.assign(console, global.__originalConsole)
        delete global.__originalConsole
      }

      // Clear worker-specific environment variables
      delete process.env.WALLABY_WORKER_ID
      delete process.env.WALLABY_QUIET
    },
  }
}
