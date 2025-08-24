#!/usr/bin/env node

/* eslint-env node */
/* eslint no-undef: "off", no-console: "off" */

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const packagesDir = 'packages'
const packages = readdirSync(packagesDir)

console.log('Verifying lint:fix scripts across all packages...\n')

let allPackagesHaveLintFix = true

packages.forEach((pkg) => {
  const packageJsonPath = join(packagesDir, pkg, 'package.json')

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    const hasLintFix = packageJson.scripts && packageJson.scripts['lint:fix']

    console.log(`📦 ${pkg}: ${hasLintFix ? '✅' : '❌'} lint:fix`)

    if (hasLintFix) {
      console.log(`   Script: ${packageJson.scripts['lint:fix']}`)
    }

    if (!hasLintFix) {
      allPackagesHaveLintFix = false
    }
  } catch (error) {
    console.log(`📦 ${pkg}: ❌ Error reading package.json - ${error.message}`)
    allPackagesHaveLintFix = false
  }

  console.log('')
})

if (allPackagesHaveLintFix) {
  console.log('🎉 All packages have lint:fix scripts!')
} else {
  console.log('⚠️  Some packages are missing lint:fix scripts')
  process.exit(1)
}
