import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import securityPlugin from 'eslint-plugin-security'
import sonarjs from 'eslint-plugin-sonarjs'
import unicorn from 'eslint-plugin-unicorn'
import vitest from 'eslint-plugin-vitest'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Why: Global ignores prevent linting generated/external files
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
      'packages/*/dist/**',
      'apps/*/dist/**',
      '~/**',
      '.bun/**',
      '*.config.js',
      '.size-limit.js',
      'runtime.test.ts', // Old orphaned test file - not part of monorepo structure
    ],
  },

  // Why: Layered configs provide progressive enhancement of code quality
  js.configs.recommended, // Why: Catch common JavaScript errors
  ...tseslint.configs.strictTypeChecked, // Why: Maximum type safety catches bugs early
  ...tseslint.configs.stylisticTypeChecked, // Why: Consistent code style across team
  prettierConfig, // Why: Disable style rules that conflict with Prettier

  // Why: TypeScript-specific rules and security/quality plugins
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin, // Why: TypeScript-aware linting
      'security': securityPlugin, // Why: Catch security vulnerabilities early
      'sonarjs': sonarjs, // Why: Detect code smells and complexity issues
      'unicorn': unicorn, // Why: Modern JavaScript best practices
    },

    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // Use explicit project array for monorepo with targeted include patterns for performance
        project: true, // Auto-detect tsconfig files
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 2024,
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },

    rules: {
      // TypeScript Strict Rules
      // Why: Unused vars are dead code that increase bundle size
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_', // Why: Allow _ prefix for intentionally unused
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Why: Explicit return types improve readability and catch type errors
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true, // Why: Simple expressions don't need annotation
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error', // Why: 'any' defeats type safety
      '@typescript-eslint/no-non-null-assertion': 'error', // Why: ! operator hides null bugs
      '@typescript-eslint/strict-boolean-expressions': 'error', // Why: Prevent truthy/falsy bugs
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
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true, // Why: Numbers are safe and common in templates
          allowBoolean: false,
          allowAny: false,
          allowNullish: false,
          allowRegExp: false,
        },
      ],

      // Security Rules
      // Why: Warn (not error) because these have many false positives
      'security/detect-object-injection': 'warn', // Why: Array access triggers this incorrectly
      'security/detect-non-literal-fs-filename': 'warn', // Why: Dynamic paths are sometimes needed
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',

      // Code Quality Rules
      // Cognitive complexity calibrated to 20 to reduce noise in legitimate integration code
      // while still maintaining ADHD guard rails for readability
      'sonarjs/cognitive-complexity': ['error', 20], // Higher threshold for real-world complexity
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }], // Catches repeated magic strings
      'sonarjs/no-identical-functions': 'error',

      // ADHD-Friendly Rules (enforce simplicity with pragmatic limits)
      // These thresholds balance cognitive load reduction with real-world needs:
      // - Functions can be longer (75 lines) for setup/configuration code
      // - Complexity raised to 15 to accommodate legitimate business logic
      // - Maintain strict limits on nesting and parameters for readability
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

  // Relaxed rules for test files and config
  {
    files: [
      '**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/**/*',
      'vitest.setup.tsx',
      'vitest.config.ts',
      'wallaby.mjs',
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // Use Vitest tsconfig for test files
        project: './tsconfig.vitest.json',
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 2024,
        sourceType: 'module',
      },
    },
    plugins: {
      vitest,
    },
    rules: {
      // Vitest specific rules
      'vitest/no-disabled-tests': 'error', // Enforce: no .skip or .todo tests in CI
      'vitest/no-focused-tests': 'error', // Enforce: no .only tests in CI
      'vitest/no-identical-title': 'error',
      'vitest/prefer-to-have-length': 'warn',
      'vitest/valid-expect': 'error',
      'vitest/consistent-test-it': ['error', { fn: 'test' }], // Enforce: use 'test' not 'it'
      // Test ergonomics: allow referencing vi.fn mocks directly in expectations
      '@typescript-eslint/unbound-method': 'off',
      // Relax strict rules for tests
      '@typescript-eslint/no-explicit-any': 'off', // Mocks and test data often use any
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
      '@typescript-eslint/explicit-function-return-type': 'off', // Test functions rarely need explicit returns
      'max-lines-per-function': ['error', { max: 300 }], // Integration tests need more space
      'max-nested-callbacks': ['error', 5], // describe/it/expect nesting is normal
      'max-statements': ['error', 50], // Setup/teardown/assertions add up
      'sonarjs/cognitive-complexity': ['error', 30], // Test scenarios can be complex
      'no-console': 'off', // console.log is essential for test debugging
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
)
