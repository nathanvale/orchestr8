import security from 'eslint-plugin-security'
import sonarjs from 'eslint-plugin-sonarjs'
import unicorn from 'eslint-plugin-unicorn'

export const ciDeepConfig = [
  {
    plugins: { sonarjs, security, unicorn },
    rules: {
      // Security Rules
      'security/detect-object-injection': 'warn', // Array access triggers this incorrectly
      'security/detect-non-literal-fs-filename': 'warn', // Dynamic paths are sometimes needed
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',

      // Code Quality Rules
      'sonarjs/cognitive-complexity': ['error', 20], // Higher threshold for real-world complexity
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }], // Catches repeated magic strings
      'sonarjs/no-identical-functions': 'error',

      // ADHD-Friendly Rules (enforce simplicity with pragmatic limits)
      'max-lines-per-function': [
        'error',
        {
          max: 75, // Allows setup/config code while preventing sprawl
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'complexity': ['error', 15], // Balanced for real algorithms without encouraging spaghetti
      'max-depth': ['error', 3], // Strict nesting limit preserves readability
      'max-nested-callbacks': ['error', 3], // Prevents callback hell in async code
      'max-params': ['error', 4], // Forces object params for complex APIs
      'max-statements': ['error', 15], // Encourages single-purpose functions

      // Unicorn Best Practices
      'unicorn/no-array-for-each': 'error',
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/prefer-top-level-await': 'error',
      'unicorn/no-process-exit': 'error',

      // Console Management
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error', 'info', 'table', 'time', 'timeEnd'],
        },
      ],
      'no-debugger': 'error',
    },
  },
]

export default ciDeepConfig
