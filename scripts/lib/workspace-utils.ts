#!/usr/bin/env tsx
/**
 * Centralized workspace package discovery and utilities
 * Provides consistent workspace operations across all scripts
 */

import { glob } from 'glob'
import { existsSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

export interface PackageInfo {
  name: string
  version: string
  path: string
  relativePath: string
  packageJson: Record<string, unknown>
  isPrivate: boolean
  hasChanges?: boolean
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

export interface WorkspaceConfig {
  rootPath: string
  packages: PackageInfo[]
  workspacePatterns: string[]
}

/**
 * Discovers all workspace packages based on pnpm-workspace.yaml
 */
export async function discoverWorkspacePackages(
  rootPath: string = process.cwd(),
): Promise<WorkspaceConfig> {
  const workspaceFile = join(rootPath, 'pnpm-workspace.yaml')

  if (!existsSync(workspaceFile)) {
    throw new Error(`No pnpm-workspace.yaml found at ${rootPath}`)
  }

  // Parse workspace patterns
  const workspaceContent = readFileSync(workspaceFile, 'utf-8')
  const workspacePatterns = parseWorkspacePatterns(workspaceContent)

  // Find all package.json files matching patterns
  const packages = await findPackages(rootPath, workspacePatterns)

  return {
    rootPath,
    packages,
    workspacePatterns,
  }
}

/**
 * Parse workspace patterns from pnpm-workspace.yaml
 */
function parseWorkspacePatterns(content: string): string[] {
  const patterns: string[] = []
  const lines = content.split('\n')

  let inPackagesSection = false
  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed === 'packages:') {
      inPackagesSection = true
      continue
    }

    if (inPackagesSection) {
      if (trimmed.startsWith('-')) {
        // Extract pattern, handle quotes
        const pattern = trimmed
          .slice(1)
          .trim()
          .replace(/^['"]|['"]$/g, '')
        patterns.push(pattern)
      } else if (trimmed && !trimmed.startsWith('#')) {
        // End of packages section
        break
      }
    }
  }

  return patterns
}

/**
 * Find all packages matching workspace patterns
 */
async function findPackages(rootPath: string, patterns: string[]): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = []
  const seen = new Set<string>()

  for (const pattern of patterns) {
    // Convert workspace pattern to glob pattern
    const globPattern = pattern.endsWith('/*')
      ? `${pattern}/package.json`
      : pattern.endsWith('/**')
        ? `${pattern}/package.json`
        : `${pattern}/package.json`

    const matches = await glob(globPattern, {
      cwd: rootPath,
      absolute: false,
      ignore: ['**/node_modules/**'],
    })

    for (const match of matches) {
      const packagePath = resolve(rootPath, match).replace('/package.json', '')

      // Skip duplicates
      if (seen.has(packagePath)) continue
      seen.add(packagePath)

      const packageJsonPath = join(packagePath, 'package.json')
      if (!existsSync(packageJsonPath)) continue

      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

        packages.push({
          name: packageJson.name || 'unknown',
          version: packageJson.version || '0.0.0',
          path: packagePath,
          relativePath: relative(rootPath, packagePath),
          packageJson,
          isPrivate: packageJson.private === true,
          dependencies: packageJson.dependencies,
          devDependencies: packageJson.devDependencies,
          peerDependencies: packageJson.peerDependencies,
        })
      } catch (error) {
        console.warn(`Failed to parse ${packageJsonPath}:`, error)
      }
    }
  }

  // Sort packages by path for consistent ordering
  return packages.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

/**
 * Get only public packages (for publishing)
 */
export function getPublicPackages(workspace: WorkspaceConfig): PackageInfo[] {
  return workspace.packages.filter((pkg) => !pkg.isPrivate)
}

/**
 * Get package by name
 */
export function getPackageByName(
  workspace: WorkspaceConfig,
  name: string,
): PackageInfo | undefined {
  return workspace.packages.find((pkg) => pkg.name === name)
}

/**
 * Check if a package has a specific dependency
 */
export function hasDependency(pkg: PackageInfo, depName: string, includeDevDeps = true): boolean {
  return !!(
    pkg.dependencies?.[depName] ||
    pkg.peerDependencies?.[depName] ||
    (includeDevDeps && pkg.devDependencies?.[depName])
  )
}

/**
 * Get all packages that depend on a specific package
 */
export function getDependents(
  workspace: WorkspaceConfig,
  packageName: string,
  includeDevDeps = true,
): PackageInfo[] {
  return workspace.packages.filter((pkg) => hasDependency(pkg, packageName, includeDevDeps))
}

/**
 * Get workspace root package.json
 */
export function getRootPackageJson(rootPath: string = process.cwd()): Record<string, unknown> {
  const packageJsonPath = join(rootPath, 'package.json')
  if (!existsSync(packageJsonPath)) {
    throw new Error(`No package.json found at ${rootPath}`)
  }

  return JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.JENKINS_URL ||
    process.env.TEAMCITY_VERSION
  )
}

/**
 * Check if running in GitHub Actions
 */
export function isGitHubActions(): boolean {
  return !!process.env.GITHUB_ACTIONS
}

export default {
  discoverWorkspacePackages,
  getPublicPackages,
  getPackageByName,
  hasDependency,
  getDependents,
  getRootPackageJson,
  isCI,
  isGitHubActions,
}
