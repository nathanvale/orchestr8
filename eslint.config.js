// Root ESLint configuration - minimal config for maintenance scripts only
import { baseConfig } from '@template/eslint-config/base'
import { ciDeepConfig } from '@template/eslint-config/ci-deep'
import { testsConfig } from '@template/eslint-config/tests'

export default [
  // Global ignores for generated/external files
  {
    ignores: [
      'dist/**',
      'dist-node/**',
      'dist-types/**',
      'build/**',
      'coverage/**',
      'node_modules/**',
      '**/*.d.ts',
      '.changeset/**',
      'packages/*/dist/**',
      'apps/*/dist/**',
      '~/**',
      '.bun/**',
      '*.config.js',
      '.size-limit.js',
      'runtime.test.ts', // Old orphaned test file - not part of monorepo structure
    ],
  },

  // Base config for root maintenance scripts & docs
  ...baseConfig,

  // CI deep profile for comprehensive checking
  ...(process.env.ESLINT_PROFILE === 'ci' ? ciDeepConfig : []),

  // Test configuration
  ...testsConfig,

  // Root-specific file targeting
  {
    files: ['scripts/**/*.ts', '*.{js,ts,mjs}', 'commitlint.config.mjs'],
  },
]
