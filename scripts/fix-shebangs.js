#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const cliPath = resolve(__dirname, '../packages/cli/dist/index.js')

try {
  const content = readFileSync(cliPath, 'utf8')
  
  if (!content.startsWith('#!/usr/bin/env node')) {
    const updatedContent = `#!/usr/bin/env node\n${content}`
    writeFileSync(cliPath, updatedContent)
    console.log('✅ Added shebang to CLI binary')
  } else {
    console.log('✅ Shebang already present in CLI binary')
  }
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('⚠️  CLI not built yet - run pnpm build first')
  } else {
    console.error('❌ Error fixing shebang:', error)
    process.exit(1)
  }
}