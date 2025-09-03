#!/usr/bin/env tsx

/**
 * Script to add .js extensions to all relative imports in TypeScript files
 * for proper ESM compatibility
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

const SRC_DIR = path.join(process.cwd(), 'src')

async function* walkFiles(dir: string): AsyncGenerator<string> {
  const files = await fs.readdir(dir, { withFileTypes: true })
  for (const file of files) {
    const filePath = path.join(dir, file.name)
    if (file.isDirectory()) {
      yield* walkFiles(filePath)
    } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
      yield filePath
    }
  }
}

function addJsExtension(content: string): { content: string; changeCount: number } {
  let changeCount = 0

  // Pattern to match relative imports without extensions
  // Matches: import ... from './path' or from '../path'
  const importPattern =
    /((?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)?\s*(?:,\s*(?:\{[^}]*\}|\w+))?\s+from\s+['"])(\.\.?\/[^'"]+)(?<!\.js)(['"])/g

  // Pattern for re-export statements
  const reExportPattern = /(export\s+(?:\*|\{[^}]*\})\s+from\s+['"])(\.\.?\/[^'"]+)(?<!\.js)(['"])/g

  // Pattern for dynamic imports
  const dynamicImportPattern = /(import\s*\(\s*['"])(\.\.?\/[^'"]+)(?<!\.js)(['"]\s*\))/g

  let modifiedContent = content

  // Process standard imports/exports
  modifiedContent = modifiedContent.replace(importPattern, (match, prefix, importPath, suffix) => {
    // Skip if it's already a .js file or a directory import (ends with /)
    if (importPath.endsWith('.js') || importPath.endsWith('/')) {
      return match
    }
    changeCount++
    return `${prefix}${importPath}.js${suffix}`
  })

  // Process re-exports
  modifiedContent = modifiedContent.replace(
    reExportPattern,
    (match, prefix, importPath, suffix) => {
      if (importPath.endsWith('.js') || importPath.endsWith('/')) {
        return match
      }
      changeCount++
      return `${prefix}${importPath}.js${suffix}`
    },
  )

  // Process dynamic imports
  modifiedContent = modifiedContent.replace(
    dynamicImportPattern,
    (match, prefix, importPath, suffix) => {
      if (importPath.endsWith('.js') || importPath.endsWith('/')) {
        return match
      }
      changeCount++
      return `${prefix}${importPath}.js${suffix}`
    },
  )

  return { content: modifiedContent, changeCount }
}

async function processFile(filePath: string): Promise<number> {
  const content = await fs.readFile(filePath, 'utf-8')
  const { content: modifiedContent, changeCount } = addJsExtension(content)

  if (changeCount > 0) {
    await fs.writeFile(filePath, modifiedContent)
    const relativePath = path.relative(process.cwd(), filePath)
    console.log(`✅ Updated ${relativePath} (${changeCount} imports)`)
  }

  return changeCount
}

async function main(): Promise<void> {
  console.log('🔍 Scanning TypeScript files in src directory...\n')

  let totalFiles = 0
  let totalChanges = 0

  for await (const filePath of walkFiles(SRC_DIR)) {
    totalFiles++
    const changes = await processFile(filePath)
    totalChanges += changes
  }

  console.log('\n📊 Summary:')
  console.log(`   Files scanned: ${totalFiles}`)
  console.log(`   Total imports updated: ${totalChanges}`)

  if (totalChanges > 0) {
    console.log('\n✨ All imports have been updated with .js extensions!')
    console.log('   Run "pnpm build" to verify the changes compile correctly.')
  } else {
    console.log('\n✅ All imports already have .js extensions!')
  }
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
