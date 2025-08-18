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
  'resilience',
  'core',
  'agent-base',
  'testing',
  'cli'
]

let hasErrors = false

console.log('🔍 Validating dual consumption setup...\n')

for (const pkg of packages) {
  const packageJsonPath = resolve(rootDir, `packages/${pkg}/package.json`)
  
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    const issues = []
    
    if (!packageJson.exports?.['.']?.development) {
      issues.push('❌ Missing "development" condition in exports')
    }
    
    if (!packageJson.exports?.['.']?.types) {
      issues.push('❌ Missing "types" field in exports')
    }
    
    if (!packageJson.exports?.['.']?.import) {
      issues.push('❌ Missing "import" field in exports')
    }
    
    const exportOrder = Object.keys(packageJson.exports?.['.'] || {})
    if (exportOrder[0] !== 'development') {
      issues.push('⚠️  "development" should be first in exports')
    }
    
    if (issues.length > 0) {
      console.log(`📦 ${packageJson.name}:`)
      issues.forEach(issue => console.log(`  ${issue}`))
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
    console.log(`  moduleResolution should be "bundler", found "${tsconfig.compilerOptions?.moduleResolution}"`)
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