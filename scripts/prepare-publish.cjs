#!/usr/bin/env node

/**
 * Build-time package.json cleaner for @orchestr8 packages
 *
 * Removes development export conditions before npm publishing to ensure
 * external consumers get clean, predictable module resolution.
 *
 * This preserves fast monorepo development workflow while providing
 * standard npm distribution packages.
 */

const fs = require('fs')
const path = require('path')

function cleanPackageForPublish() {
  const packagePath = path.resolve(process.cwd(), 'package.json')

  if (!fs.existsSync(packagePath)) {
    console.error('❌ No package.json found in current directory')
    process.exit(1)
  }

  // Create backup
  const backupPath = packagePath + '.backup'
  fs.copyFileSync(packagePath, backupPath)

  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
    const originalPkg = JSON.stringify(pkg, null, 2)

    let modified = false

    // Remove development export condition if it exists
    if (pkg.exports?.['.']?.development) {
      console.log('🔧 Removing development export condition for npm publishing')
      delete pkg.exports['.'].development
      modified = true
    }

    if (modified) {
      fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n')
      console.log('✅ Package.json cleaned for publishing')
      console.log('📋 Backup created at:', backupPath)
    } else {
      // Clean up backup if no changes made
      fs.unlinkSync(backupPath)
      console.log(
        'ℹ️  No development export conditions found, package.json unchanged',
      )
    }
  } catch (error) {
    // Restore from backup on error
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, packagePath)
      fs.unlinkSync(backupPath)
    }
    console.error('❌ Error processing package.json:', error.message)
    process.exit(1)
  }
}

function restorePackageAfterPublish() {
  const packagePath = path.resolve(process.cwd(), 'package.json')
  const backupPath = packagePath + '.backup'

  if (fs.existsSync(backupPath)) {
    console.log('🔄 Restoring original package.json from backup')
    fs.copyFileSync(backupPath, packagePath)
    fs.unlinkSync(backupPath)
    console.log('✅ Package.json restored')
  } else {
    console.log('ℹ️  No backup found, package.json unchanged')
  }
}

// Handle command line arguments
const command = process.argv[2]

switch (command) {
  case 'clean':
    cleanPackageForPublish()
    break
  case 'restore':
    restorePackageAfterPublish()
    break
  default:
    console.error('Usage: node scripts/prepare-publish.js [clean|restore]')
    console.error('  clean   - Remove development export conditions')
    console.error('  restore - Restore original package.json from backup')
    process.exit(1)
}
