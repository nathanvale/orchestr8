import { testsConfig } from '@template/eslint-config/tests'
import { tsStrictConfig } from '@template/eslint-config/ts-strict'

export default [
  // Server app strict TypeScript configuration
  ...tsStrictConfig,

  // Test configuration
  ...testsConfig,

  // Server-specific ignores
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
]
