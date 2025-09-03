import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import turbo from 'eslint-plugin-turbo'
import tseslint from 'typescript-eslint'

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
    plugins: { turbo },
    rules: {
      'turbo/no-undeclared-env-vars': 'error',
    },
  },
]

export default baseConfig
