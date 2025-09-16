/* eslint-env node */
module.exports = function (_wallaby) {
  return {
    files: [
      'src/**/*.ts',
      'src/**/*.js',
      '!src/**/*.test.ts',
      '!src/**/*.spec.ts',
      'bin/**/*',
      'dist/**/*.js',
      'vitest.config.ts',
      'tsconfig.json',
      'package.json',
    ],

    tests: ['src/**/*.unit.test.ts'],

    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.integration.test.ts',
      '**/*.e2e.test.ts',
      '**/*.slow.test.ts',
    ],

    env: {
      type: 'node',
      runner: 'node',
      params: {
        env: 'WALLABY_INCLUDE_INTEGRATION=false;VITEST_QUIET=true',
      },
    },

    testFramework: 'vitest',

    setup: function () {
      // Setup for vitest - configuration handled by vitest.config.ts
    },

    workers: {
      initial: 6,
      regular: 2,
      restart: false,
    },

    delays: {
      run: 300,
    },

    runMode: 'onsave',

    debug: false,

    // Performance settings for ADHD workflow
    reportConsoleErrorAsError: true,

    // Enable coverage for visual indicators
    reportCoverage: true,
  }
}
