import { createTsupConfig } from '../../tooling/build/tsup.base.js'

export default createTsupConfig({
  entry: ['src/index.ts', 'src/remote-cache.ts', 'src/utils/jwt.ts'],
})
