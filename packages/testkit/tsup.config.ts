import { createTsupConfig } from '../../tooling/build/tsup.base.js'

export default createTsupConfig({
  entry: [
    'src/index.ts',
    'src/register.ts',
    'src/config/index.ts',
    'src/config/vitest.base.ts',
    'src/msw/index.ts',
    'src/containers/index.ts',
    'src/convex/index.ts',
    'src/env/index.ts',
    'src/utils/index.ts',
    'src/fs/index.ts',
  ],
})
