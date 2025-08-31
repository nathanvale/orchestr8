/**
 * P2.3 - Selective Declaration File Linting
 *
 * Targets only handwritten .d.ts files, excluding generated ones.
 * Uses simple rules that don't require type information.
 */
export const declarationFilesConfig = [
  {
    files: ['**/*.d.ts'],
    ignores: [
      // Generated declaration files
      '**/dist/**/*.d.ts',
      '**/dist-types/**/*.d.ts',
      '**/build/**/*.d.ts',
      '**/.next/**/*.d.ts',
      '**/node_modules/**/*.d.ts',
      // Common generated files
      '**/types/generated.d.ts',
      '**/types/schema.d.ts',
      '**/*-generated.d.ts',
      '**/*.generated.d.ts',
    ],
    rules: {
      // Basic quality rules that don't require type information
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': 'warn',
      'no-debugger': 'error',

      // Basic TypeScript rules (no type information required)
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
]

export default declarationFilesConfig
