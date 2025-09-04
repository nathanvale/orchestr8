const { cpus } = require('node:os')

module.exports = function (wallaby) {
  return {
    // Vitest auto-detection (works with Wallaby v1.0.1369+)
    autoDetect: ['vitest'],

    // Force use of specific vitest config for monorepo compatibility
    testFramework: {
      configFile: './vitest.config.ts'
    },

    // Debug mode: set WALLABY_TRACE=true environment variable to enable
    trace: process.env.WALLABY_TRACE === 'true',

    env: {
      type: 'node',
      runner: 'node',
      // Add Node.js flags for better Vitest compatibility
      params: {
        runner: '--experimental-vm-modules'
      }
    },

    // Optimized worker configuration for modern systems
    workers: {
      initial: 1, // Conservative for stability
      regular: 1, // Single worker to avoid conflicts
    },

    // Reduced console noise for ADHD-friendly experience
    maxConsoleMessagesPerTest: 50,

    // Comprehensive file patterns for monorepo
    files: [
      // Source files
      'packages/**/*.{ts,tsx}',
      '!packages/**/*.{test,spec}.{ts,tsx}',
      
      // Configuration files
      'package.json',
      'packages/*/package.json',
      'tsconfig*.json',
      'vitest*.config.{ts,js}',
      'vitest.shared.ts',
      
      // Exclude build outputs and dependencies
      '!**/node_modules/**',
      '!**/dist/**',
      '!**/build/**',
      '!**/coverage/**'
    ],

    tests: [
      // Root tests
      'tests/**/*.{test,spec}.{ts,tsx}',
      // Package tests
      'packages/**/*.{test,spec}.{ts,tsx}',
      
      // Exclusions
      '!**/node_modules/**',
      '!**/dist/**',
      '!**/build/**'
    ],

    // Hints for better processing
    hints: {
      // Disable ignoreCoverage since we're using Vitest coverage
      ignoreCoverage: /ignore file coverage/
    }
  }
}