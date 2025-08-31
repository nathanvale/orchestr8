import { createPackageConfig } from '../../tooling/build/tsup.base'

export default createPackageConfig({
  entry: {
    'index': 'src/index.ts',
    'number-utils': 'src/number-utils.ts', // Matches "./number" export subpath
    'path-utils': 'src/path-utils.ts', // Matches "./path" export subpath
    'test-utils': 'src/test-utils.tsx', // Matches "./test" export subpath
  },
  jsx: true,
  platform: 'browser', // Changed from 'neutral' to 'browser' due to React dependency
  external: ['react', 'react-dom', '@testing-library/react'],
  dts: false, // Use separate tsc step for declarations to avoid TS6307 issues
  // NOTE: If declarations still fail to emit, run a separate tsc --emitDeclarationOnly step.
})
