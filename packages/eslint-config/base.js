import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import turbo from 'eslint-plugin-turbo'
import unicorn from 'eslint-plugin-unicorn'
import tseslint from 'typescript-eslint'

/**
 * P2.2 - Fast Development Base Config
 *
 * Lightweight, fast-running rules optimized for local development.
 * Security and complex analysis rules are moved to opt-in security config.
 */
export const baseConfig = [
  js.configs.recommended,
  prettier,
  // Lightweight TS (no project) for non-src files
  ...tseslint.configs.recommended.map((c) => ({
    ...c,
    languageOptions: {
      ...c.languageOptions,
      parserOptions: { project: false },
    },
  })),
  {
    plugins: { turbo, unicorn },
    rules: {
      // Turbo Rules
      'turbo/no-undeclared-env-vars': 'error',

      // Essential TypeScript Rules (Fast Analysis - No Type Information Required)
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Note: @typescript-eslint/no-floating-promises requires type information
      // It's moved to security config where proper TypeScript project setup exists

      // Essential JavaScript Rules (Fast Analysis)
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error', 'info'],
        },
      ],
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // Essential Unicorn Rules (Performance-Optimized Subset)
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/prefer-top-level-await': 'error',
      'unicorn/no-array-for-each': 'error',
      'unicorn/no-process-exit': 'error',
    },
  },
]

export default baseConfig
