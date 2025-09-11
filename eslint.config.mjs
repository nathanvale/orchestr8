// Single source of truth for ESLint configuration
// ADHD-optimized: One config to rule them all, minimal cognitive load

import js from '@eslint/js'
import typescript from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import turbo from 'eslint-plugin-turbo'

export default [
  // Ignore patterns - single source of truth
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/.next/**',
      '**/out/**',
      '**/node_modules/**',
      '**/.pnpm-store/**',
      '**/*.config.{js,mjs,cjs,ts}', // Ignore all config files
      '**/vite.config.ts',
      '**/next.config.mjs',
      '**/wallaby.cjs', // Ignore Wallaby.js config
      '**/*.generated.*',
      '**/.eslintcache',
      '**/*.tsbuildinfo',
    ],
  },

  // Base JavaScript rules
  js.configs.recommended,

  // TypeScript rules
  ...typescript.configs.recommended,

  // React rules for apps
  {
    files: ['apps/**/*.{jsx,tsx}', 'packages/**/*.{jsx,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // Turbo rules for monorepo
  {
    plugins: {
      turbo,
    },
    rules: {
      'turbo/no-undeclared-env-vars': 'off', // We handle this in turbo.json
    },
  },

  // Global rule overrides for ADHD-friendly development
  {
    rules: {
      // Reduce noise - warnings instead of errors for non-critical issues
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      // Turn off overly strict rules that add cognitive load
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // Allow common patterns
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-var-requires': 'off', // Sometimes needed
      'no-console': 'off', // We need console for debugging

      // Enforce consistency without being pedantic
      'prefer-const': 'warn',
      'no-var': 'error',
      'eqeqeq': ['warn', 'smart'],
    },
  },

  // Node.js script overrides
  {
    files: ['scripts/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
  },

  // Test file overrides
  {
    files: [
      '**/*.test.{js,ts,jsx,tsx}',
      '**/*.spec.{js,ts,jsx,tsx}',
      '**/tests/**/*.{js,ts,jsx,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'max-lines-per-function': ['error', { max: 500, skipBlankLines: true, skipComments: true }], // Tests can be longer but still have limits
    },
  },
  {
    files: ['packages/quality-check/**/*.{ts,tsx,js,jsx}'],
    ignores: ['**/*.test.{js,ts,jsx,tsx}', '**/*.spec.{js,ts,jsx,tsx}'],
    rules: {
      // Stricter rules for quality-check source files (not tests)
      'max-lines-per-function': ['error', { max: 150, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['packages/quality-check/**/tests/**/*.{ts,tsx,js,jsx}'],
    rules: {
      // Allow longer functions in quality-check tests
      'max-lines-per-function': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
    },
  },
]
