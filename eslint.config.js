import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import securityPlugin from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import vitest from 'eslint-plugin-vitest';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Global ignores first
  {
    ignores: [
      'dist/**',
      'dist-node/**',
      'dist-types/**',
      'build/**',
      'coverage/**',
      'node_modules/**',
      '**/*.d.ts',
      '.changeset/**',
      '~/**',
      '.bun/**',
      '*.config.js',
      '.size-limit.js',
    ],
  },

  // Base configurations
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettierConfig,

  // Main configuration for TypeScript files
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'security': securityPlugin,
      'sonarjs': sonarjs,
      'unicorn': unicorn,
    },

    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 2024,
        sourceType: 'module',
      },
      globals: {
        Bun: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },

    rules: {
      // TypeScript Strict Rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],

      // Security Rules
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',

      // Code Quality Rules
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }],
      'sonarjs/no-identical-functions': 'error',

      // ADHD-Friendly Rules (enforce simplicity)
      'max-lines-per-function': [
        'error',
        {
          max: 50,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'complexity': ['error', 10],
      'max-depth': ['error', 3],
      'max-nested-callbacks': ['error', 3],
      'max-params': ['error', 4],
      'max-statements': ['error', 15],

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

  // Relaxed rules for test files and config
  {
    files: [
      '**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/**/*',
      'vitest.setup.tsx',
      'vitest.config.ts',
      'wallaby.mjs',
    ],
    plugins: {
      vitest,
    },
    rules: {
      // Vitest specific rules
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-focused-tests': 'error',
      'vitest/no-identical-title': 'error',
      'vitest/prefer-to-have-length': 'warn',
      'vitest/valid-expect': 'error',
      'vitest/consistent-test-it': ['error', { fn: 'test' }],
      // Relax strict rules for tests
      '@typescript-eslint/no-explicit-any': 'off', // Tests often mock with any
      '@typescript-eslint/no-unsafe-assignment': 'off', // Mock assignments
      '@typescript-eslint/no-unsafe-call': 'off', // Mock function calls
      '@typescript-eslint/no-unsafe-member-access': 'off', // Mock property access
      '@typescript-eslint/no-unsafe-return': 'off', // Mock returns
      '@typescript-eslint/no-unsafe-argument': 'off', // Mock arguments
      '@typescript-eslint/restrict-template-expressions': 'off', // Test descriptions
      '@typescript-eslint/no-unnecessary-condition': 'off', // Test assertions
      '@typescript-eslint/strict-boolean-expressions': 'off', // Test conditions
      '@typescript-eslint/no-empty-function': 'off', // Mock functions
      '@typescript-eslint/no-confusing-void-expression': 'off', // Test shortcuts
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': false,
          'ts-nocheck': false,
          'ts-check': false,
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off', // Test functions
      'max-lines-per-function': ['error', { max: 200 }], // Tests can be longer
      'max-nested-callbacks': ['error', 5], // Tests have more nesting
      'max-statements': ['error', 50], // Tests have more statements
      'sonarjs/cognitive-complexity': ['error', 30], // Tests can be complex
      'no-console': 'off', // Allow console.log in tests for debugging
    },
  },

  // Separate config for configuration files (no type checking)
  {
    files: ['**/*.config.js', '**/*.config.mjs', 'eslint.config.js', 'commitlint.config.mjs'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
      },
    },
    rules: {
      // Basic ESLint rules only for config files
      'no-console': 'off',
      'no-debugger': 'error',
    },
  },
);
