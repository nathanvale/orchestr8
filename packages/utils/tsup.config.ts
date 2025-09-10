import { createTsupConfig } from '../../tooling/build/tsup.base.js'

export default createTsupConfig({
  entry: ['src/index.ts', 'src/number-utils.ts', 'src/path-utils.ts', 'src/test-utils.tsx'],
})
