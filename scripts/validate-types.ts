#!/usr/bin/env bun
/**
 * Type declaration validator.
 * Ensures each export exposes runtime + matching type artifacts and maps.
 * Validates runtime/type parity and detects orphan type files.
 * Lint‑friendly: shallow nesting, no implicit any, explicit return types.
 */

import { existsSync, readdirSync } from 'node:fs'
import { isAbsolute, relative as relativePath, resolve as resolvePath } from 'node:path'
import packageJson from '../package.json'

interface PackageJsonExportsEntry {
  readonly bun?: string
  readonly import?: string
  readonly types?: string
  readonly default?: string
}

type PackageJsonExports = Record<string, PackageJsonExportsEntry | string>

interface ValidationResult {
  readonly errors: string[]
  readonly warnings: string[]
}

const cwd = process.cwd()

/** Basic path sanitizer to reduce security rule noise & guard traversal */
function resolveProjectPath(projectRelativePath: string): string {
  if (projectRelativePath === '') throw new Error('Empty path not allowed')
  // Reject absolute input early
  if (isAbsolute(projectRelativePath)) {
    throw new Error(`Absolute path not allowed: ${projectRelativePath}`)
  }
  const fullPath = resolvePath(cwd, projectRelativePath)
  const rel = relativePath(cwd, fullPath)
  // If the relative path starts with '..' or is absolute (defensive), it's outside
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Path traversal detected: ${projectRelativePath} resolves outside project root`)
  }
  return fullPath
}

/** Safe file existence check with path validation */
function fileExists(relativePath: string): boolean {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return existsSync(resolveProjectPath(relativePath))
}

const DIST_DIR = 'dist'
const DIST_TYPES_DIR = 'dist-types'
const DIST_NODE_DIR = 'dist-node'

function checkBuildDirs(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const required = [
    {
      path: DIST_TYPES_DIR,
      err: `${DIST_TYPES_DIR} directory missing - run "bun run build:types" first`,
    },
    {
      path: DIST_NODE_DIR,
      err: `${DIST_NODE_DIR} directory missing - run "bun run build:node" first`,
    },
  ] as const
  for (const item of required) {
    if (!fileExists(item.path)) errors.push(item.err)
  }
  // Optional Bun target
  if (!fileExists(DIST_DIR)) {
    warnings.push(`${DIST_DIR} directory missing - run "bun run build" for Bun target`)
  }
  return { errors, warnings }
}

function checkMainTypes(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const mainTypes = packageJson.types
  if (!fileExists(mainTypes)) {
    errors.push(`Main types file missing: ${mainTypes}`)
    return { errors, warnings }
  }
  if (!fileExists(`${mainTypes}.map`)) {
    warnings.push(`Type declaration map missing: ${mainTypes}.map`)
  }
  const exportsRoot = (packageJson.exports as PackageJsonExports | undefined)?.['.']
  if (
    exportsRoot !== undefined &&
    typeof exportsRoot === 'object' &&
    exportsRoot.types !== undefined &&
    exportsRoot.types !== mainTypes
  ) {
    errors.push(
      `Mismatch: package.json "types" (${mainTypes}) != exports['.'].types (${exportsRoot.types})`,
    )
  }
  return { errors, warnings }
}

function validateExportTypes(
  key: string,
  entry: PackageJsonExportsEntry,
  errors: string[],
  warnings: string[],
): void {
  if (entry.types === undefined || entry.types === '') {
    warnings.push(`Export "${key}" missing "types" field`)
    return
  }
  if (!fileExists(entry.types)) {
    errors.push(`Export "${key}" types missing: ${entry.types}`)
    return
  }
  if (!fileExists(`${entry.types}.map`)) {
    warnings.push(`Export "${key}" types map missing: ${entry.types}.map`)
  }
}

function validateExportRuntime(
  key: string,
  entry: PackageJsonExportsEntry,
  errors: string[],
  warnings: string[],
): void {
  if (entry.import !== undefined && entry.import !== '') {
    if (!fileExists(entry.import)) {
      errors.push(`Export "${key}" import file missing: ${entry.import}`)
    }
  }
  if (entry.bun !== undefined && entry.bun !== '') {
    if (!fileExists(entry.bun)) {
      warnings.push(`Export "${key}" bun file missing: ${entry.bun}`)
    }
  }
}

function checkExports(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const exportsField = packageJson.exports as PackageJsonExports | undefined
  if (exportsField === undefined) return { errors, warnings }
  for (const [key, raw] of Object.entries(exportsField)) {
    if (typeof raw === 'string') {
      warnings.push(
        `Export "${key}" uses string format - consider using object format with "types" field`,
      )
      continue
    }
    validateExportTypes(key, raw, errors, warnings)
    validateExportRuntime(key, raw, errors, warnings)
  }
  return { errors, warnings }
}

/**
 * Helper to get JS files from a directory
 */
function getJsFiles(dir: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readdirSync(resolveProjectPath(dir))
    .filter((f) => f.endsWith('.js'))
    .map((f) => f.replace('.js', ''))
}

/**
 * Helper to get TypeScript definition files from a directory
 */
function getTsDefFiles(dir: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readdirSync(resolveProjectPath(dir))
    .filter((f) => f.endsWith('.d.ts'))
    .map((f) => f.replace('.d.ts', ''))
}

/**
 * Helper to check parity between runtime and type files
 */
function validateParity(distFiles: string[], typeFiles: string[], warnings: string[]): void {
  // Check for runtime files without types
  for (const runtime of distFiles) {
    if (!typeFiles.includes(runtime)) {
      warnings.push(
        `Runtime file '${DIST_DIR}/${runtime}.js' has no matching type declaration in ${DIST_TYPES_DIR}/`,
      )
    }
  }

  // Check for orphan type files (types without runtime)
  for (const typeFile of typeFiles) {
    const hasBunRuntime = fileExists(`${DIST_DIR}/${typeFile}.js`)
    const hasNodeRuntime = fileExists(`${DIST_NODE_DIR}/${typeFile}.js`)

    if (!hasBunRuntime && !hasNodeRuntime) {
      warnings.push(
        `Orphan type file '${DIST_TYPES_DIR}/${typeFile}.d.ts' has no corresponding runtime file`,
      )
    }
  }
}

/**
 * Check runtime/type parity: ensure every runtime export has matching .d.ts
 * and flag orphan type files (types without corresponding runtime)
 */
function checkRuntimeTypeParity(): ValidationResult {
  const warnings: string[] = []

  // Check if dist directories exist
  if (!fileExists(DIST_DIR) || !fileExists(DIST_TYPES_DIR)) {
    warnings.push('Skipping runtime/type parity check - build directories not found')
    return { errors: [], warnings }
  }

  try {
    const distFiles = getJsFiles(DIST_DIR)
    const typeFiles = getTsDefFiles(DIST_TYPES_DIR)
    validateParity(distFiles, typeFiles, warnings)
  } catch (error) {
    warnings.push(
      `Could not perform runtime/type parity check: ${error instanceof Error ? error.message : 'unknown error'}`,
    )
  }

  return { errors: [], warnings }
}

function mergeResults(...parts: ValidationResult[]): ValidationResult {
  return parts.reduce<ValidationResult>(
    (acc, cur) => ({
      errors: acc.errors.concat(cur.errors),
      warnings: acc.warnings.concat(cur.warnings),
    }),
    { errors: [], warnings: [] },
  )
}

function report(result: ValidationResult): void {
  const { errors, warnings } = result
  if (errors.length > 0) {
    console.error('❌ Type validation failed:')
    for (const msg of errors) console.error(`  • ${msg}`)
  }
  if (warnings.length > 0) {
    console.warn('\n⚠️  Type validation warnings:')
    for (const msg of warnings) console.warn(`  • ${msg}`)
  }
  if (errors.length > 0) {
    console.error('\n💡 Tip: Run "bun run build:all" to generate all build artifacts')
    // Avoid direct process.exit per eslint unicorn/no-process-exit
    process.exitCode = 1
    return
  }
  if (warnings.length > 0) {
    console.info('\n✅ Passed with warnings (see above)')
  } else {
    console.info('✅ Type validation passed – all artifacts present')
  }
}

const result = mergeResults(
  checkBuildDirs(),
  checkMainTypes(),
  checkExports(),
  checkRuntimeTypeParity(),
)
report(result)
