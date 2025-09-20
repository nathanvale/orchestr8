module.exports = function (wallaby) {
  return {
    autoDetect: ['vitest'],

    // Force use of root vitest config - critical for monorepo
    testFramework: {
      configFile: './vitest.config.ts',
    },

    env: {
      type: 'node',
      runner: 'node',
    },

    workers: {
      initial: 1,
      regular: 1,
      // Restart workers periodically to prevent memory leaks and zombies
      restart: true,
      // Kill workers after 30 seconds of inactivity
      recycle: true,
    },

    // Prevent zombie processes
    runMode: 'onsave',
    slowTestThreshold: 5000, // Mark tests as slow after 5s
    testTimeout: 10000, // Kill tests after 10s

    // Increase console message limits for noisy tests
    maxConsoleMessagesPerTest: 1000,

    // Only include source tests, exclude node_modules completely
    tests: [
      '*.test.ts', // Include root level test files
      'packages/*/src/**/*.test.ts',
      'packages/*/src/**/*.test.tsx',
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      '!**/node_modules/**', // Critical: exclude all node_modules
      '!**/*performance*.test.ts', // Skip all performance tests
      '!**/*benchmark*.test.ts', // Skip all benchmark tests
      '!**/*.integration.test.ts', // Skip integration tests
      '!**/*.e2e.test.ts', // Skip e2e tests
      '!**/*.slow.test.ts', // Skip slow tests
    ],

    // Also exclude node_modules from files
    files: [
      '*.ts', // Include root level files
      '!*.test.ts', // Exclude root level test files
      'packages/*/src/**/*.ts',
      'packages/*/src/**/*.tsx',
      '!packages/*/src/**/*.test.ts',
      '!packages/*/src/**/*.test.tsx',
      '!**/node_modules/**', // Critical: exclude all node_modules
      'packages/*/package.json',
      'tsconfig*.json',
      'vitest.config.ts',
    ],
  }
}
