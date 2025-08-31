import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
  // import.meta.dirname is available after Node.js v20.11.0
  baseDirectory: import.meta.dirname,
})

const eslintConfig = [
  // Global ignores for Next.js generated files
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'node_modules/**',
      'coverage/**',
      '.turbo/**',
    ],
  },

  // Extend Next.js ESLint configurations
  ...compat.config({
    extends: ['next/core-web-vitals', 'next/typescript'],
    settings: {
      next: {
        rootDir: './', // Use relative path since we're in apps/web
      },
    },
    rules: {
      // Disable pages-specific rules since we're using App Router
      '@next/next/no-html-link-for-pages': 'off', // App Router doesn't use pages directory
    },
  }),

  // Next.js specific rules and overrides
  {
    rules: {
      // Next.js specific optimizations
      '@next/next/no-img-element': 'error', // Enforce next/image usage
      '@next/next/no-page-custom-font': 'warn', // Prefer next/font

      // Disable conflicting rules with our root config
      '@typescript-eslint/explicit-function-return-type': 'off', // Next.js components often infer return types
      '@typescript-eslint/no-explicit-any': 'warn', // Next.js types sometimes require any
      '@typescript-eslint/triple-slash-reference': 'off', // Next.js uses triple-slash references
    },
  },
]

export default eslintConfig
