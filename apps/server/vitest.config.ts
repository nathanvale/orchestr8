import { defineConfig } from 'vitest/config'

/**
 * Server-specific Vitest Configuration
 *
 * This configuration is for server-side Node.js tests that don't need
 * browser-specific setup files or DOM testing utilities.
 */
export default defineConfig({
  test: {
    // Use Node.js environment for server tests
    environment: 'node',

    // Use server-specific setup file (no browser testing utilities)
    setupFiles: ['./vitest.setup.ts'],

    // Include server test files
    include: ['src/**/*.{test,spec}.{ts,tsx}'],

    // Global excludes
    exclude: ['**/node_modules/**', '**/dist/**'],

    // Server tests should be isolated
    isolate: true,

    // Use forks pool for stability
    pool: 'threads',

    // Enable globals for test functions
    globals: true,

    // Clear mocks between tests
    clearMocks: true,

    // Server-specific timeout settings
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 15000,
  },
})
