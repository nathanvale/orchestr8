import { FlatCompat } from '@eslint/eslintrc'
import { reactConfig } from './react.js'
import { tsStrictConfig } from './ts-strict.js'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

export const nextConfig = [
  ...reactConfig,
  ...tsStrictConfig,
  // Next.js specific configurations using compatibility layer
  ...compat.config({
    extends: ['next/core-web-vitals', 'next/typescript'],
    settings: {
      next: {
        rootDir: './',
      },
    },
  }),
  {
    rules: {
      // Next.js specific optimizations
      '@next/next/no-html-link-for-pages': 'off', // App Router doesn't use pages directory
      '@next/next/no-img-element': 'error', // Enforce next/image usage
      '@next/next/no-page-custom-font': 'warn', // Prefer next/font

      // Relax some strict rules for Next.js components
      '@typescript-eslint/explicit-function-return-type': 'off', // Next.js components often infer return types
      '@typescript-eslint/no-explicit-any': 'warn', // Next.js types sometimes require any
    },
  },
]

export default nextConfig
