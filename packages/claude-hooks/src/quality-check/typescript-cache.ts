/**
 * TypeScript configuration cache management
 */

import crypto from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { findProjectRoot } from '../utils/config-loader.js'

interface CacheData {
  hashes: Record<string, string>
  mappings: Record<string, { configPath: string; excludes: string[] }>
}

/**
 * Intelligent TypeScript Config Cache with checksum validation
 * Handles multiple tsconfig files and maps files to appropriate configs
 */
export class TypeScriptConfigCache {
  private cacheFile: string
  private cache: CacheData
  private projectRoot: string

  constructor(hookDir: string) {
    this.projectRoot = findProjectRoot(hookDir)
    // Store cache in a location that won't interfere with Turborepo
    // Using .claude directory which is likely gitignored
    this.cacheFile = path.join(hookDir, 'tsconfig-cache.json')
    this.cache = { hashes: {}, mappings: {} }
    this.loadCache()
  }

  /**
   * Get config hash for cache validation
   */
  private getConfigHash(configPath: string): string | null {
    try {
      const content = readFileSync(configPath, 'utf8')
      return crypto.createHash('sha256').update(content).digest('hex')
    } catch {
      return null
    }
  }

  /**
   * Find all tsconfig files in project
   */
  private findTsConfigFiles(): string[] {
    const configs: string[] = []

    // Common config files to check
    const commonConfigs = [
      'tsconfig.json',
      'tsconfig.webview.json',
      'tsconfig.test.json',
      'tsconfig.node.json',
    ]

    for (const config of commonConfigs) {
      const configPath = path.join(this.projectRoot, config)
      if (existsSync(configPath)) {
        configs.push(configPath)
      }
    }

    return configs
  }

  /**
   * Check if cache is valid by comparing config hashes
   * This complements Turborepo's caching by providing finer-grained
   * invalidation for TypeScript config resolution
   */
  isValid(): boolean {
    const configFiles = this.findTsConfigFiles()

    // Check if we have the same number of configs
    if (Object.keys(this.cache.hashes).length !== configFiles.length) {
      return false
    }

    // Check each config hash
    for (const configPath of configFiles) {
      const currentHash = this.getConfigHash(configPath)
      if (currentHash !== this.cache.hashes[configPath]) {
        return false
      }
    }

    // In a Turborepo environment, also consider if Turborepo's
    // cache has been invalidated (tsconfig files are in globalDependencies)
    return true
  }

  /**
   * Rebuild cache by parsing all configs and creating file mappings
   */
  rebuild(): void {
    this.cache = { hashes: {}, mappings: {} }

    // Process configs in priority order (most specific first)
    const configPriority = ['tsconfig.webview.json', 'tsconfig.test.json', 'tsconfig.json']

    for (const configName of configPriority) {
      const configPath = path.join(this.projectRoot, configName)
      if (!existsSync(configPath)) {
        continue
      }

      // Store hash for validation
      const hash = this.getConfigHash(configPath)
      if (hash) {
        this.cache.hashes[configPath] = hash
      }

      try {
        const configContent = readFileSync(configPath, 'utf8')
        const config = JSON.parse(configContent)

        // Build file pattern mappings
        if (config.include) {
          for (const pattern of config.include) {
            // Only set if not already mapped by a more specific config
            if (!this.cache.mappings[pattern]) {
              this.cache.mappings[pattern] = {
                configPath,
                excludes: config.exclude || [],
              }
            }
          }
        }
      } catch {
        // Skip invalid configs
      }
    }

    this.saveCache()
  }

  /**
   * Load cache from disk
   */
  private loadCache(): void {
    try {
      const cacheContent = readFileSync(this.cacheFile, 'utf8')
      this.cache = JSON.parse(cacheContent) as CacheData
    } catch {
      // Cache doesn't exist or is invalid, will rebuild
      this.cache = { hashes: {}, mappings: {} }
    }
  }

  /**
   * Save cache to disk
   */
  private saveCache(): void {
    try {
      writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2))
    } catch {
      // Ignore cache save errors
    }
  }

  /**
   * Get appropriate tsconfig for a file
   */
  getTsConfigForFile(filePath: string): string {
    // Ensure cache is valid
    if (!this.isValid()) {
      this.rebuild()
    }

    const relativePath = path.relative(this.projectRoot, filePath)

    // Check cached mappings
    const sortedMappings = Object.entries(this.cache.mappings).sort(([a], [b]) => {
      const aSpecificity = a.split('/').length + (a.includes('**') ? 0 : 10)
      const bSpecificity = b.split('/').length + (b.includes('**') ? 0 : 10)
      return bSpecificity - aSpecificity
    })

    for (const [pattern, mapping] of sortedMappings) {
      if (this.matchesPattern(relativePath, pattern)) {
        // Check if file is excluded
        let isExcluded = false
        for (const exclude of mapping.excludes) {
          if (this.matchesPattern(relativePath, exclude)) {
            isExcluded = true
            break
          }
        }

        if (!isExcluded) {
          return mapping.configPath
        }
      }
    }

    // Fast heuristics for common cases
    if (relativePath.includes('webview/')) {
      const webviewConfig = path.join(this.projectRoot, 'tsconfig.webview.json')
      if (existsSync(webviewConfig)) {
        return webviewConfig
      }
    }

    if (relativePath.includes('.test.') || relativePath.includes('.spec.')) {
      const testConfig = path.join(this.projectRoot, 'tsconfig.test.json')
      if (existsSync(testConfig)) {
        return testConfig
      }
    }

    // Default fallback
    return path.join(this.projectRoot, 'tsconfig.json')
  }

  /**
   * Simple pattern matching for file paths
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    if (pattern.endsWith('/**/*')) {
      const baseDir = pattern.slice(0, -5)
      return filePath.startsWith(baseDir)
    }

    // Convert glob to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '🌟')
      .replace(/\*/g, '[^/]*')
      .replace(/🌟/g, '.*')
      .replace(/\?/g, '.')

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(filePath)
  }
}
