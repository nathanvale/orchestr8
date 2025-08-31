import security from 'eslint-plugin-security'
import sonarjs from 'eslint-plugin-sonarjs'
import unicorn from 'eslint-plugin-unicorn'

/**
 * P2.1 - Calibrated Quality Rules
 *
 * Data-driven rule calibration based on actual codebase metrics.
 * Balances strictness with practical development patterns.
 */
export const calibratedConfig = [
  {
    plugins: { sonarjs, security, unicorn },
    rules: {
      // Security Rules - keep existing values
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',

      // P2.1 - Calibrated Complexity Rules
      // Based on analysis: P95 function length is 71 lines, allowing 85 for growth
      'max-lines-per-function': [
        'error',
        {
          max: 85, // Increased from 75 based on actual usage patterns
          skipBlankLines: true,
          skipComments: true,
        },
      ],

      // Cyclomatic complexity calibrated for template scripts
      'complexity': ['warn', 25], // Increased from 15, made warning for large scripts

      // Cognitive complexity remains strict for readability
      'sonarjs/cognitive-complexity': ['error', 15], // Decreased from 20 for better readability

      // Keep strict limits for maintainability
      'max-depth': ['error', 3],
      'max-nested-callbacks': ['error', 3],
      'max-params': ['error', 4],
      'max-statements': ['error', 20], // Increased from 15 for config files

      // String duplication - more lenient for template code
      'sonarjs/no-duplicate-string': ['warn', { threshold: 4 }], // Increased from 3
      'sonarjs/no-identical-functions': 'warn', // Made warning vs error

      // Unicorn Best Practices - keep strict
      'unicorn/no-array-for-each': 'error',
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/prefer-top-level-await': 'error',
      'unicorn/no-process-exit': 'error',

      // Console Management - allow more in development tools
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error', 'info', 'table', 'time', 'timeEnd', 'log'],
        },
      ],
      'no-debugger': 'error',
    },
  },

  // Special rules for large script files
  {
    files: ['scripts/**/*.ts'],
    rules: {
      'max-lines-per-function': [
        'warn', // Warning instead of error for scripts
        {
          max: 150, // Higher limit for CLI scripts and tools
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'complexity': ['warn', 35], // Higher limit for script complexity
      'sonarjs/cognitive-complexity': ['warn', 25], // Relaxed for CLI tools
      'max-statements': ['warn', 30], // Higher for configuration logic
    },
  },
]

export default calibratedConfig
