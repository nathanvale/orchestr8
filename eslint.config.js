// Root ESLint configuration - P2.2 Security Rule Separation
import { baseConfig } from '@template/eslint-config/base'
import { calibratedConfig } from '@template/eslint-config/calibrated'
import { declarationFilesConfig } from '@template/eslint-config/declaration-files'
import { securityConfig } from '@template/eslint-config/security'
import { testsConfig } from '@template/eslint-config/tests'

const eslintProfile = process.env.ESLINT_PROFILE ?? 'dev'

export default [
  // P2.1 & P2.3 - Enhanced ignores for generated files
  {
    ignores: [
      'dist/**',
      'dist-node/**',
      'dist-types/**',
      'build/**',
      'coverage/**',
      'node_modules/**',
      '.changeset/**',
      'packages/*/dist/**',
      'apps/*/dist/**',
      '~/**',
      '*.config.js',
      '.size-limit.js',
      'runtime.test.ts',
      // P2.3 - Exclude generated Next.js files from main linting
      'apps/web/.next/**',
      'apps/*/next-env.d.ts',
      // P2.1 - Exclude generated declaration files (but lint handwritten ones)
      '**/dist/**/*.d.ts',
      '**/dist-types/**/*.d.ts',
    ],
  },

  // Base config for all profiles (fast, essential rules only)
  ...baseConfig,

  // P2.2 - Conditional rule loading based on ESLINT_PROFILE
  // dev (default): Fast local development with essential rules only
  // security: Comprehensive security analysis with all rules
  // ci: Legacy support for calibrated rules
  ...(eslintProfile === 'security' ? securityConfig : []),
  ...(eslintProfile === 'ci' ? calibratedConfig : []),

  // P2.3 - Selective declaration file linting
  ...declarationFilesConfig,

  // Test configuration
  ...testsConfig,

  // Root-specific file targeting
  {
    files: ['scripts/**/*.ts', '*.{js,ts,mjs}', 'commitlint.config.mjs'],
  },
]
