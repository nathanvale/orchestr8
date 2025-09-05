import * as fs from 'node:fs'
import * as path from 'node:path'
import { ConfigError } from './errors'

/**
 * Quality Checker configuration options
 */
export interface QualityCheckConfig {
  /** Engines to enable */
  engines?: {
    typescript?: boolean
    eslint?: boolean
    prettier?: boolean
  }

  /** Output format */
  format?: 'stylish' | 'json'

  /** Timeout in milliseconds */
  timeoutMs?: number

  /** TypeScript cache directory */
  typescriptCacheDir?: string

  /** ESLint cache directory */
  eslintCacheDir?: string

  /** Whether to write Prettier fixes */
  prettierWrite?: boolean

  /** Whether to fix issues automatically */
  fix?: boolean

  /** Files to check */
  files?: string[]

  /** Check staged files */
  staged?: boolean

  /** Check files changed since a git ref */
  since?: string
}

/**
 * Configuration with all defaults applied
 */
export interface ResolvedConfig extends Omit<Required<QualityCheckConfig>, 'engines'> {
  engines: {
    typescript: boolean
    eslint: boolean
    prettier: boolean
  }
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ResolvedConfig = {
  engines: {
    typescript: true,
    eslint: true,
    prettier: true,
  },
  format: 'stylish',
  timeoutMs: 3000,
  typescriptCacheDir: '',
  eslintCacheDir: '.cache/eslint',
  prettierWrite: false,
  fix: false,
  files: [],
  staged: false,
  since: '',
}

/**
 * Supported configuration file names in order of precedence
 */
const CONFIG_FILE_NAMES = [
  'quality-checker.config.ts',
  'quality-checker.config.mjs',
  'quality-checker.config.cjs',
  'quality-checker.config.js',
  'quality-checker.config.json',
]

/**
 * Loads configuration with the following precedence:
 * 1. CLI arguments (highest)
 * 2. Environment variables
 * 3. Configuration file
 * 4. Default values (lowest)
 */
export class ConfigLoader {
  private configCache: Map<string, QualityCheckConfig> = new Map()

  /**
   * Load and resolve configuration
   */
  async load(
    cliOptions: Partial<QualityCheckConfig> = {},
    configPath?: string,
  ): Promise<ResolvedConfig> {
    // 1. Load config file
    const fileConfig = await this.loadConfigFile(configPath)

    // 2. Load environment variables
    const envConfig = this.loadEnvConfig()

    // 3. Merge in precedence order: CLI > env > file > defaults
    const merged = this.mergeConfigs(DEFAULT_CONFIG, fileConfig, envConfig, cliOptions)

    return this.validateConfig(merged)
  }

  /**
   * Load configuration from file
   */
  private async loadConfigFile(configPath?: string): Promise<Partial<QualityCheckConfig>> {
    const filePath = configPath ?? (await this.findConfigFile())

    if (!filePath) {
      return {}
    }

    // Check cache
    if (this.configCache.has(filePath)) {
      return this.configCache.get(filePath)!
    }

    try {
      let config: Partial<QualityCheckConfig> = {}

      if (filePath.endsWith('.json')) {
        const content = fs.readFileSync(filePath, 'utf-8')
        config = JSON.parse(content)
      } else if (filePath.endsWith('.ts') || filePath.endsWith('.mjs')) {
        // For TypeScript/ESM files, we need to use dynamic import
        // In production, these would be transpiled first
        const module = await import(filePath)
        config = module.default ?? module.config ?? module
      } else if (filePath.endsWith('.cjs') || filePath.endsWith('.js')) {
        // For CommonJS files, we use dynamic import which works for both CJS and ESM
        const module = await import(filePath)
        config = module.default ?? module.config ?? module
      }

      this.configCache.set(filePath, config)
      return config
    } catch (error) {
      throw new ConfigError(
        `Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
      )
    }
  }

  /**
   * Find configuration file in current directory or parent directories
   */
  private async findConfigFile(): Promise<string | undefined> {
    let currentDir = process.cwd()
    const root = path.parse(currentDir).root

    while (currentDir !== root) {
      for (const fileName of CONFIG_FILE_NAMES) {
        const filePath = path.join(currentDir, fileName)
        if (fs.existsSync(filePath)) {
          return filePath
        }
      }

      const parentDir = path.dirname(currentDir)
      if (parentDir === currentDir) {
        break
      }
      currentDir = parentDir
    }

    return undefined
  }

  /**
   * Load configuration from environment variables
   */
  private loadEnvConfig(): Partial<QualityCheckConfig> {
    const config: Partial<QualityCheckConfig> = {}

    // Timeout
    if (process.env.QC_TIMEOUT_MS) {
      config.timeoutMs = parseInt(process.env.QC_TIMEOUT_MS, 10)
    }

    // Cache directories
    if (process.env.QC_TS_CACHE_DIR) {
      config.typescriptCacheDir = process.env.QC_TS_CACHE_DIR
    }
    if (process.env.QC_ESLINT_CACHE_DIR) {
      config.eslintCacheDir = process.env.QC_ESLINT_CACHE_DIR
    }

    // Format
    if (process.env.QC_FORMAT === 'json' || process.env.QC_FORMAT === 'stylish') {
      config.format = process.env.QC_FORMAT
    }

    // Engines
    if (process.env.QC_DISABLE_TS === 'true') {
      config.engines = { ...config.engines, typescript: false }
    }
    if (process.env.QC_DISABLE_ESLINT === 'true') {
      config.engines = { ...config.engines, eslint: false }
    }
    if (process.env.QC_DISABLE_PRETTIER === 'true') {
      config.engines = { ...config.engines, prettier: false }
    }

    return config
  }

  /**
   * Merge configurations in precedence order
   */
  private mergeConfigs(...configs: Partial<QualityCheckConfig>[]): ResolvedConfig {
    const result = { ...DEFAULT_CONFIG }

    for (const config of configs) {
      if (!config) continue

      // Merge top-level properties
      Object.assign(result, {
        format: config.format ?? result.format,
        timeoutMs: config.timeoutMs ?? result.timeoutMs,
        typescriptCacheDir: config.typescriptCacheDir ?? result.typescriptCacheDir,
        eslintCacheDir: config.eslintCacheDir ?? result.eslintCacheDir,
        prettierWrite: config.prettierWrite ?? result.prettierWrite,
        fix: config.fix ?? result.fix,
        files: config.files?.length ? config.files : result.files,
        staged: config.staged ?? result.staged,
        since: config.since ?? result.since,
      })

      // Merge engines object
      if (config.engines) {
        Object.assign(result.engines, config.engines)
      }
    }

    return result
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: ResolvedConfig): ResolvedConfig {
    // Validate timeout
    if (config.timeoutMs <= 0) {
      throw new ConfigError('Timeout must be greater than 0')
    }

    if (config.timeoutMs > 600000) {
      throw new ConfigError('Timeout cannot exceed 10 minutes (600000ms)')
    }

    // Validate format
    if (config.format !== 'stylish' && config.format !== 'json') {
      throw new ConfigError(`Invalid format: ${config.format}. Must be 'stylish' or 'json'`)
    }

    // Set default cache directories if not provided
    if (!config.typescriptCacheDir) {
      const tmpDir = process.env.TMPDIR ?? process.env.TEMP ?? '/tmp'
      config.typescriptCacheDir = path.join(tmpDir, 'quality-check-ts-cache')
    }

    return config
  }

  /**
   * Clear the configuration cache
   */
  clearCache(): void {
    this.configCache.clear()
  }
}
