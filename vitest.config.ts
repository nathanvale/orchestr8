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
    },
  }),
)
