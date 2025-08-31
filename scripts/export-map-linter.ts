#!/usr/bin/env tsx
/**
 * Export Map Linting Script
 *
 * Validates package.json export maps to ensure consistency, correctness,
 * and adherence to best practices across all packages in the monorepo.
 * Part of pre-release guardrails.
 */

/* eslint-disable no-console */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'

interface ExportEntry {
  key: string
  types?: string
  import?: string
  require?: string
  default?: string
}

interface PackageInfo {
  name: string
  path: string
  packageJson: any
  exports: ExportEntry[]
  main?: string
  module?: string
  types?: string
  type?: 'module' | 'commonjs'
}

interface ValidationResult {
  package: string
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Find all packages in the monorepo
 */
function findPackages(): string[] {
  const packagePaths: string[] = []

  // Check packages directory
  const packagesDir = resolve(process.cwd(), 'packages')
  if (existsSync(packagesDir)) {
    const packages = readdirSync(packagesDir)
    for (const pkg of packages) {
      const pkgPath = resolve(packagesDir, pkg, 'package.json')
      if (existsSync(pkgPath)) {
        packagePaths.push(resolve(packagesDir, pkg))
      }
    }
  }

  // Check apps directory
  const appsDir = resolve(process.cwd(), 'apps')
  if (existsSync(appsDir)) {
    const apps = readdirSync(appsDir)
    for (const app of apps) {
      const appPath = resolve(appsDir, app, 'package.json')
      if (existsSync(appPath)) {
        packagePaths.push(resolve(appsDir, app))
      }
    }
  }

  return packagePaths
}

/**
 * Parse package.json and extract export information
 */
function parsePackage(packagePath: string): PackageInfo | null {
  try {
    const packageJsonPath = resolve(packagePath, 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

    const exports: ExportEntry[] = []

    if (packageJson.exports) {
      if (typeof packageJson.exports === 'string') {
        // Simple string export
        exports.push({
          key: '.',
          default: packageJson.exports,
        })
      } else {
        // Complex exports object
        for (const [key, value] of Object.entries(packageJson.exports)) {
          if (typeof value === 'string') {
            exports.push({
              key,
              default: value,
            })
          } else if (typeof value === 'object' && value !== null) {
            const exportEntry: ExportEntry = { key }
            const valueObj = value as Record<string, unknown>

            if (typeof valueObj['types'] === 'string') exportEntry.types = valueObj['types']
            if (typeof valueObj['import'] === 'string') exportEntry.import = valueObj['import']
            if (typeof valueObj['require'] === 'string') exportEntry.require = valueObj['require']
            if (typeof valueObj['default'] === 'string') exportEntry.default = valueObj['default']

            exports.push(exportEntry)
          }
        }
      }
    }

    return {
      name: packageJson.name || basename(packagePath),
      path: packagePath,
      packageJson,
      exports,
      main: packageJson.main,
      module: packageJson.module,
      types: packageJson.types,
      type: packageJson.type,
    }
  } catch (error) {
    console.error(`Failed to parse package at ${packagePath}:`, error)
    return null
  }
}

/**
 * Validate export map structure and consistency
 */
function validateExportMap(pkg: PackageInfo): ValidationResult {
  const result: ValidationResult = {
    package: pkg.name,
    valid: true,
    errors: [],
    warnings: [],
  }

  // Check if package has exports field
  if (pkg.exports.length === 0) {
    result.warnings.push('No exports field defined - consider adding for better tree-shaking')
  }

  // Validate each export entry
  for (const exportEntry of pkg.exports) {
    validateExportEntry(pkg, exportEntry, result)
  }

  // Check for consistency with legacy fields
  validateLegacyFieldConsistency(pkg, result)

  // Check for recommended patterns
  validateRecommendedPatterns(pkg, result)

  // Set overall validity
  result.valid = result.errors.length === 0

  return result
}

/**
 * Validate individual export entry
 */
function validateExportEntry(
  pkg: PackageInfo,
  exportEntry: ExportEntry,
  result: ValidationResult,
): void {
  const { key } = exportEntry

  // Check for leading ./ in subpath exports (best practice for relative safety)
  if (key !== '.' && !key.startsWith('./')) {
    result.warnings.push(
      `Subpath export "${key}" should start with "./" for relative path safety (use "./${key}")`,
    )
  }

  // Validate export paths exist (defer existence checks for build artifacts)
  const checkPath = (path: string, type: string): boolean => {
    const fullPath = resolve(pkg.path, path)

    // Known build output directories that might not exist pre-build
    const buildOutputDirs = ['dist/', 'dist-types/', 'build/', 'lib/', 'esm/', 'cjs/']
    const isBuildArtifact = buildOutputDirs.some((dir) => path.startsWith(dir))

    if (!existsSync(fullPath)) {
      if (isBuildArtifact) {
        // Downgrade to warning for build artifacts - they'll be created during build
        result.warnings.push(
          `${type} export "${path}" for "${key}" does not exist (build artifact - will be created during build)`,
        )
        return false // Build artifact doesn't exist yet
      } else {
        // Hard error for non-build paths that should exist
        result.errors.push(`${type} export "${path}" for "${key}" does not exist`)
        return false
      }
    }
    return true // File exists
  }

  // Track which exports exist
  const existingExports = {
    types: exportEntry.types ? checkPath(exportEntry.types, 'types') : false,
    import: exportEntry.import ? checkPath(exportEntry.import, 'import') : false,
    require: exportEntry.require ? checkPath(exportEntry.require, 'require') : false,
    default: exportEntry.default ? checkPath(exportEntry.default, 'default') : false,
  }

  // P0 fix: Validate at least one export will exist after build
  const hasAnyExport =
    exportEntry.types || exportEntry.import || exportEntry.require || exportEntry.default
  const hasAnyExistingExport = Object.values(existingExports).some((exists) => exists)

  if (hasAnyExport && !hasAnyExistingExport) {
    // All exports point to build artifacts - provide guidance
    // P0 FIX: Check CI environment and --post-build flag in addition to GUARDRAILS_RUN
    const isInGuardrails = process.env['GUARDRAILS_RUN'] === '1'
    const isInCI = process.env['CI'] === 'true' || process.env['CI'] === '1'
    const isPostBuild = process.argv.includes('--post-build')

    // P0 Fix: Clearer logic for when to treat missing artifacts as errors
    if (isPostBuild) {
      // If --post-build flag is set, missing files are always errors
      result.errors.push(
        `Export "${key}" has no existing files after build - check build configuration`,
      )
    } else if (isInGuardrails || isInCI) {
      // In guardrails or CI without --post-build, error to catch pre-build runs
      result.errors.push(
        `Export "${key}" has no existing files - run 'pnpm build' before validation`,
      )
    } else {
      // In local development, just warn
      result.warnings.push(
        `Export "${key}" points only to build artifacts - ensure 'pnpm build' creates these files`,
      )
    }
  }

  // Validate export ordering (types should come first)
  const exportObject = pkg.packageJson.exports?.[key]
  if (typeof exportObject === 'object' && exportObject !== null) {
    const keys = Object.keys(exportObject)
    if (keys.includes('types') && keys[0] !== 'types') {
      result.warnings.push(`"types" should be the first condition in export "${key}"`)
    }
  }

  // P1 Fix: Check for required conditions - properly detect pure ESM packages
  if (key === '.') {
    // Check if package type suggests expected format
    const packageType = pkg.packageJson.type || 'commonjs'

    // P1 Fix: Detect pure ESM intent
    const isPureESM =
      packageType === 'module' &&
      !pkg.main && // No CJS main field
      !pkg.packageJson.exports?.['.']?.require // No require export

    // For main export, need at least one of: import, require, or default
    if (!exportEntry.import && !exportEntry.require && !exportEntry.default) {
      result.errors.push(
        'Main export "." should have at least one of: "import", "require", or "default" condition',
      )
    }

    // P1 Fix: Only warn if dual package support seems intended but incomplete
    if (packageType === 'module' && !exportEntry.import && exportEntry.require) {
      // ESM package with only require is odd
      result.warnings.push(
        'ESM package ("type": "module") has only "require" condition - consider adding "import"',
      )
    } else if (packageType === 'commonjs' && exportEntry.import && !exportEntry.require) {
      // CommonJS package with only import - only warn if not intentionally pure ESM
      const hasMainField = pkg.main !== undefined
      if (hasMainField) {
        // Has a main field suggesting CJS support, but no require export
        result.warnings.push(
          'CommonJS package has "main" field but no "require" condition - consider adding for consistency',
        )
      }
      // Otherwise, this might be intentionally import-only
    } else if (
      packageType === 'module' &&
      exportEntry.import &&
      !exportEntry.require &&
      !isPureESM
    ) {
      // ESM package with import but no require - check if dual package was intended
      const hasMainField = pkg.main !== undefined
      if (hasMainField) {
        // Has a main field suggesting CJS support intention
        result.warnings.push(
          'ESM package has "main" field but no "require" condition - add "require" for dual package support or remove "main" for pure ESM',
        )
      }
      // Otherwise, this is likely intentionally pure ESM - no warning
    }
  }

  // Validate file extensions match conditions
  // Check package.json "type" field to determine module format
  const packageType = pkg.packageJson.type || 'commonjs'

  if (exportEntry.import) {
    // ESM imports should point to .js or .mjs files
    if (!exportEntry.import.endsWith('.js') && !exportEntry.import.endsWith('.mjs')) {
      result.warnings.push(
        `Import condition for "${key}" should point to .js or .mjs file (got: ${exportEntry.import})`,
      )
    }
  }

  if (exportEntry.require) {
    // CommonJS requires can point to .cjs or .js (when type is commonjs)
    if (packageType === 'module') {
      // In ESM packages, require should strongly prefer .cjs for clarity
      if (!exportEntry.require.endsWith('.cjs')) {
        result.warnings.push(
          `Require condition for "${key}" in ESM package ("type": "module") should use .cjs extension for clarity (got: ${exportEntry.require})`,
        )
      }
    } else {
      // In CommonJS packages, require can point to .js or .cjs
      if (!exportEntry.require.endsWith('.js') && !exportEntry.require.endsWith('.cjs')) {
        result.warnings.push(
          `Require condition for "${key}" should point to .js or .cjs file (got: ${exportEntry.require})`,
        )
      }
    }
  }

  // Check for conditional exports pointing to the same file (which is legitimate)
  if (exportEntry.import && exportEntry.require && exportEntry.import === exportEntry.require) {
    // This is fine when the file works for both formats
    // Just ensure the file exists (with build artifact awareness)
    const fullPath = resolve(pkg.path, exportEntry.import)
    if (!existsSync(fullPath)) {
      const buildOutputDirs = ['dist/', 'dist-types/', 'build/', 'lib/', 'esm/', 'cjs/']
      const isBuildArtifact = buildOutputDirs.some((dir) => exportEntry.import!.startsWith(dir))

      if (isBuildArtifact) {
        result.warnings.push(
          `Shared export file "${exportEntry.import}" for "${key}" does not exist (build artifact - will be created during build)`,
        )
      } else {
        result.errors.push(`Shared export file "${exportEntry.import}" for "${key}" does not exist`)
      }
    }
  }

  if (exportEntry.types && !exportEntry.types.endsWith('.d.ts')) {
    result.errors.push(
      `Types condition for "${key}" should point to .d.ts file (got: ${exportEntry.types})`,
    )
  }
}

/**
 * Check consistency with legacy main/module/types fields
 */
function validateLegacyFieldConsistency(pkg: PackageInfo, result: ValidationResult): void {
  const mainExport = pkg.exports.find((e) => e.key === '.')

  if (mainExport) {
    // Check main field consistency
    if (pkg.main && mainExport.require && pkg.main !== mainExport.require) {
      result.warnings.push(
        `Legacy "main" field (${pkg.main}) doesn't match exports "require" condition (${mainExport.require})`,
      )
    }

    // Check module field consistency
    if (pkg.module && mainExport.import && pkg.module !== mainExport.import) {
      result.warnings.push(
        `Legacy "module" field (${pkg.module}) doesn't match exports "import" condition (${mainExport.import})`,
      )
    }

    // Check types field consistency
    if (pkg.types && mainExport.types && pkg.types !== mainExport.types) {
      result.warnings.push(
        `Legacy "types" field (${pkg.types}) doesn't match exports "types" condition (${mainExport.types})`,
      )
    }
  }
}

/**
 * Validate recommended patterns and best practices
 */
function validateRecommendedPatterns(pkg: PackageInfo, result: ValidationResult): void {
  // Check for common subpath patterns
  const hasSubpathExports = pkg.exports.some((e) => e.key !== '.' && e.key !== './package.json')

  if (hasSubpathExports) {
    // Recommend package.json export for tools
    const hasPackageJsonExport = pkg.exports.some((e) => e.key === './package.json')
    if (!hasPackageJsonExport) {
      result.warnings.push(
        'Consider adding "./package.json" export for better tooling compatibility',
      )
    }
  }

  // Check for sideEffects field
  if (pkg.packageJson.sideEffects === undefined) {
    result.warnings.push('Consider adding "sideEffects" field for better tree-shaking')
  }

  // Check for type module
  if (!pkg.packageJson.type) {
    result.warnings.push('Consider adding "type": "module" for better ESM support')
  }

  // Validate file naming conventions
  for (const exportEntry of pkg.exports) {
    if (exportEntry.import && exportEntry.require) {
      const importFile = basename(exportEntry.import, extname(exportEntry.import))
      const requireFile = basename(exportEntry.require, extname(exportEntry.require))

      if (importFile !== requireFile) {
        result.warnings.push(
          `Export "${exportEntry.key}" has mismatched base names: ${importFile} vs ${requireFile}`,
        )
      }
    }
  }
}

/**
 * Check for cross-package consistency
 */
function validateCrossPackageConsistency(packages: PackageInfo[]): ValidationResult[] {
  const results: ValidationResult[] = []

  // Group packages by workspace (packages vs apps)
  const packagesByType = new Map<string, PackageInfo[]>()

  for (const pkg of packages) {
    const type = pkg.path.includes('/packages/') ? 'packages' : 'apps'
    if (!packagesByType.has(type)) {
      packagesByType.set(type, [])
    }
    packagesByType.get(type)!.push(pkg)
  }

  // Check consistency within each workspace
  for (const [type, pkgs] of packagesByType) {
    const result: ValidationResult = {
      package: `${type}-consistency`,
      valid: true,
      errors: [],
      warnings: [],
    }

    if (pkgs.length > 1) {
      // Check export structure consistency
      const exportStructures = pkgs.map((pkg) => ({
        name: pkg.name,
        hasExports: pkg.exports.length > 0,
        exportKeys: pkg.exports.map((e) => e.key).sort(),
        hasDualPackage: pkg.exports.some((e) => e.import && e.require),
      }))

      // Calculate majority baseline instead of using first package
      const hasExportsCount = exportStructures.filter((s) => s.hasExports).length
      const hasDualPackageCount = exportStructures.filter((s) => s.hasDualPackage).length
      const majorityHasExports = hasExportsCount >= Math.ceil(pkgs.length / 2)
      const majorityHasDualPackage = hasDualPackageCount >= Math.ceil(pkgs.length / 2)

      // Find outliers that differ from majority
      for (const structure of exportStructures) {
        if (structure.hasExports !== majorityHasExports) {
          const expectation = majorityHasExports ? 'should have exports' : 'should not have exports'
          result.warnings.push(
            `Package ${structure.name} differs from majority: ${expectation} (${hasExportsCount}/${pkgs.length} have exports)`,
          )
        }

        if (structure.hasDualPackage !== majorityHasDualPackage) {
          const expectation = majorityHasDualPackage
            ? 'should have dual package setup'
            : 'should not have dual package setup'
          result.warnings.push(
            `Package ${structure.name} differs from majority: ${expectation} (${hasDualPackageCount}/${pkgs.length} have dual package)`,
          )
        }
      }
    }

    result.valid = result.errors.length === 0
    if (result.errors.length > 0 || result.warnings.length > 0) {
      results.push(result)
    }
  }

  return results
}

/**
 * Display validation results with ADHD-friendly formatting
 */
function displayResults(results: ValidationResult[]): boolean {
  let hasErrors = false
  let hasWarnings = false

  console.log('\n📦 Export Map Validation Results')
  console.log('='.repeat(50))

  const packageResults = results.filter((r) => !r.package.endsWith('-consistency'))
  const consistencyResults = results.filter((r) => r.package.endsWith('-consistency'))

  // Display individual package results
  for (const result of packageResults) {
    const icon = result.valid ? '✅' : '❌'
    console.log(`${icon} ${result.package}`)

    for (const error of result.errors) {
      console.error(`   ❌ ${error}`)
      hasErrors = true
    }

    for (const warning of result.warnings.slice(0, 3)) {
      console.warn(`   ⚠️  ${warning}`)
      hasWarnings = true
    }

    if (result.warnings.length > 3) {
      console.warn(`   ⚠️  ... and ${result.warnings.length - 3} more warnings`)
    }
  }

  // Display consistency results
  if (consistencyResults.length > 0) {
    console.log('\n🔗 Cross-Package Consistency')
    console.log('-'.repeat(30))

    for (const result of consistencyResults) {
      const icon = result.valid ? '✅' : '❌'
      console.log(`${icon} ${result.package.replace('-consistency', '')}`)

      for (const error of result.errors) {
        console.error(`   ❌ ${error}`)
        hasErrors = true
      }

      for (const warning of result.warnings) {
        console.warn(`   ⚠️  ${warning}`)
        hasWarnings = true
      }
    }
  }

  console.log('='.repeat(50))

  if (hasErrors) {
    console.error('❌ Export map validation failed with errors')
    console.log('\n💡 Next steps:')
    console.log('   • Fix export path errors (missing files)')
    console.log('   • Ensure proper file extensions (.js, .cjs, .d.ts)')
    console.log('   • Check export condition ordering (types first)')
    return false
  } else if (hasWarnings) {
    console.warn('⚠️  Export map validation passed with warnings')
    console.log('\n💡 Consider:')
    console.log('   • Adding missing "package.json" exports')
    console.log('   • Standardizing export structures across packages')
    console.log('   • Adding "sideEffects" field for tree-shaking')
    return true
  } else {
    console.log('✅ All export map validations passed!')
    return true
  }
}

/**
 * Main export map linting function
 */
function main(): void {
  const startTime = Date.now()
  console.log('📦 Linting package.json export maps...')

  const packagePaths = findPackages()

  if (packagePaths.length === 0) {
    console.log('ℹ️  No packages found to validate')
    return
  }

  console.log(`🔍 Found ${packagePaths.length} packages to validate`)

  // Parse all packages
  const packages: PackageInfo[] = []
  for (const packagePath of packagePaths) {
    const pkg = parsePackage(packagePath)
    if (pkg) {
      packages.push(pkg)
    }
  }

  if (packages.length === 0) {
    console.error('❌ No valid packages could be parsed')
    process.exit(1)
  }

  // Run validations
  const results: ValidationResult[] = []

  // Validate individual packages
  for (const pkg of packages) {
    results.push(validateExportMap(pkg))
  }

  // Validate cross-package consistency
  results.push(...validateCrossPackageConsistency(packages))

  // Display results
  const success = displayResults(results)

  const duration = Date.now() - startTime
  console.log(`\n⏱️  Export map validation completed in ${duration}ms`)

  if (!success) {
    process.exit(1)
  }
}

// Run if this script is executed directly
// Use robust execution guard that handles symlinks properly
if (import.meta.url === new URL(process.argv[1] ?? '', 'file://').href) {
  main()
}
