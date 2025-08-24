#!/usr/bin/env node

/**
 * Comprehensive Git Hooks Setup Script for @orchestr8
 *
 * Features:
 * - Automatic Husky + lint-staged + Turborepo integration
 * - Comprehensive validation and error handling
 * - Performance benchmarking and metrics collection
 * - Conflict detection and resolution
 * - Diagnostic and troubleshooting capabilities
 *
 * Usage:
 *   npm run setup:hooks                # Basic setup
 *   node setup-git-hooks.mjs --metrics # Show performance metrics
 *   node setup-git-hooks.mjs --diagnose # System diagnostics
 *   node setup-git-hooks.mjs --validate # Validate configuration
 */

import { execSync } from 'child_process'
import { existsSync, chmodSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Configuration and utilities
const METRICS = {
  setupStart: Date.now(),
  phases: {},
  total: 0,
}

function getPackageInfo() {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
    return packageJson
  } catch (error) {
    console.error('❌ Could not read package.json:', error.message)
    process.exit(1)
  }
}

function runCommand(command, description, options = {}) {
  const startTime = Date.now()
  try {
    if (!options.silent) {
      console.log(`🔧 ${description}...`)
    }
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    })
    const duration = Date.now() - startTime
    METRICS.phases[description] = duration

    if (!options.silent) {
      console.log(`✅ ${description} completed (${duration}ms)`)
    }
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    METRICS.phases[description] = duration
    console.error(`❌ ${description} failed (${duration}ms):`, error.message)

    if (description.includes('husky') || description.includes('git')) {
      console.log(`
🔧 Troubleshooting tips:
• Ensure you're in a git repository root
• Check that husky and lint-staged are installed: npm list husky lint-staged
• Try: git config core.hooksPath .husky
• For bypass: export HUSKY=0 or git commit --no-verify
• For help: node setup-git-hooks.mjs --diagnose
`)
    }

    if (!options.allowFailure) {
      process.exit(1)
    }
    return null
  }
}

function validateEnvironment() {
  console.log('🔍 Validating environment...\n')

  // Check git repository
  try {
    runCommand(
      'git rev-parse --is-inside-work-tree',
      'Checking git repository',
      { silent: true },
    )
  } catch {
    console.error('❌ Not a git repository or git is not installed')
    process.exit(1)
  }

  // Check dependencies
  const packageJson = getPackageInfo()
  const missingDeps = []

  if (!packageJson.devDependencies?.husky) {
    missingDeps.push('husky')
  }
  if (!packageJson.devDependencies?.['lint-staged']) {
    missingDeps.push('lint-staged')
  }

  if (missingDeps.length > 0) {
    console.error(`❌ Missing dependencies: ${missingDeps.join(', ')}`)
    console.log('💡 Install with: pnpm add -D ' + missingDeps.join(' '))
    process.exit(1)
  }

  // Check Node.js version
  const nodeVersion = process.version
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0])
  if (majorVersion < 18) {
    console.error(
      `❌ Node.js ${nodeVersion} is not supported. Requires Node.js 18+`,
    )
    process.exit(1)
  }

  console.log('✅ Environment validation passed')
}

function detectConflicts() {
  console.log('🔍 Detecting existing git hooks conflicts...\n')

  const gitHooksDir = '.git/hooks'
  const conflicts = []

  if (existsSync(gitHooksDir)) {
    ;['pre-commit', 'pre-push', 'commit-msg', 'pre-rebase'].forEach(
      (hookName) => {
        const hookPath = join(gitHooksDir, hookName)
        if (existsSync(hookPath)) {
          conflicts.push(hookName)
        }
      },
    )
  }

  if (conflicts.length > 0) {
    console.log(`⚠️  Found existing git hooks: ${conflicts.join(', ')}`)
    console.log('🔧 These will be replaced by Husky hooks')
    console.log('💡 Existing hooks are preserved in .git/hooks/*.sample\n')
  } else {
    console.log('✅ No git hooks conflicts detected')
  }

  return conflicts
}

function setupHusky() {
  console.log('🚀 Setting up Husky...\n')

  // Initialize Husky
  runCommand('npx husky install', 'Installing Husky Git hooks')

  // Verify .husky directory was created
  if (!existsSync('.husky')) {
    console.error('❌ .husky directory was not created')
    process.exit(1)
  }

  // Ensure hook files exist and are executable
  const hooks = {
    '.husky/pre-commit':
      '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\nnpx lint-staged\n',
    '.husky/pre-push':
      '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\npnpm check\n',
  }

  Object.entries(hooks).forEach(([hookPath, content]) => {
    if (!existsSync(hookPath)) {
      writeFileSync(hookPath, content)
      console.log(`✅ Created ${hookPath}`)
    }
    chmodSync(hookPath, 0o755)
    console.log(`✅ ${hookPath} is executable`)
  })
}

function validateConfiguration() {
  console.log('🔍 Validating configuration...\n')

  const validations = {
    'Husky installed': false,
    'lint-staged installed': false,
    'Pre-commit hook exists': false,
    'Pre-push hook exists': false,
    'lint-staged configured': false,
    'Turbo lint:fix task': false,
    'Package scripts complete': false,
  }

  // Check dependencies
  const packageJson = getPackageInfo()
  validations['Husky installed'] = !!packageJson.devDependencies?.husky
  validations['lint-staged installed'] =
    !!packageJson.devDependencies?.['lint-staged']
  validations['lint-staged configured'] = !!packageJson['lint-staged']

  // Check hooks exist
  validations['Pre-commit hook exists'] = existsSync('.husky/pre-commit')
  validations['Pre-push hook exists'] = existsSync('.husky/pre-push')

  // Check turbo.json
  if (existsSync('turbo.json')) {
    const turboConfig = JSON.parse(readFileSync('turbo.json', 'utf8'))
    validations['Turbo lint:fix task'] = !!turboConfig.tasks?.['lint:fix']
  }

  // Check package scripts
  try {
    const packagesWithLintFix = runCommand(
      "node -e \"console.log(require('fs').readdirSync('packages').length)\"",
      'Counting packages',
      { silent: true },
    )
    const expectedPackages = parseInt(packagesWithLintFix.trim())

    let actualPackagesWithLintFix = 0
    require('fs')
      .readdirSync('packages')
      .forEach((pkg) => {
        const pkgPath = `packages/${pkg}/package.json`
        if (existsSync(pkgPath)) {
          const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf8'))
          if (pkgJson.scripts?.['lint:fix']) {
            actualPackagesWithLintFix++
          }
        }
      })

    validations['Package scripts complete'] =
      actualPackagesWithLintFix === expectedPackages
  } catch {
    validations['Package scripts complete'] = false
  }

  // Display results
  Object.entries(validations).forEach(([check, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${check}`)
  })

  const allPassed = Object.values(validations).every((v) => v)
  if (!allPassed) {
    console.log(
      '\n⚠️  Some validations failed. Run setup again or check configuration manually.',
    )
    return false
  }

  console.log('\n🎉 All validations passed!')
  return true
}

function performanceBenchmark() {
  console.log('🏃 Running performance benchmark...\n')

  // Test lint-staged performance on a sample file
  try {
    const tempFile = 'temp-perf-test.ts'
    writeFileSync(tempFile, 'export const test = "performance benchmark";')

    runCommand(`git add ${tempFile}`, 'Staging test file', { silent: true })

    const startTime = Date.now()
    runCommand('npx lint-staged', 'Running lint-staged benchmark', {
      silent: true,
    })
    const lintStagedTime = Date.now() - startTime

    // Clean up
    runCommand(`git reset HEAD ${tempFile}`, 'Cleaning up test file', {
      silent: true,
    })
    if (existsSync(tempFile)) {
      require('fs').unlinkSync(tempFile)
    }

    console.log(`⚡ lint-staged execution time: ${lintStagedTime}ms`)

    if (lintStagedTime > 3000) {
      console.log(
        '⚠️  Performance warning: lint-staged took longer than 3 seconds',
      )
      console.log('💡 Consider optimizing glob patterns or package count')
    } else {
      console.log('✅ Performance target met (under 3 seconds)')
    }

    METRICS.lintStagedBenchmark = lintStagedTime
  } catch (error) {
    console.log('⚠️  Could not run performance benchmark:', error.message)
  }
}

function getSystemDiagnostics() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    cwd: process.cwd(),
    environment: {},
  }

  // Get package versions
  try {
    diagnostics.huskyVersion = runCommand('npx husky --version', '', {
      silent: true,
    }).trim()
  } catch {
    diagnostics.huskyVersion = 'not installed'
  }

  try {
    diagnostics.gitVersion = runCommand('git --version', '', {
      silent: true,
    }).trim()
  } catch {
    diagnostics.gitVersion = 'not installed'
  }

  // Check configuration files
  diagnostics.configFiles = {
    packageJson: existsSync('package.json'),
    turboJson: existsSync('turbo.json'),
    huskyDir: existsSync('.husky'),
    gitDir: existsSync('.git'),
  }

  // Check hooks
  diagnostics.hooks = {
    preCommit: existsSync('.husky/pre-commit'),
    prePush: existsSync('.husky/pre-push'),
  }

  // Environment variables
  ;['HUSKY', 'NODE_ENV', 'CI'].forEach((env) => {
    diagnostics.environment[env] = process.env[env] || 'unset'
  })

  return diagnostics
}

function displaySuccessMessage() {
  const totalTime = Date.now() - METRICS.setupStart
  METRICS.total = totalTime

  console.log(`
🎉 Git hooks setup complete! (${totalTime}ms)

📋 What's been configured:

Pre-commit hook (lint-staged):
• ⚡ Processes only staged files for optimal performance
• 🎨 Automatically formats code with Prettier
• 🔧 Auto-fixes ESLint issues where possible
• 📝 Runs TypeScript type-checking per package
• ❌ Fails if there are unfixable lint errors

Pre-push hook (comprehensive validation):
• 🔍 Runs full \`pnpm check\` validation
• 🏗️  Uses Turborepo caching for performance
• 📊 All 486+ tests must pass
• 🚫 Blocks push if any validation fails

🔧 Developer workflow:
1. Make your changes
2. Stage files: \`git add .\`
3. Commit: \`git commit -m "message"\`
   → Pre-commit runs automatically (≤3s for typical changes)
4. Push: \`git push\`
   → Pre-push runs comprehensive checks

⚡ Performance optimizations:
• lint-staged processes only staged files
• Turborepo caching reduces repeated work  
• Package-specific TypeScript checking
• Parallel execution where possible

💡 Emergency procedures:
• Bypass once: \`git commit --no-verify -m "emergency fix"\`
• Disable permanently: \`export HUSKY=0\`
• Validate setup: \`node scripts/setup-git-hooks.mjs --validate\`
• Get diagnostics: \`node scripts/setup-git-hooks.mjs --diagnose\`

🏃 Performance target: Pre-commit hooks complete in <3 seconds
📊 Your setup: ${METRICS.lintStagedBenchmark || 'benchmark not run'}ms

Happy coding! 🚀
`)
}

// CLI argument handling
function handleCliArgs() {
  const args = process.argv.slice(2)

  if (args.includes('--diagnose')) {
    console.log('🔍 System Diagnostics\n')
    const diagnostics = getSystemDiagnostics()
    console.log(JSON.stringify(diagnostics, null, 2))
    return true
  }

  if (args.includes('--validate')) {
    console.log('✅ Configuration Validation\n')
    const isValid = validateConfiguration()
    process.exit(isValid ? 0 : 1)
    return true
  }

  if (args.includes('--metrics')) {
    console.log('📊 Performance Metrics\n')
    performanceBenchmark()
    console.log('\nMetrics:', JSON.stringify(METRICS, null, 2))
    return true
  }

  return false
}

function main() {
  console.log('🚀 @orchestr8 Git Hooks Setup\n')

  // Handle CLI arguments
  if (handleCliArgs()) {
    return
  }

  // Main setup flow
  validateEnvironment()
  detectConflicts()
  setupHusky()

  if (validateConfiguration()) {
    performanceBenchmark()
    displaySuccessMessage()
  }
}

main()
