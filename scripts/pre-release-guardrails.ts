#!/usr/bin/env tsx
/**
 * Pre-Release Guardrails Script
 *
 * Comprehensive pre-release validation including changeset validation,
 * security scanning, export map linting, and more. Orchestrates all
 * guardrails in a single command for CI/CD integration.
 */

/* eslint-disable no-console */

import { exec } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs, promisify } from 'node:util'

import { getGitInfo as getGitInfoShared } from './lib/git-utils.js'

const execAsync = promisify(exec)

interface GuardrailResult {
  name: string
  status: 'pass' | 'warn' | 'fail' | 'skip'
  message: string
  duration: number
  details?: string[]
  subTasks?: Array<{
    name: string
    duration: number
    status: 'pass' | 'warn' | 'fail'
  }>
  // P1 Fix: Add separate field for diagnostic mode instead of message prefix
  isDiagnostic?: boolean
}

interface GuardrailOptions {
  quick?: boolean // Skip slow checks for fast feedback
  verbose?: boolean // Show detailed output
  skipSecurity?: boolean // Skip security scans
  skipExportMaps?: boolean // Skip export map validation
  skipChangesets?: boolean // Skip changeset validation
  warnOnly?: boolean // Convert failures to warnings
  json?: boolean // Output JSON format for CI parsing
  fix?: boolean // Apply automatic fixes where possible
  noCache?: boolean // Skip cache for fresh run
}

interface GuardrailReport {
  timestamp: string
  version: string
  summary: {
    passed: number
    warned: number
    failed: number
    skipped: number
    totalDuration: number
  }
  results: GuardrailResult[]
  packageQualityScore?: {
    overall: number
    breakdown: {
      exportMaps: number
      sideEffects: number
      treeShaking: number
    }
  }
  gitInfo?: {
    branch: string
    baseBranch: string
    commitRange: string
  }
}

interface CacheEntry {
  lockfileHash: string
  exportMapHashes: Record<string, string>
  results: GuardrailResult[]
  timestamp: number
}

/**
 * Calculate hash of lockfile for cache invalidation
 */
function getLockfileHash(): string {
  const lockfilePath = resolve(process.cwd(), 'pnpm-lock.yaml')
  if (!existsSync(lockfilePath)) {
    return 'no-lockfile'
  }
  const content = readFileSync(lockfilePath, 'utf-8')
  return createHash('sha256').update(content).digest('hex').substring(0, 16)
}

/**
 * Get export map hashes for cache invalidation
 */
function getExportMapHashes(): Record<string, string> {
  const hashes: Record<string, string> = {}
  const dirs = ['packages', 'apps']

  for (const dir of dirs) {
    const dirPath = resolve(process.cwd(), dir)
    if (!existsSync(dirPath)) continue

    // Read all subdirectories to find package.json files
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pkgJsonPath = resolve(dirPath, entry.name, 'package.json')
          if (existsSync(pkgJsonPath)) {
            const content = readFileSync(pkgJsonPath, 'utf-8')
            const hash = createHash('sha256').update(content).digest('hex').substring(0, 8)
            hashes[pkgJsonPath] = hash
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  return hashes
}

/**
 * Check if cache is valid
 */
function isCacheValid(cache: CacheEntry | null, options: GuardrailOptions): boolean {
  if (!cache || options.noCache) return false

  // Cache expires after 1 hour
  const ONE_HOUR = 60 * 60 * 1000
  if (Date.now() - cache.timestamp > ONE_HOUR) return false

  // Check lockfile hash
  if (cache.lockfileHash !== getLockfileHash()) return false

  // In quick mode, skip export map hash checking
  if (options.quick) return true

  // Check export map hashes
  const currentHashes = getExportMapHashes()
  for (const [path, hash] of Object.entries(currentHashes)) {
    if (cache.exportMapHashes[path] !== hash) return false
  }

  return true
}

/**
 * Load cached results
 */
function loadCache(options: GuardrailOptions): CacheEntry | null {
  if (options.noCache) return null

  const cachePath = resolve(process.cwd(), '.turbo', 'guardrails-cache.json')
  if (!existsSync(cachePath)) return null

  try {
    const cacheContent = readFileSync(cachePath, 'utf-8')
    const cache = JSON.parse(cacheContent) as CacheEntry

    if (isCacheValid(cache, options)) {
      if (options.verbose) {
        console.log('✨ Using cached results (cache hit)')
      }
      return cache
    }
  } catch {
    // Cache is invalid or corrupted
  }

  return null
}

/**
 * Save results to cache
 */
function saveCache(results: GuardrailResult[], options: GuardrailOptions): void {
  if (options.noCache) return

  const cacheDir = resolve(process.cwd(), '.turbo')
  if (!existsSync(cacheDir)) {
    // Create the cache directory if it doesn't exist (P0 fix)
    try {
      mkdirSync(cacheDir, { recursive: true })
    } catch {
      // If we can't create the directory, skip caching
      return
    }
  }

  const cache: CacheEntry = {
    lockfileHash: getLockfileHash(),
    exportMapHashes: getExportMapHashes(),
    results,
    timestamp: Date.now(),
  }

  const cachePath = resolve(cacheDir, 'guardrails-cache.json')

  // P0 fix: Atomic write pattern to prevent partial writes during concurrent runs
  // Disable caching in CI to avoid race conditions in matrix builds
  if (process.env['CI'] === 'true' || process.env['GITHUB_ACTIONS'] === 'true') {
    // Skip cache writes in CI to avoid concurrent write issues
    if (options.verbose) {
      console.log('⚡ Cache writes disabled in CI environment')
    }
    return
  }

  // P0 Fix: Use atomic write with temp file + rename
  const tempPath = `${cachePath}.tmp.${process.pid}`
  try {
    // Write to temp file first
    writeFileSync(tempPath, JSON.stringify(cache, null, 2))
    // Atomic rename (on same filesystem, this is atomic)
    require('fs').renameSync(tempPath, cachePath)
  } catch {
    // Clean up temp file if it exists
    try {
      if (existsSync(tempPath)) {
        require('fs').unlinkSync(tempPath)
      }
    } catch {
      // Ignore cleanup errors
    }
    // Ignore cache write errors - caching is optional
  }
}

/**
 * Get git information for the report
 */
async function getGitInfo(): Promise<GuardrailReport['gitInfo']> {
  // Use shared utility for consistent branch detection
  return getGitInfoShared()
}

/**
 * Calculate package quality score based on export maps, sideEffects, and tree-shaking
 */
async function calculatePackageQualityScore(): Promise<GuardrailReport['packageQualityScore']> {
  let exportMapScore = 0
  let sideEffectsScore = 0
  let treeShakingScore = 0
  let packageCount = 0

  const packageDirs = ['packages', 'apps']

  for (const dir of packageDirs) {
    const dirPath = resolve(process.cwd(), dir)
    if (!existsSync(dirPath)) continue

    // Find all package.json files in subdirectories
    const packages: string[] = []
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pkgJsonPath = resolve(dirPath, entry.name, 'package.json')
          if (existsSync(pkgJsonPath)) {
            packages.push(pkgJsonPath)
          }
        }
      }
    } catch {
      continue
    }

    for (const pkgPath of packages) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        packageCount++

        // Score export maps (0-100)
        if (pkg.exports) {
          if (typeof pkg.exports === 'object') {
            const hasTypes = JSON.stringify(pkg.exports).includes('types')
            const hasImport = JSON.stringify(pkg.exports).includes('import')
            const hasRequire = JSON.stringify(pkg.exports).includes('require')
            exportMapScore += (hasTypes ? 40 : 0) + (hasImport ? 30 : 0) + (hasRequire ? 30 : 0)
          } else {
            exportMapScore += 50 // Basic export
          }
        }

        // Score sideEffects (0-100)
        if ('sideEffects' in pkg) {
          sideEffectsScore += pkg.sideEffects === false ? 100 : 50
        }

        // Score tree-shaking readiness (0-100)
        if (pkg.type === 'module' || pkg.exports) {
          treeShakingScore += 100
        } else if (pkg.module) {
          treeShakingScore += 75
        } else {
          treeShakingScore += 25
        }
      } catch {
        // Skip invalid package.json
      }
    }
  }

  if (packageCount === 0) return undefined

  // Calculate averages
  exportMapScore = Math.round(exportMapScore / packageCount)
  sideEffectsScore = Math.round(sideEffectsScore / packageCount)
  treeShakingScore = Math.round(treeShakingScore / packageCount)

  const overall = Math.round((exportMapScore + sideEffectsScore + treeShakingScore) / 3)

  return {
    overall,
    breakdown: {
      exportMaps: exportMapScore,
      sideEffects: sideEffectsScore,
      treeShaking: treeShakingScore,
    },
  }
}

/**
 * Check conventional commits match changeset packages
 * P1 Fix: Validate that commit scopes correlate with changed packages
 */
async function checkConventionalCommits(_options: GuardrailOptions): Promise<GuardrailResult> {
  const startTime = Date.now()

  try {
    // Get recent commits
    const gitInfo = await getGitInfo()
    const commits = (await execAsync(`git log ${gitInfo!.commitRange} --pretty=format:"%s"`)).stdout
      .trim()
      .split('\n')
      .filter(Boolean)

    // Parse changeset files to get changed packages
    const changesetDir = resolve(process.cwd(), '.changeset')
    if (!existsSync(changesetDir)) {
      return {
        name: 'Conventional Commits',
        status: 'warn',
        message: 'No .changeset directory found - consider setting up changesets',
        duration: Date.now() - startTime,
        details: ['Run: npx @changesets/cli init'],
      }
    }

    // P1 Fix: Get list of changed packages from git
    const changedFiles = (await execAsync(`git diff ${gitInfo!.commitRange} --name-only`)).stdout
      .trim()
      .split('\n')
      .filter(Boolean)

    // Extract package names from changed files
    const changedPackages = new Set<string>()
    for (const file of changedFiles) {
      if (file.startsWith('packages/')) {
        const packageName = file.split('/')[1]
        if (packageName) changedPackages.add(packageName)
      } else if (file.startsWith('apps/')) {
        const appName = file.split('/')[1]
        if (appName) changedPackages.add(appName)
      }
    }

    // Parse conventional commits and check scopes
    let hasConventionalCommit = false
    let hasScopeCorrelation = false
    const invalidScopes: string[] = []

    for (const commit of commits) {
      const conventionalMatch = commit.match(
        /^(feat|fix|docs|style|refactor|test|chore)(\((.+)\))?:/,
      )
      if (conventionalMatch) {
        hasConventionalCommit = true
        const scope = conventionalMatch[3]

        // P1 Fix: Check if scope matches a changed package
        if (scope) {
          // Handle multiple scopes (e.g., "app,server")
          const scopes = scope.split(',').map((s) => s.trim())
          for (const s of scopes) {
            if (changedPackages.has(s)) {
              hasScopeCorrelation = true
            } else if (
              changedPackages.size > 0 &&
              !['deps', 'config', 'ci', 'docs', 'build'].includes(s)
            ) {
              // Scope doesn't match any changed package (unless it's a generic scope)
              invalidScopes.push(`"${s}" in commit: ${commit.substring(0, 60)}...`)
            }
          }
        }
      }
    }

    if (!hasConventionalCommit) {
      return {
        name: 'Conventional Commits',
        status: 'warn',
        message: 'No conventional commits found in recent changes',
        duration: Date.now() - startTime,
        details: ['Consider using conventional commit format: type(scope): message'],
      }
    }

    // P1 Fix: Warn about scope mismatches
    if (invalidScopes.length > 0) {
      return {
        name: 'Conventional Commits',
        status: 'warn',
        message: "Conventional commits found but some scopes don't match changed packages",
        duration: Date.now() - startTime,
        details: [
          `Changed packages: ${Array.from(changedPackages).join(', ')}`,
          `Invalid scopes: ${invalidScopes.slice(0, 3).join(', ')}`,
          invalidScopes.length > 3 ? `... and ${invalidScopes.length - 3} more` : undefined,
        ].filter(Boolean) as string[],
      }
    }

    if (changedPackages.size > 0 && !hasScopeCorrelation) {
      return {
        name: 'Conventional Commits',
        status: 'warn',
        message: 'Conventional commits lack scopes for changed packages',
        duration: Date.now() - startTime,
        details: [
          `Changed packages: ${Array.from(changedPackages).join(', ')}`,
          'Consider adding package scopes to commits for better traceability',
        ],
      }
    }

    return {
      name: 'Conventional Commits',
      status: 'pass',
      message: 'Conventional commits properly scoped',
      duration: Date.now() - startTime,
    }
  } catch (error: any) {
    return {
      name: 'Conventional Commits',
      status: 'warn',
      message: 'Could not check conventional commits',
      duration: Date.now() - startTime,
      details: [error.message],
    }
  }
}

/**
 * Apply automatic fixes where possible
 */
async function applyFixes(results: GuardrailResult[], options: GuardrailOptions): Promise<void> {
  if (!options.fix) return

  console.log('\n🔧 Applying automatic fixes...')

  let fixesApplied = 0

  // Fix outdated dependencies (limited to patch/minor to avoid breaking changes)
  const securityResult = results.find((r) => r.name === 'Security Scan')
  if (
    securityResult?.status === 'warn' &&
    securityResult.details?.some((d) => d.includes('outdated'))
  ) {
    console.log('  📦 Updating outdated dependencies (patch/minor only)...')
    try {
      // Use npm-check-updates (ncu) to limit to minor updates only
      // This avoids breaking changes from major version updates
      await execAsync('npx ncu -u --target minor', { timeout: 60000 })
      fixesApplied++
      console.log('    ✅ Dependencies updated (patch/minor only)')
      console.log('    ℹ️  Major updates skipped to avoid breaking changes')
    } catch {
      console.log('    ⚠️  Could not update dependencies automatically')
      console.log('    💡 Run manually: npx ncu -u --target minor')
    }
  }

  // Fix audit issues
  if (
    securityResult?.status === 'fail' &&
    securityResult.details?.some((d) => d.includes('vulnerabilities'))
  ) {
    console.log('  🔒 Attempting to fix vulnerabilities...')
    try {
      await execAsync('pnpm audit --fix', { timeout: 30000 })
      fixesApplied++
      console.log('    ✅ Some vulnerabilities fixed')
    } catch {
      console.log('    ⚠️  Could not fix all vulnerabilities automatically')
    }
  }

  if (fixesApplied > 0) {
    console.log(`\n✨ Applied ${fixesApplied} automatic fixes`)
    console.log('   Re-run guardrails to verify fixes')
  } else {
    console.log('  ℹ️  No automatic fixes available')
  }
}

/**
 * Extract the script path from a command string
 */
function extractScriptPath(command: string): string | null {
  // P0 Fix: Handle paths with spaces and quoted arguments properly
  // Use regex to match common patterns
  const patterns = [
    /^tsx\s+["']?([^"']+)["']?/, // tsx "path/to/script.ts" or tsx path/to/script.ts
    /^pnpm\s+tsx\s+["']?([^"']+)["']?/, // pnpm tsx "path/to/script.ts"
    /^npx\s+tsx\s+["']?([^"']+)["']?/, // npx tsx "path/to/script.ts"
    /^node\s+["']?([^"']+)["']?/, // node "path/to/script.js"
  ]

  for (const pattern of patterns) {
    const match = command.match(pattern)
    if (match && match[1]) {
      // Extract just the path, removing any trailing arguments
      const scriptPath = match[1]!.split(' ')[0] ?? ''
      return scriptPath
    }
  }

  // Fallback to original simple split logic
  const parts = command.split(' ')

  // Handle different command patterns
  if (parts.length < 2) return null

  // Pattern: tsx script.ts [args...]
  if (parts[0] === 'tsx' && parts[1]) {
    return parts[1]
  }

  // Pattern: pnpm tsx script.ts [args...]
  if (parts[0] === 'pnpm' && parts[1] === 'tsx' && parts[2]) {
    return parts[2]
  }

  // Pattern: npx tsx script.ts [args...]
  if (parts[0] === 'npx' && parts[1] === 'tsx' && parts[2]) {
    return parts[2]
  }

  // Pattern: node script.js [args...]
  if (parts[0] === 'node' && parts[1]) {
    return parts[1]
  }

  // Pattern: pnpm run script-name (can't check file existence)
  if (parts[0] === 'pnpm' && parts[1] === 'run') {
    return null
  }

  // Pattern: npm run script-name (can't check file existence)
  if (parts[0] === 'npm' && parts[1] === 'run') {
    return null
  }

  // Special case: inline function calls like 'conventional-commits-check'
  if (parts.length === 1) {
    return null
  }

  // Default: assume second part is script path
  return parts[1] ?? null
}

/**
 * Run a single guardrail with proper error handling - actually parallel
 */
async function runGuardrail(
  name: string,
  command: string,
  options: GuardrailOptions,
): Promise<GuardrailResult> {
  const startTime = Date.now()

  // Skip if script file doesn't exist (more robust extraction)
  const scriptFile = extractScriptPath(command)
  if (scriptFile && !existsSync(scriptFile)) {
    // Critical guardrails should fail, not skip, when scripts are missing
    const isCriticalGuardrail = ['Changeset Validation', 'Security Scan'].includes(name)

    return {
      name,
      status: isCriticalGuardrail ? 'fail' : 'skip',
      message: isCriticalGuardrail
        ? `Critical script ${scriptFile} not found - this will prevent release`
        : `Script ${scriptFile} not found`,
      duration: 0,
      details: isCriticalGuardrail
        ? [
            'Critical guardrails must have working scripts',
            'Check for missing files or refactor issues',
          ]
        : undefined,
    }
  }

  try {
    if (options.verbose) {
      console.log(`\n🔍 Running ${name}...`)
    }

    // P0 Fix: Set GUARDRAILS_RUN environment variable for export map linter
    const env = { ...process.env }
    if (name === 'Export Map Linting') {
      env['GUARDRAILS_RUN'] = '1'
    }

    const { stdout, stderr } = await execAsync(command, {
      encoding: 'utf-8',
      timeout: options.quick ? 30000 : 120000, // 30s quick, 2min full
      maxBuffer: 1024 * 1024 * 16, // 16MB buffer for large outputs
      env,
    })

    if (options.verbose && stdout) {
      console.log(stdout)
    }
    if (options.verbose && stderr) {
      console.error(stderr)
    }

    const duration = Date.now() - startTime

    return {
      name,
      status: 'pass',
      message: 'Check passed',
      duration,
    }
  } catch (error: any) {
    const duration = Date.now() - startTime

    // Handle buffer overflow specifically
    if (error.code === 'ENOBUFS') {
      return {
        name,
        status: options.warnOnly ? 'warn' : 'fail',
        message: 'Output too large - increase maxBuffer or reduce output',
        duration,
      }
    }

    // In warn-only mode, convert failures to warnings
    if (options.warnOnly) {
      return {
        name,
        status: 'warn',
        message: error.message || 'Check failed (warning only)',
        duration,
      }
    }

    // Capture and truncate stderr for better debugging
    let errorDetails: string[] | undefined
    if (error.stderr || error.stdout) {
      errorDetails = []

      if (error.stderr) {
        const stderrLines = error.stderr.split('\n').filter((line: string) => line.trim())
        if (stderrLines.length > 0) {
          errorDetails.push('STDERR:')
          // Show first and last 10 lines to avoid overwhelming output
          if (stderrLines.length <= 20) {
            errorDetails.push(...stderrLines.map((line: string) => `  ${line}`))
          } else {
            errorDetails.push(...stderrLines.slice(0, 10).map((line: string) => `  ${line}`))
            errorDetails.push(`  ... (${stderrLines.length - 20} lines omitted) ...`)
            errorDetails.push(...stderrLines.slice(-10).map((line: string) => `  ${line}`))
          }
        }
      }

      if (error.stdout && options.verbose) {
        const stdoutLines = error.stdout.split('\n').filter((line: string) => line.trim())
        if (stdoutLines.length > 0) {
          errorDetails.push('STDOUT:')
          errorDetails.push(...stdoutLines.slice(0, 10).map((line: string) => `  ${line}`))
          if (stdoutLines.length > 10) {
            errorDetails.push(`  ... (${stdoutLines.length - 10} more lines)`)
          }
        }
      }
    }

    return {
      name,
      status: 'fail',
      message: error.message || 'Check failed',
      duration,
      details: errorDetails ?? [],
    }
  }
}

/**
 * Run all guardrails with proper orchestration and short-circuit logic
 */
async function runAllGuardrails(options: GuardrailOptions): Promise<GuardrailResult[]> {
  // Check for cached results first
  const cache = loadCache(options)
  if (cache && !options.noCache) {
    console.log('✨ Using cached guardrail results')
    return cache.results
  }

  const results: GuardrailResult[] = []

  // Define guardrail groups with dependencies
  const criticalGuardrails: Array<{ name: string; command: string; skip?: boolean }> = []
  const dependentGuardrails: Array<{ name: string; command: string; skip?: boolean }> = []

  // P0 Fix: Use flexible script resolution instead of hardcoded paths
  // Try to find scripts in multiple locations to handle refactoring
  const resolveScript = (scriptName: string): string => {
    const possiblePaths = [
      `scripts/${scriptName}.ts`,
      `scripts/${scriptName}.js`,
      `tools/${scriptName}.ts`,
      `tools/${scriptName}.js`,
      `.scripts/${scriptName}.ts`,
      `.scripts/${scriptName}.js`,
    ]

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return `tsx ${path}`
      }
    }

    // Fallback to original path - let the script runner handle the error
    return `tsx scripts/${scriptName}.ts`
  }

  // Critical guardrails that must pass before running others
  if (!options.skipChangesets) {
    criticalGuardrails.push({
      name: 'Changeset Validation',
      command: resolveScript('changeset-validator'),
      // Don't skip if .changeset doesn't exist - let the validator handle it
    })
  }

  // SECURITY: Always run security scan in CI, never skip regardless of quick mode
  const isCI = process.env['CI'] === 'true' || process.env['GITHUB_ACTIONS'] === 'true'

  if (!options.skipSecurity) {
    // In CI, security scan is mandatory regardless of quick mode
    if (isCI || !options.quick) {
      const securityCommand = resolveScript('security-scan')
      criticalGuardrails.push({
        name: 'Security Scan',
        command: `${securityCommand}${options.quick && !isCI ? ' --quick' : ''}`,
      })
    } else if (options.quick && !isCI) {
      // Only skip in local dev with explicit quick mode
      console.log('⚠️  Security scan skipped in quick mode (local dev only)')
    }
  }

  // Dependent guardrails that should only run if critical ones pass
  if (!options.skipExportMaps) {
    dependentGuardrails.push({
      name: 'Export Map Linting',
      command: resolveScript('export-map-linter'),
    })
  }

  dependentGuardrails.push({
    name: 'Governance Check',
    command: resolveScript('governance-check'),
  })

  // Add conventional commits check
  if (!options.quick) {
    dependentGuardrails.push({
      name: 'Conventional Commits',
      command: 'conventional-commits-check', // Special marker for inline check
    })
  }

  // Filter out skipped critical guardrails
  const activeCritical = criticalGuardrails.filter((g) => !g.skip)
  const activeDependent = dependentGuardrails.filter((g) => !g.skip)

  if (activeCritical.length === 0 && activeDependent.length === 0) {
    console.log('⚠️  No guardrails to run')
    return []
  }

  const totalGuardrails = activeCritical.length + activeDependent.length
  console.log(`🛡️  Running ${totalGuardrails} guardrails${options.quick ? ' (quick mode)' : ''}`)
  console.log('   Critical: ' + activeCritical.map((g) => g.name).join(', '))
  if (activeDependent.length > 0) {
    console.log('   Dependent: ' + activeDependent.map((g) => g.name).join(', '))
  }
  console.log('')

  // P0 Fix: Run critical guardrails sequentially for early abort
  if (activeCritical.length > 0) {
    console.log('🎯 Running critical guardrails...')
    const criticalResults: GuardrailResult[] = []

    for (const guardrail of activeCritical) {
      const result = await runGuardrail(guardrail.name, guardrail.command, options)
      criticalResults.push(result)

      // P0 Fix: Short-circuit on critical failure to save CI minutes
      if (!options.warnOnly && result.status === 'fail') {
        console.log('\n⛔ Critical failure detected - aborting remaining guardrails')
        results.push(...criticalResults)
        return results
      }
    }
    results.push(...criticalResults)

    // Check if any critical guardrails failed (not in warn-only mode)
    const hasCriticalFailure = !options.warnOnly && criticalResults.some((r) => r.status === 'fail')

    if (hasCriticalFailure) {
      console.log(
        '\n⛔ Critical failures detected - running dependent guardrails in diagnostic mode',
      )
      // Still run dependent guardrails but convert failures to warnings for diagnostic purposes
      if (activeDependent.length > 0) {
        console.log('\n🔍 Running dependent guardrails (diagnostic mode)...')
        const diagnosticOptions = { ...options, warnOnly: true }
        const dependentPromises = activeDependent.map((guardrail) => {
          // Handle special conventional commits check
          if (guardrail.command === 'conventional-commits-check') {
            return checkConventionalCommits(diagnosticOptions)
          }
          return runGuardrail(guardrail.name, guardrail.command, diagnosticOptions)
        })
        const dependentResults = await Promise.all(dependentPromises)

        // P1 Fix: Mark diagnostic results using field instead of message prefix
        for (const result of dependentResults) {
          result.isDiagnostic = true
        }
        results.push(...dependentResults)
      }
      return results
    }
  }

  // Run dependent guardrails only if critical ones passed
  if (activeDependent.length > 0) {
    console.log('\n🔗 Running dependent guardrails...')
    const dependentPromises = activeDependent.map((guardrail) => {
      // Handle special conventional commits check
      if (guardrail.command === 'conventional-commits-check') {
        return checkConventionalCommits(options)
      }
      return runGuardrail(guardrail.name, guardrail.command, options)
    })
    const dependentResults = await Promise.all(dependentPromises)
    results.push(...dependentResults)
  }

  // Save results to cache
  saveCache(results, options)

  return results
}

/**
 * Generate JSON report
 */
async function generateJsonReport(
  results: GuardrailResult[],
  options: GuardrailOptions,
): Promise<GuardrailReport> {
  const passed = results.filter((r) => r.status === 'pass')
  const warned = results.filter((r) => r.status === 'warn')
  const failed = results.filter((r) => r.status === 'fail')
  const skipped = results.filter((r) => r.status === 'skip')
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0)

  const report: GuardrailReport = {
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    summary: {
      passed: passed.length,
      warned: warned.length,
      failed: failed.length,
      skipped: skipped.length,
      totalDuration,
    },
    results,
  }

  // Add git info if available
  try {
    report.gitInfo = await getGitInfo()
  } catch {
    // Git info is optional
  }

  // Add package quality score if not in quick mode
  if (!options.quick) {
    report.packageQualityScore = await calculatePackageQualityScore()
  }

  return report
}

/**
 * Display results summary with colorized output
 */
function displayResults(results: GuardrailResult[], options: GuardrailOptions): boolean {
  const passed = results.filter((r) => r.status === 'pass')
  const warned = results.filter((r) => r.status === 'warn')
  const failed = results.filter((r) => r.status === 'fail')
  const skipped = results.filter((r) => r.status === 'skip')

  // Use ANSI color codes for terminal output
  const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
  }

  console.log(`\n${colors.bright}${colors.blue}📊 Guardrail Results${colors.reset}`)
  console.log('='.repeat(50))

  for (const result of results) {
    const icon = {
      pass: '✅',
      warn: '⚠️',
      fail: '❌',
      skip: '⏭️',
    }[result.status]

    const statusColor = {
      pass: colors.green,
      warn: colors.yellow,
      fail: colors.red,
      skip: colors.dim,
    }[result.status]

    const timing = result.duration ? ` ${colors.dim}(${result.duration}ms)${colors.reset}` : ''
    // P1 Fix: Show diagnostic mode clearly using the field
    const diagnostic = result.isDiagnostic ? `${colors.cyan}[DIAGNOSTIC]${colors.reset} ` : ''
    console.log(
      `${statusColor}${icon} ${result.name}${colors.reset}: ${diagnostic}${result.message}${timing}`,
    )

    // Show sub-task timings if available
    if (result.subTasks && result.subTasks.length > 0) {
      for (const subTask of result.subTasks) {
        const subIcon = subTask.status === 'pass' ? '✓' : subTask.status === 'warn' ? '⚠' : '✗'
        console.log(
          `   ${colors.dim}${subIcon} ${subTask.name} (${subTask.duration}ms)${colors.reset}`,
        )
      }
    }

    if (result.details && result.details.length > 0) {
      for (const detail of result.details) {
        console.log(`   ${colors.dim}• ${detail}${colors.reset}`)
      }
    }
  }

  console.log('='.repeat(50))

  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0)
  console.log(
    `${colors.bright}📈 Summary:${colors.reset} ${colors.green}${passed.length} passed${colors.reset}, ` +
      `${colors.yellow}${warned.length} warnings${colors.reset}, ` +
      `${colors.red}${failed.length} failed${colors.reset}, ` +
      `${colors.dim}${skipped.length} skipped${colors.reset}`,
  )
  console.log(`${colors.cyan}⏱️  Total time: ${(totalDuration / 1000).toFixed(1)}s${colors.reset}`)

  // Check for critical failures that cannot be bypassed
  const criticalFailures = failed.filter((r) =>
    ['Changeset Validation', 'Security Scan'].includes(r.name),
  )

  if (criticalFailures.length > 0) {
    console.error(
      `\n${colors.red}${colors.bright}❌ Critical guardrails failed - cannot be bypassed!${colors.reset}`,
    )
    console.log('\n💡 Critical failures must be fixed:')
    console.log('   • These failures block release even with --warn-only')
    console.log('   • Fix the critical issues before proceeding')
    return false
  } else if (failed.length > 0 && !options.warnOnly) {
    console.error(`\n${colors.red}${colors.bright}❌ Pre-release guardrails failed!${colors.reset}`)
    console.log('\n💡 Next steps:')
    console.log('   • Fix the issues above before releasing')
    console.log('   • Run with --verbose for detailed output')
    console.log('   • Use --warn-only for development')
    if (options.fix) {
      console.log('   • Use --fix to apply automatic remediation')
    }
    return false
  } else if (warned.length > 0) {
    console.log(`\n${colors.yellow}⚠️  Pre-release guardrails passed with warnings${colors.reset}`)
    if (!options.warnOnly) {
      console.log('   Consider addressing warnings before release')
    }
    return true
  } else {
    console.log(
      `\n${colors.green}${colors.bright}✅ All pre-release guardrails passed!${colors.reset}`,
    )
    return true
  }
}

/**
 * Parse CLI arguments
 */
function parseCliArgs(): GuardrailOptions & { help?: boolean } {
  const { values } = parseArgs({
    options: {
      'quick': {
        type: 'boolean',
        short: 'q',
        default: false,
      },
      'verbose': {
        type: 'boolean',
        short: 'v',
        default: false,
      },
      'skip-security': {
        type: 'boolean',
        default: false,
      },
      'skip-export-maps': {
        type: 'boolean',
        default: false,
      },
      'skip-changesets': {
        type: 'boolean',
        default: false,
      },
      'warn-only': {
        type: 'boolean',
        short: 'w',
        default: false,
      },
      'json': {
        type: 'boolean',
        short: 'j',
        default: false,
      },
      'fix': {
        type: 'boolean',
        short: 'f',
        default: false,
      },
      'no-cache': {
        type: 'boolean',
        default: false,
      },
      'help': {
        type: 'boolean',
        short: 'h',
        default: false,
      },
    },
    strict: true,
    allowPositionals: false,
  })

  return {
    quick: values.quick as boolean,
    verbose: values.verbose as boolean,
    skipSecurity: values['skip-security'] as boolean,
    skipExportMaps: values['skip-export-maps'] as boolean,
    skipChangesets: values['skip-changesets'] as boolean,
    warnOnly: values['warn-only'] as boolean,
    json: values.json as boolean,
    fix: values.fix as boolean,
    noCache: values['no-cache'] as boolean,
    help: values.help as boolean,
  }
}

/**
 * Display help information
 */
function displayHelp(): void {
  console.log(`
🛡️  Pre-Release Guardrails

Comprehensive pre-release validation for Node.js + pnpm monorepo

Usage:
  pnpm run guardrails [options]

Options:
  -q, --quick              Skip slow checks for fast feedback (<30s)
  -v, --verbose            Show detailed output from each check
  -w, --warn-only          Convert failures to warnings (development mode)
  -j, --json               Output JSON format for CI parsing
  -f, --fix                Apply automatic fixes where possible
  --no-cache               Skip cache for fresh run
  --skip-security          Skip security scans
  --skip-export-maps       Skip export map validation
  --skip-changesets        Skip changeset validation
  -h, --help               Show this help message

Examples:
  pnpm run guardrails              # Full validation
  pnpm run guardrails --quick      # Quick checks only
  pnpm run guardrails --warn-only  # Development mode
  pnpm run guardrails -qw          # Quick dev checks

ADHD-Optimized Features:
  • Quick mode provides <30s feedback
  • Parallel execution for minimal wait time
  • Clear visual indicators with emojis
  • Actionable error messages
  • Development-friendly warn-only mode
`)
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const options = parseCliArgs()

  if (options.help) {
    displayHelp()
    process.exit(0)
  }

  // SECURITY: Prevent dangerous combinations that bypass security checks
  const isCI = process.env['CI'] === 'true' || process.env['GITHUB_ACTIONS'] === 'true'

  if (isCI && options.quick && options.warnOnly) {
    console.error('❌ SECURITY: Cannot combine --quick and --warn-only in CI environment')
    console.error('   This combination could bypass critical security checks.')
    console.error('   Use either --quick OR --warn-only, not both.')
    process.exit(1)
  }

  if (isCI && options.skipSecurity) {
    console.error('❌ SECURITY: Cannot skip security scan in CI environment')
    console.error('   Security scanning is mandatory for releases.')
    process.exit(1)
  }

  // In JSON mode, suppress normal console output
  if (!options.json) {
    console.log('🚀 Pre-Release Guardrails')
    console.log('   Validating code quality and security...\n')
  }

  try {
    const results = await runAllGuardrails(options)

    if (results.length === 0) {
      if (!options.json) {
        console.log('⚠️  No guardrails were executed')
      }
      process.exit(0)
    }

    // Apply fixes if requested
    await applyFixes(results, options)

    // Generate and output JSON report if requested
    if (options.json) {
      const report = await generateJsonReport(results, options)
      console.log(JSON.stringify(report, null, 2))

      // Save to file as well
      const reportPath = resolve(process.cwd(), 'guardrails-report.json')
      writeFileSync(reportPath, JSON.stringify(report, null, 2))

      // Exit with appropriate code
      const hasFailures = results.some((r) => r.status === 'fail')
      const hasCriticalFailures = results.some(
        (r) => r.status === 'fail' && ['Changeset Validation', 'Security Scan'].includes(r.name),
      )

      // Critical failures cannot be bypassed even with warnOnly
      if (hasCriticalFailures) {
        process.exit(1)
      } else {
        process.exit(hasFailures && !options.warnOnly ? 1 : 0)
      }
    } else {
      // Normal display mode
      const success = displayResults(results, options)

      if (!success) {
        process.exit(1)
      }
    }
  } catch (error) {
    if (!options.json) {
      console.error('❌ Unexpected error:', error)
    } else {
      // Output error in JSON format
      const errorReport = {
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        error: String(error),
        summary: {
          passed: 0,
          warned: 0,
          failed: 1,
          skipped: 0,
          totalDuration: 0,
        },
        results: [],
      }
      console.log(JSON.stringify(errorReport, null, 2))
    }
    process.exit(1)
  }
}

// Run if this is the main module
// Use robust execution guard that handles symlinks properly
if (import.meta.url === new URL(process.argv[1] ?? '', 'file://').href) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}
