#!/usr/bin/env node

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { glob } from 'glob'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

const packages = [
  'schema',
  'logger',
  'resilience',
  'core',
  'agent-base',
  'testing',
  'cli',
]

// CLI packages are ES modules only and don't need dual module support
const esModulesOnlyPackages = ['cli']

let hasErrors = false

console.log('🔍 Validating dual consumption setup...\n')

for (const pkg of packages) {
  const packageJsonPath = resolve(rootDir, `packages/${pkg}/package.json`)

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    const issues = []
    const isEsmOnly = esModulesOnlyPackages.includes(pkg)

    if (!packageJson.exports?.['.']?.development) {
      issues.push('❌ Missing "development" condition in exports')
    }

    if (!packageJson.exports?.['.']?.types) {
      issues.push('❌ Missing "types" field in exports')
    }

    if (!packageJson.exports?.['.']?.import) {
      issues.push('❌ Missing "import" field in exports')
    }

    // Only require CommonJS support for dual module packages
    if (!isEsmOnly && !packageJson.exports?.['.']?.require) {
      issues.push('❌ Missing "require" field in exports')
    }

    // Check for proper dual module structure (skip for ESM-only packages)
    if (
      !isEsmOnly &&
      (!packageJson.main || !packageJson.main.includes('dist/cjs/index.js'))
    ) {
      issues.push(
        '❌ Missing or incorrect "main" field (should point to dist/cjs/index.js)',
      )
    }

    if (
      !packageJson.module ||
      !packageJson.module.includes('dist/esm/index.js')
    ) {
      issues.push(
        '❌ Missing or incorrect "module" field (should point to dist/esm/index.js)',
      )
    }

    if (
      !packageJson.types ||
      !packageJson.types.includes('dist/types/index.d.ts')
    ) {
      issues.push(
        '❌ Missing or incorrect "types" field (should point to dist/types/index.d.ts)',
      )
    }

    const exportOrder = Object.keys(packageJson.exports?.['.'] || {})
    if (exportOrder[0] !== 'development') {
      issues.push('⚠️  "development" should be first in exports')
    }

    // Check build script configuration
    if (
      !isEsmOnly &&
      (!packageJson.scripts?.build ||
        !packageJson.scripts.build.includes('build:esm'))
    ) {
      issues.push('❌ Missing dual-build scripts')
    }

    // For ESM-only packages, we don't require CommonJS builds
    if (isEsmOnly) {
      console.log(`✅ ${packageJson.name} (ESM-only)`)
      continue
    }

    if (issues.length > 0) {
      console.log(`📦 ${packageJson.name}:`)
      issues.forEach((issue) => console.log(`  ${issue}`))
      console.log()
      hasErrors = true
    } else {
      console.log(`✅ ${packageJson.name}`)
    }
  } catch (error) {
    console.error(`❌ Error reading ${pkg}: ${error.message}`)
    hasErrors = true
  }
}

const tsconfigPath = resolve(rootDir, 'tsconfig.json')
try {
  const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'))

  if (tsconfig.compilerOptions?.moduleResolution !== 'bundler') {
    console.log('\n⚠️  TypeScript configuration:')
    console.log(
      `  moduleResolution should be "bundler", found "${tsconfig.compilerOptions?.moduleResolution}"`,
    )
    hasErrors = true
  }
} catch (error) {
  console.error(`❌ Error reading tsconfig.json: ${error.message}`)
  hasErrors = true
}

const vitestConfigPath = resolve(rootDir, 'vitest.config.ts')
try {
  const vitestConfig = readFileSync(vitestConfigPath, 'utf8')

  if (!vitestConfig.includes('conditions:')) {
    console.log('\n⚠️  Vitest configuration:')
    console.log('  Missing resolve.conditions configuration')
    hasErrors = true
  }
} catch (error) {
  console.error(`❌ Error reading vitest.config.ts: ${error.message}`)
  hasErrors = true
}

if (hasErrors) {
  console.log('\n❌ Dual consumption validation failed')
  process.exit(1)
} else {
  console.log('\n✅ All dual consumption checks passed!')
}
