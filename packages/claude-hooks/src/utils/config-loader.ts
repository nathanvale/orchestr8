/**
 * Configuration loading utilities
 */

import { promises as fs, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * Load JSON configuration file with environment variable overrides
 */
export async function loadConfig<T extends Record<string, unknown>>(
  configPath: string,
  envOverrides: Record<string, (value: string | undefined) => unknown> = {},
): Promise<T | null> {
  let fileConfig: T | null = null

  // Try to load file config
  try {
    const content = await fs.readFile(configPath, 'utf8')
    fileConfig = JSON.parse(content) as T
  } catch {
    // Config file not found or invalid
    return null
  }

  // Apply environment variable overrides
  const config = { ...fileConfig }

  for (const [envKey, transformer] of Object.entries(envOverrides)) {
    const envValue = process.env[envKey]
    if (envValue !== undefined) {
      const transformed = transformer(envValue)
      if (transformed !== undefined) {
        // Apply the transformed value to the config
        // This is a simplified version - in real implementation
        // we'd need to handle nested paths
        Object.assign(config, transformed)
      }
    }
  }

  return config
}

/**
 * Find project root by looking for monorepo indicators or package.json
 * Priority order:
 * 1. Directory with pnpm-workspace.yaml (pnpm monorepo)
 * 2. Directory with lerna.json (lerna monorepo)
 * 3. Directory with .claude/hooks (explicit config directory)
 * 4. Directory with package.json (regular project)
 */
export function findProjectRoot(startPath: string): string {
  let currentPath = startPath
  let foundPackageJsonAt: string | null = null

  while (currentPath !== '/') {
    // Check for monorepo indicators first
    try {
      // Check for pnpm workspace
      const pnpmStat = statSync(path.join(currentPath, 'pnpm-workspace.yaml'))
      if (pnpmStat.isFile()) {
        return currentPath
      }
    } catch {
      // Not a pnpm workspace
    }

    try {
      // Check for lerna monorepo
      const lernaStat = statSync(path.join(currentPath, 'lerna.json'))
      if (lernaStat.isFile()) {
        return currentPath
      }
    } catch {
      // Not a lerna monorepo
    }

    try {
      // Check for .claude/hooks directory
      const claudeStat = statSync(path.join(currentPath, '.claude', 'hooks'))
      if (claudeStat.isDirectory()) {
        return currentPath
      }
    } catch {
      // No .claude/hooks directory
    }

    // Remember the first package.json we find, but keep looking for monorepo root
    if (foundPackageJsonAt == null || foundPackageJsonAt === '') {
      try {
        const packageStat = statSync(path.join(currentPath, 'package.json'))
        if (packageStat.isFile()) {
          // Store the location but continue searching for monorepo root
          foundPackageJsonAt = currentPath
        }
      } catch {
        // No package.json here
      }
    }

    currentPath = path.dirname(currentPath)
  }

  // If we found a package.json earlier, use that
  if (foundPackageJsonAt != null && foundPackageJsonAt !== '') {
    return foundPackageJsonAt
  }

  return process.cwd()
}

/**
 * Find the monorepo root by looking for workspace indicators
 * This is more aggressive than findProjectRoot and specifically looks for monorepo markers
 */
export function findMonorepoRoot(startPath: string): string | null {
  let currentPath = startPath

  while (currentPath !== '/') {
    // Check for pnpm workspace
    try {
      const pnpmStat = statSync(path.join(currentPath, 'pnpm-workspace.yaml'))
      if (pnpmStat.isFile()) {
        return currentPath
      }
    } catch {
      // Not a pnpm workspace
    }

    // Check for lerna monorepo
    try {
      const lernaStat = statSync(path.join(currentPath, 'lerna.json'))
      if (lernaStat.isFile()) {
        return currentPath
      }
    } catch {
      // Not a lerna monorepo
    }

    // Check for yarn workspaces (package.json with workspaces field)
    try {
      const packagePath = path.join(currentPath, 'package.json')
      const packageStat = statSync(packagePath)
      if (packageStat.isFile()) {
        const packageContent = JSON.parse(readFileSync(packagePath, 'utf8'))
        if (packageContent.workspaces != null) {
          return currentPath
        }
      }
    } catch {
      // Not a yarn workspace root
    }

    currentPath = path.dirname(currentPath)
  }

  return null
}

/**
 * Parse boolean environment variable
 */
export function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined) return defaultValue
  return value !== 'false'
}

/**
 * Parse integer environment variable
 */
export function parseInteger(value: string | undefined, defaultValue = 0): number {
  if (value === undefined) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}
