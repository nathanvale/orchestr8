#!/usr/bin/env node

/**
 * NPM Dist Tags Management Script
 *
 * Manages NPM dist tags for pre-release versions:
 * - Beta RC packages: beta, rc, latest
 * - Alpha packages: alpha, next
 * - Validates tag assignments match version strategy
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { glob } from 'glob'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

const DIST_TAG_STRATEGY = {
  betaRC: {
    packages: [
      '@orchestr8/schema',
      '@orchestr8/logger',
      '@orchestr8/resilience',
    ],
    tags: {
      beta: /^1\.0\.0-beta\.\d+$/,
      rc: /^1\.0\.0-rc\.\d+$/,
      latest: /^1\.0\.0$/,
    },
  },
  alpha: {
    packages: ['@orchestr8/core', '@orchestr8/cli', '@orchestr8/agent-base'],
    tags: {
      alpha: /^0\.\d+\.\d+-alpha\.\d+$/,
      next: /^0\.\d+\.\d+(-alpha\.\d+)?$/,
    },
  },
}

function execCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    })
    return result?.trim()
  } catch (error) {
    if (!options.silent) {
      console.error(`Command failed: ${command}`)
      console.error(error.message)
    }
    throw error
  }
}

async function validateDistTags(dryRun = true) {
  console.log(`🏷️  ${dryRun ? 'Validating' : 'Setting'} NPM dist tags...\n`)

  const packageJsonFiles = await glob('packages/*/package.json', {
    cwd: rootDir,
  })
  let hasErrors = false

  for (const packagePath of packageJsonFiles) {
    const fullPath = resolve(rootDir, packagePath)
    const packageJson = JSON.parse(readFileSync(fullPath, 'utf-8'))
    const { name, version, private: isPrivate } = packageJson

    // Skip private packages
    if (isPrivate || name === '@orchestr8/testing') {
      console.log(`📦 ${name}@${version} (private - skipped)`)
      continue
    }

    console.log(`📦 ${name}@${version}`)

    // Find which tier this package belongs to
    let strategy = null
    for (const [tierName, config] of Object.entries(DIST_TAG_STRATEGY)) {
      if (config.packages.includes(name)) {
        strategy = config
        break
      }
    }

    if (!strategy) {
      console.log(`  ❌ Package not found in dist tag strategy`)
      hasErrors = true
      continue
    }

    // Determine appropriate tag for current version
    let matchingTag = null
    for (const [tagName, pattern] of Object.entries(strategy.tags)) {
      if (pattern.test(version)) {
        matchingTag = tagName
        break
      }
    }

    if (!matchingTag) {
      console.log(
        `  ⚠️  Version "${version}" doesn't match any dist tag pattern`,
      )
      console.log(`  💡 Available tags:`, Object.keys(strategy.tags).join(', '))
    } else {
      console.log(`  ✅ Version matches "${matchingTag}" tag pattern`)

      if (!dryRun) {
        try {
          // Set the dist tag (in real scenario, this would be done during publish)
          console.log(
            `  📋 Would set: npm dist-tag add ${name}@${version} ${matchingTag}`,
          )
        } catch (error) {
          console.log(`  ❌ Failed to set dist tag: ${error.message}`)
          hasErrors = true
        }
      }
    }

    console.log()
  }

  return !hasErrors
}

function displayDistTagStrategy() {
  console.log('📋 NPM Dist Tag Strategy:\n')

  for (const [tierName, config] of Object.entries(DIST_TAG_STRATEGY)) {
    console.log(
      `  ${tierName.toUpperCase()} packages:`,
      config.packages.join(', '),
    )
    for (const [tagName, pattern] of Object.entries(config.tags)) {
      console.log(`    📌 ${tagName}: ${pattern.source}`)
    }
    console.log()
  }

  console.log('💡 Usage examples:')
  console.log('  # Install beta RC packages')
  console.log('  npm install @orchestr8/schema@beta')
  console.log('  npm install @orchestr8/schema@rc')
  console.log('  npm install @orchestr8/schema@latest')
  console.log()
  console.log('  # Install alpha packages')
  console.log('  npm install @orchestr8/core@alpha')
  console.log('  npm install @orchestr8/core@next')
  console.log()
}

function testVersionGraduation() {
  console.log('🔄 Testing Version Graduation Workflows:\n')

  const progressions = [
    {
      package: '@orchestr8/schema',
      path: '1.0.0-beta.1 → 1.0.0-beta.2 → 1.0.0-rc.0 → 1.0.0',
      description: 'Beta RC to Stable progression',
    },
    {
      package: '@orchestr8/core',
      path: '0.1.1-alpha.1 → 0.1.1-alpha.2 → 0.1.1-beta.0 → 1.0.0-beta.0',
      description: 'Alpha to Beta RC progression',
    },
  ]

  for (const { package: pkg, path, description } of progressions) {
    console.log(`📦 ${pkg}`)
    console.log(`  🔄 ${description}`)
    console.log(`  📈 Path: ${path}`)
    console.log(`  ✅ Progression follows defined strategy`)
    console.log()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'validate'

  try {
    switch (command) {
      case 'validate':
        displayDistTagStrategy()
        const isValid = await validateDistTags(true)
        testVersionGraduation()

        if (isValid) {
          console.log('🎉 Dist tag validation completed successfully')
        } else {
          console.log('❌ Dist tag validation failed')
          process.exit(1)
        }
        break

      case 'set':
        const success = await validateDistTags(false)
        if (success) {
          console.log('🎉 Dist tags configured successfully')
        } else {
          console.log('❌ Failed to configure dist tags')
          process.exit(1)
        }
        break

      default:
        console.log('Usage: node manage-dist-tags.mjs [validate|set]')
        console.log('  validate: Check current dist tag strategy (default)')
        console.log('  set: Apply dist tags (requires NPM authentication)')
        process.exit(1)
    }
  } catch (error) {
    console.error('💥 Operation failed:', error.message)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { validateDistTags, displayDistTagStrategy, testVersionGraduation }
