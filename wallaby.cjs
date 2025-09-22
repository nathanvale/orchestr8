module.exports = function (wallaby) {
  return {
    autoDetect: ['vitest'],

    // Use Wallaby-specific workspace configuration
    testFramework: {
      // Use the unified Vitest config with projects
      configFile: './vitest.config.ts',
    },

    env: {
      type: 'node',
      runner: 'node',
      params: {
        env: `TEST_MODE=`, // explicitly clear TEST_MODE so integration projects never run
        // Note: we clear TEST_MODE so Wallaby does not run integration or e2e
        // projects. E2E is intentionally gated behind TEST_MODE=e2e and should
        // be run via CI or the `pnpm test:e2e` script on capable runners.
      },
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

    // Let Vitest config drive test/file discovery to avoid duplication
    maxConsoleMessagesPerTest: 1000,
  }
}
