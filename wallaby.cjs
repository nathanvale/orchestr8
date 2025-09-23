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
        env: `WALLABY_ENV=true;TEST_MODE=`, // set WALLABY_ENV and explicitly clear TEST_MODE
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

    // Note: Edge runtime routing and convex-test dependency inlining are
    // configured in packages/testkit/src/config/vitest.base.ts and consumed
    // via vitest.config.ts + vitest.projects.ts so Wallaby inherits them.
  }
}
