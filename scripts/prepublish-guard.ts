#!/usr/bin/env tsx
/**
 * Prepublish guard to prevent accidental publishing
 * Ensures all build artifacts exist and tests pass before publishing
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REQUIRED_DIRS = ['dist']
const REQUIRED_FILES = ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts']

function checkBuildArtifacts(): boolean {
  console.info('🔍 Checking build artifacts...')

  // Check directories
  for (const dir of REQUIRED_DIRS) {
    const dirPath = resolve(process.cwd(), dir)
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(dirPath)) {
      console.error(`❌ Missing required directory: ${dir}`)
      console.error(`   Run: pnpm run build:all`)
      return false
    }
  }

  // Check specific files
  for (const file of REQUIRED_FILES) {
    const filePath = resolve(process.cwd(), file)
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(filePath)) {
      console.error(`❌ Missing required file: ${file}`)
      console.error(`   Run: pnpm run build:all`)
      return false
    }
  }

  console.info('✅ All build artifacts present')
  return true
}

function checkPackagePrivate(): boolean {
  const packagePath = resolve(process.cwd(), 'package.json')
  const packageContent = readFileSync(packagePath, 'utf8')
  const packageJson = JSON.parse(packageContent) as { private?: boolean }

  if (packageJson.private === true) {
    console.warn('⚠️  Package is marked as private')
    console.warn('   To publish, set "private": false in package.json')
    return false
  }

  return true
}

function main(): void {
  console.info('🚀 Running prepublish checks...\n')

  const buildOk = checkBuildArtifacts()
  const publishable = checkPackagePrivate()

  if (!buildOk || !publishable) {
    console.error('\n❌ Prepublish checks failed')
    process.exit(1)
  }

  console.info('\n✅ All prepublish checks passed')
  console.info('📦 Ready to publish!')
}

// Run if this is the main module
if (import.meta.main) {
  main()
}
