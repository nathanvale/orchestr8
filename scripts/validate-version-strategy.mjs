#!/usr/bin/env node

/**
 * Version Strategy Validation Script
 *
 * Validates that all packages follow the correct version strategy:
 * - Beta RC: schema, logger, resilience (1.0.0-beta.x)
 * - Alpha: core, cli, agent-base (0.x.x-alpha.x)
 * - Private: testing (not published)
 */

import { readFileSync } from 'fs'
import { glob } from 'glob'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

// Define version strategy tiers
const VERSION_TIERS = {
  betaRC: {
    packages: [
      '@orchestr8/schema',
      '@orchestr8/logger',
      '@orchestr8/resilience',
    ],
    pattern: /^1\.0\.0-beta\.\d+$/,
    description: 'Beta RC packages should be 1.0.0-beta.x',
  },
  alpha: {
    packages: ['@orchestr8/core', '@orchestr8/cli', '@orchestr8/agent-base'],
    pattern: /^0\.\d+\.\d+(-alpha\.\d+)?$/,
    description: 'Alpha packages should be 0.x.x or 0.x.x-alpha.x',
  },
  private: {
    packages: ['@orchestr8/testing'],
    pattern: /^0\.\d+\.\d+$/,
    description: 'Private packages should follow 0.x.x',
  },
}

async function validateVersionStrategy() {
  console.log('🔍 Validating version strategy...\n')

  let hasErrors = false
  const packageJsonFiles = await glob('packages/*/package.json', {
    cwd: rootDir,
  })

  for (const packagePath of packageJsonFiles) {
    const fullPath = resolve(rootDir, packagePath)
    const packageJson = JSON.parse(readFileSync(fullPath, 'utf-8'))
    const { name, version, publishConfig } = packageJson

    console.log(`📦 ${name}@${version}`)

    // Find which tier this package belongs to
    let tier = null
    for (const [tierName, config] of Object.entries(VERSION_TIERS)) {
      if (config.packages.includes(name)) {
        tier = { name: tierName, config }
        break
      }
    }

    if (!tier) {
      console.log(`  ❌ Package not found in version strategy tiers`)
      hasErrors = true
      continue
    }

    // Validate version pattern
    if (!tier.config.pattern.test(version)) {
      console.log(
        `  ❌ Version "${version}" doesn't match pattern for ${tier.name} tier`,
      )
      console.log(`  💡 ${tier.config.description}`)
      hasErrors = true
    } else {
      console.log(`  ✅ Version follows ${tier.name} strategy`)
    }

    // Validate publish config
    if (tier.name === 'private') {
      if (!packageJson.private && publishConfig?.access === 'public') {
        console.log(`  ❌ Private package should not have public publishConfig`)
        hasErrors = true
      }
    } else {
      if (publishConfig?.access !== 'public') {
        console.log(
          `  ❌ Public package should have publishConfig.access = 'public'`,
        )
        hasErrors = true
      } else {
        console.log(`  ✅ Publish config correct`)
      }
    }

    console.log()
  }

  if (hasErrors) {
    console.log('❌ Version strategy validation failed')
    process.exit(1)
  } else {
    console.log('✅ All packages follow correct version strategy')
  }
}

// NPM dist tag validation
function validateDistTagStrategy() {
  console.log('\n🏷️  NPM Dist Tag Strategy:')
  console.log(
    '  📋 Beta RC packages (@orchestr8/schema, @orchestr8/logger, @orchestr8/resilience):',
  )
  console.log('    - npm install @orchestr8/schema@beta (latest beta)')
  console.log('    - npm install @orchestr8/schema@rc (latest RC)')
  console.log('    - npm install @orchestr8/schema@latest (stable)')

  console.log(
    '  📋 Alpha packages (@orchestr8/core, @orchestr8/cli, @orchestr8/agent-base):',
  )
  console.log('    - npm install @orchestr8/core@alpha (latest alpha)')
  console.log('    - npm install @orchestr8/core@next (development)')

  console.log('  📋 Private packages (@orchestr8/testing):')
  console.log('    - Not published to NPM')

  console.log('\n✅ Dist tag strategy defined')
}

async function main() {
  try {
    await validateVersionStrategy()
    validateDistTagStrategy()
    console.log('\n🎉 Version strategy validation completed successfully')
  } catch (error) {
    console.error('💥 Validation failed:', error)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { validateVersionStrategy, validateDistTagStrategy }
