import { nextConfig } from '@template/eslint-config/next'
import { testsConfig } from '@template/eslint-config/tests'

const eslintConfig = [
  // Global ignores for Next.js generated files
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'node_modules/**',
      'coverage/**',
      '.turbo/**',
    ],
  },

  // Next.js configuration with React and TypeScript
  ...nextConfig,

  // Test configuration
  ...testsConfig,
]

export default eslintConfig
