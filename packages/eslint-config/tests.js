import vitest from 'eslint-plugin-vitest'

export const testsConfig = [
  {
    files: [
      '**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/**/*',
      'vitest.setup.tsx',
      'vitest.config.ts',
      'wallaby.mjs',
    ],
    plugins: { vitest },
    rules: {
      // Vitest specific rules
      'vitest/no-disabled-tests': 'error',
      'vitest/no-focused-tests': 'error',
      'vitest/no-identical-title': 'error',
      'vitest/prefer-to-have-length': 'warn',
      'vitest/valid-expect': 'error',
      'vitest/consistent-test-it': ['error', { fn: 'test' }],

      // Relaxed rules for test files (from original config)
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': false,
          'ts-nocheck': false,
          'ts-check': false,
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',

      // ADHD-friendly complexity limits for tests
      'max-lines-per-function': ['error', { max: 300 }],
      'max-nested-callbacks': ['error', 5],
      'max-statements': ['error', 50],
      'complexity': ['error', 30], // Use standard complexity rule instead of sonarjs
      'no-console': 'off',
    },
  },
]

export default testsConfig
