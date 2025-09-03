import { createTsupConfig } from '../../tooling/build/tsup.base.js'

export default createTsupConfig({
  entry: [
    'src/index.ts',
    'src/cache/index.ts',
    'src/providers/index.ts',
    'src/logging/index.ts',
    'src/audio/index.ts',
  ],
})
