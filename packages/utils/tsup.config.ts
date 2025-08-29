import { createPackageConfig } from '../../tooling/build/tsup.base'

export default createPackageConfig({
  entry: {
    index: 'src/index.ts',
    'number-utils': 'src/number-utils.ts',
    'path-utils': 'src/path-utils.ts',
    'test-utils': 'src/test-utils.tsx'
  },
  jsx: true,
  platform: 'neutral',
  external: ['react', 'react-dom', '@testing-library/react']
})