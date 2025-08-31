import { baseConfig } from './base.js'

export const reactConfig = [
  ...baseConfig,
  // React-specific rules can be added here when needed
  // Currently just extending base config for future React plugin integration
  {
    files: ['**/*.{jsx,tsx}'],
    languageOptions: {
      globals: {
        React: 'readonly',
        JSX: 'readonly',
      },
    },
  },
]

export default reactConfig
