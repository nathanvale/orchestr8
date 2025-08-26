import { join } from 'node:path';

export default function () {
  return {
    // Use Vitest as the test framework
    testFramework: {
      type: 'vitest',
      config: {
        configFile: './vitest.config.ts',
      },
    },

    // File patterns
    files: [
      'src/**/*.{js,ts,jsx,tsx}',
      'vitest.config.ts',
      'vitest.setup.tsx',
      'tsconfig.json',
      'package.json',
      // Include MSW handlers
      'tests/mocks/**/*.ts',
      'tests/utils/**/*.{ts,tsx}',
      // Exclude test files
      '!src/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],

    tests: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}', 'tests/**/*.{test,spec}.{js,ts,jsx,tsx}'],

    // Environment configuration
    env: {
      type: 'node',
      runner: 'node', // Use Node.js as the runtime (Wallaby doesn't support Bun)
    },

    // Setup function for MSW and global configuration
    // @ts-expect-error - Wallaby types not available in ESM
    setup: function (wallaby) {
      // Set environment variables for optimal performance
      process.env.NODE_ENV = 'test';
      process.env['VITEST_WALLABY'] = 'true';

      // Setup module aliases to match vitest.config.ts
      const moduleNameMapper = {
        '^@/(.*)$': join(wallaby.projectCacheDir, 'src/$1'),
        '^@tests/(.*)$': join(wallaby.projectCacheDir, 'tests/$1'),
        '^@types/(.*)$': join(wallaby.projectCacheDir, 'types/$1'),
        '^@utils/(.*)$': join(wallaby.projectCacheDir, 'src/utils/$1'),
        '^@config/(.*)$': join(wallaby.projectCacheDir, 'config/$1'),
      };

      return {
        moduleNameMapper,
      };
    },

    // Debugging and logging
    debug: false,
    trace: false, // Enable for debugging module resolution

    // Performance optimizations
    workers: {
      initial: 1,
      regular: 4,
      recycle: true, // Standard Node.js worker recycling
    },

    // File change detection
    filesWithNoCoverageCalculated: [
      'vitest.setup.tsx',
      'tests/mocks/**/*.ts',
      'tests/utils/**/*.{ts,tsx}',
    ],

    // Let Wallaby handle TypeScript preprocessing automatically

    // Report configuration for VS Code integration
    reportConsoleErrorAsError: true,
    reportUnhandledPromises: false,

    // Hints for better VS Code integration
    hints: {
      allowIgnoringCoverageInTests: true,
      ignoreCoverageForFile: /\.test\.|\.spec\./,
      maxConsoleMessagesPerTest: 100,
    },

    // Disable auto detect to prevent runtime conflicts
    autoDetect: false,

    // Run all tests initially
    runAllTestsInAffectedTestFile: true,

    // Show inline error messages
    showErrorMessages: true,

    // Coverage thresholds
    coverageAnalysis: 'perTest',
  };
}
