import { createPackageConfig } from '../../tooling/build/tsup.base'

export default createPackageConfig({
  entry: {
    index: 'src/index.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  platform: 'node',
  target: 'node20',
  external: ['@orchestr8/logger', '@template/utils', 'node:http']
})