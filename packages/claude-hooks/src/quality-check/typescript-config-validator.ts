/**
 * TypeScript configuration validator for quality check hooks
 * Handles parsing and validation of tsconfig exclusion patterns
 */

import micromatch from 'micromatch'
import { existsSync } from 'node:fs'
import path from 'node:path'

interface TypeScriptConfig {
  exclude?: string[]
  include?: string[]
  extends?: string | string[]
  compilerOptions?: Record<string, unknown>
}

interface ParsedConfig {
  excludePatterns: string[]
  includePatterns: string[]
}

/**
 * Parse exclude patterns from TypeScript configuration
 */
export function parseExcludePatterns(config: TypeScriptConfig, _projectRoot: string): string[] {
  if (!config.exclude || !Array.isArray(config.exclude)) {
    return []
  }

  return config.exclude.map((pattern) => {
    // Remove leading ./ for consistency with micromatch
    if (pattern.startsWith('./')) {
      return pattern.substring(2)
    }
    // Keep other patterns as-is
    return pattern
  })
}

/**
 * Check if a file path matches any exclusion patterns
 * Uses micromatch for robust glob pattern matching
 */
export function isFileExcluded(
  filePath: string,
  excludePatterns: string[],
  projectRoot: string,
): boolean {
  if (excludePatterns.length === 0) {
    return false
  }

  // Convert absolute file path to relative path from project root
  const relativePath = path.relative(projectRoot, filePath)

  // Normalize path separators for cross-platform compatibility
  const normalizedPath = relativePath.replace(/\\/g, '/')

  // Use micromatch to check if the file matches any exclusion pattern
  return micromatch.isMatch(normalizedPath, excludePatterns, {
    dot: true, // Match files starting with a dot
    noglobstar: false, // Enable ** for recursive matching
  })
}

/**
 * TypeScript configuration validator class
 */
export class TypeScriptConfigValidator {
  private configCache = new Map<string, ParsedConfig>()

  /**
   * Check if a file is included in the TypeScript project
   * (i.e., not excluded by tsconfig exclude patterns)
   */
  async isFileIncluded(filePath: string, tsconfigPath: string): Promise<boolean> {
    try {
      // Check if config file exists
      if (!existsSync(tsconfigPath)) {
        // Default to including all files if no config
        return true
      }

      // Get or parse config
      const config = await this.getOrParseConfig(tsconfigPath)
      if (!config) {
        // Default to including all files if config parsing fails
        return true
      }

      const projectRoot = path.dirname(tsconfigPath)

      // Check if file is excluded
      const isExcluded = isFileExcluded(filePath, config.excludePatterns, projectRoot)

      return !isExcluded
    } catch {
      // Default to including all files on any error
      return true
    }
  }

  /**
   * Get parsed config from cache or parse it fresh
   */
  private async getOrParseConfig(tsconfigPath: string): Promise<ParsedConfig | null> {
    // Check cache first
    if (this.configCache.has(tsconfigPath)) {
      return this.configCache.get(tsconfigPath)!
    }

    // Parse config
    const config = await this.parseConfig(tsconfigPath)
    if (config) {
      this.configCache.set(tsconfigPath, config)
    }

    return config
  }

  /**
   * Parse TypeScript configuration file
   */
  private async parseConfig(tsconfigPath: string): Promise<ParsedConfig | null> {
    try {
      // Dynamically import TypeScript
      const ts = await import('typescript')
      const projectRoot = path.dirname(tsconfigPath)

      // Read and parse config file
      const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile)

      if (configFile.error) {
        // Config file has errors, return null
        return null
      }

      // Parse the configuration
      const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectRoot)

      if (parsedConfig.errors && parsedConfig.errors.length > 0) {
        // Configuration has errors, return null
        return null
      }

      // Extract patterns
      const excludePatterns = parseExcludePatterns(configFile.config, projectRoot)

      return {
        excludePatterns,
        includePatterns: [], // Not used currently, but could be extended
      }
    } catch {
      // Failed to load TypeScript or parse config
      return null
    }
  }

  /**
   * Clear the configuration cache
   */
  clearCache(): void {
    this.configCache.clear()
  }
}

// Singleton instance for performance
let validatorInstance: TypeScriptConfigValidator | null = null

/**
 * Get or create a TypeScript configuration validator instance
 */
export function createConfigValidator(): TypeScriptConfigValidator {
  if (!validatorInstance) {
    validatorInstance = new TypeScriptConfigValidator()
  }
  return validatorInstance
}
