import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Build once before all tests
export default async function setup() {
  const packageRoot = path.resolve(__dirname, '../..')
  const distDir = path.join(packageRoot, 'dist')

  // Check if dist exists - it should be built by Turborepo's dependency chain
  if (!existsSync(distDir)) {
    // If running outside of Turborepo, build the package
    if (!process.env.TURBO_HASH) {
      console.log('Building package for tests (not in Turborepo context)...')
      execSync('pnpm build', {
        cwd: packageRoot,
        stdio: 'inherit',
      })
    } else {
      throw new Error(
        'dist directory does not exist, but we are in Turborepo context. ' +
          'The build task should have run before test:build due to the dependency chain.',
      )
    }
  } else {
    console.log('Using existing dist folder for tests')
  }
}
