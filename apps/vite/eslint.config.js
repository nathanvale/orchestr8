import { reactConfig } from '@template/eslint-config/react'
import { testsConfig } from '@template/eslint-config/tests'
import { tsStrictConfig } from '@template/eslint-config/ts-strict'

export default [
  // React app configuration with TypeScript
  ...reactConfig,
  ...tsStrictConfig,

  // Test configuration
  ...testsConfig,

  // App-specific ignores
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
]
