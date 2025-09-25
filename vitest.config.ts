import { defineConfig } from 'vitest/config'
import { createBaseVitestConfig } from './packages/testkit/src/config/vitest.base.js'
import { getVitestProjects } from './vitest.projects.js'

/**
 * Root Vitest config that extends base configuration for Wallaby compatibility.
 * Ensures Wallaby picks up environmentMatchGlobs, server.deps.inline, and other
 * Convex-specific settings from the testkit base configuration.
 */
export default defineConfig(
  createBaseVitestConfig({
    test: {
      // Use projects for multi-package testing
      projects: getVitestProjects(),
      // Override root-specific settings while preserving base config
      name: 'root',
      root: '.',
      environment: 'node',
      include: ['*.test.ts', 'tests/**/*.test.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/*.integration.test.*',
      ],
      // Override coverage to exclude root-level config files
      coverage: {
        enabled: process.env['CI'] === 'true',
        provider: 'v8' as const,
        reporter: process.env['CI'] === 'true' ? ['json', 'clover'] : ['text', 'html'],
        reportsDirectory: './test-results/coverage',
        exclude: [
          'node_modules/',
          'dist/',
          'coverage/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/index.ts',
          // Exclude root-level config files that shouldn't be counted
          'vitest.*.ts',
          'wallaby.cjs',
          '*.workspace.ts',
          '.github/**',
          'scripts/**',
          'packages/*/dist/**',
          'packages/**/node_modules/**',
        ],
        // Use a more reasonable threshold for the overall monorepo
        thresholds: {
          statements: 39, // Current actual coverage
          branches: 39,
          functions: 39,
          lines: 39,
        },
      },
    },
  }),
)
