#!/usr/bin/env node
/* eslint-env node */

/**
 * Fix shebangs in compiled bin files
 * Replaces tsx shebangs with node shebangs for production
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '..')
const binDir = path.join(packageRoot, 'dist', 'bin')

async function fixShebangs() {
  try {
    // Check if bin directory exists
    const binDirExists = await fs
      .stat(binDir)
      .then(() => true)
      .catch(() => false)

    if (!binDirExists) {
      console.log('No dist/bin directory found, skipping shebang fix')
      return
    }

    // Read all files in bin directory
    const files = await fs.readdir(binDir)
    const jsFiles = files.filter((f) => f.endsWith('.js'))

    for (const file of jsFiles) {
      const filePath = path.join(binDir, file)
      let content = await fs.readFile(filePath, 'utf8')

      // Replace tsx shebang with node shebang
      if (content.startsWith('#!/usr/bin/env tsx')) {
        content = content.replace('#!/usr/bin/env tsx', '#!/usr/bin/env node')
        await fs.writeFile(filePath, content, 'utf8')
        console.log(`Fixed shebang in ${file}`)
      } else if (!content.startsWith('#!/usr/bin/env node')) {
        // Add shebang if missing
        content = `#!/usr/bin/env node\n${content}`
        await fs.writeFile(filePath, content, 'utf8')
        console.log(`Added shebang to ${file}`)
      }

      // Make file executable on Unix systems
      if (process.platform !== 'win32') {
        await fs.chmod(filePath, 0o755)
        console.log(`Made ${file} executable`)
      }
    }

    console.log('Shebang fix complete')
  } catch (error) {
    console.error('Error fixing shebangs:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixShebangs()
}
