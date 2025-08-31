import { testsConfig } from '@template/eslint-config/tests'
import { tsStrictConfig } from '@template/eslint-config/ts-strict'

export default [
  // Utility package strict TypeScript configuration
  ...tsStrictConfig,

  // Test configuration
  ...testsConfig,

  // Package-specific ignores
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
]
