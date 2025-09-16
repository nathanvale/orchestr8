import baseConfig from '../../eslint.config.mjs'

export default [
  ...baseConfig,
  {
    files: ['src/**/*.{js,ts}'],
    rules: {
      // API-specific rules aligned with JavaScript style guidelines
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error', // Stricter for API
      'eqeqeq': ['error', 'always', { null: 'ignore' }], // Use === except for null checks
      'no-var': 'error', // Never use var
      'prefer-const': 'error', // Use const by default
      'max-lines-per-function': [
        'error',
        {
          max: 150,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      // JavaScript style enforcement
      'quotes': ['error', 'single', { avoidEscape: true }], // Single quotes
      'semi': ['error', 'always'], // Always require semicolons
      'indent': ['error', 2], // 2-space indentation
      'comma-dangle': ['error', 'always-multiline'], // Trailing commas in multiline
      'object-curly-spacing': ['error', 'always'], // Space inside braces
      'array-bracket-spacing': ['error', 'never'], // No space inside brackets
      'keyword-spacing': ['error', { before: true, after: true }], // Space around keywords
      'space-before-function-paren': ['error', 'never'], // No space before function parens
      'space-infix-ops': 'error', // Space around operators
      'arrow-spacing': ['error', { before: true, after: true }], // Space around arrow functions
    },
  },
]
