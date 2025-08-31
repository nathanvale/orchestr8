import security from 'eslint-plugin-security'
import sonarjs from 'eslint-plugin-sonarjs'

/**
 * P2.2 - Security-Focused Rules (Opt-in)
 *
 * Comprehensive security analysis with expensive rules separated from
 * default development linting for optimal local development performance.
 */
export const securityConfig = [
  {
    plugins: { sonarjs, security },
    rules: {
      // Security Plugin Rules - Comprehensive Analysis
      'security/detect-object-injection': 'error',
      'security/detect-non-literal-fs-filename': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'error',

      // TypeScript Rules Requiring Type Information
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',

      // SonarJS Quality Rules - Deep Analysis
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/no-collection-size-mischeck': 'error',
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }],
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-element-overwrite': 'error',
      'sonarjs/no-empty-collection': 'error',
      'sonarjs/no-extra-arguments': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-inverted-boolean-check': 'error',
      'sonarjs/no-one-iteration-loop': 'error',
      'sonarjs/no-redundant-boolean': 'error',
      'sonarjs/no-redundant-jump': 'error',
      'sonarjs/no-same-line-conditional': 'error',
      'sonarjs/no-small-switch': 'error',
      'sonarjs/no-unused-collection': 'error',
      'sonarjs/no-use-of-empty-return-value': 'error',
      'sonarjs/no-useless-catch': 'error',
      'sonarjs/prefer-immediate-return': 'error',
      'sonarjs/prefer-object-literal': 'error',
      'sonarjs/prefer-single-boolean-return': 'error',
      'sonarjs/prefer-while': 'error',

      // Complex Code Quality Rules (Expensive to Analyze)
      'max-lines-per-function': [
        'error',
        {
          max: 85,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'complexity': ['warn', 25],
      'max-depth': ['error', 3],
      'max-nested-callbacks': ['error', 3],
      'max-params': ['error', 4],
      'max-statements': ['error', 20],
      'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
    },
  },

  // Special rules for large script files (security scans can handle complexity)
  {
    files: ['scripts/**/*.ts'],
    rules: {
      'max-lines-per-function': [
        'warn',
        {
          max: 200, // Higher limit for security/CLI scripts
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'complexity': ['warn', 50],
      'sonarjs/cognitive-complexity': ['warn', 30],
      'max-statements': ['warn', 50],
      'max-lines': ['warn', { max: 1000, skipBlankLines: true, skipComments: true }],

      // Allow more flexibility for security scanning scripts
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-child-process': 'off',
    },
  },
]

export default securityConfig
