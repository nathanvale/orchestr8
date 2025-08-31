#!/usr/bin/env tsx
/**
 * Configuration loader for guardrails
 * Provides type-safe configuration loading with defaults and validation
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface GuardrailsConfig {
  version: string
  description?: string

  thresholds: {
    staleChangeset: {
      warningDays: number
      errorDays: number
      description?: string
    }
    vulnerabilities: {
      critical: number
      high: number
      medium: number
      low: number
      description?: string
    }
    coverage: {
      lines: number
      branches: number
      functions: number
      statements: number
      description?: string
    }
    bundleSize: {
      maxSizeKB: number
      warningThresholdPercent: number
      description?: string
    }
  }

  validation: {
    changesetSimilarity: {
      threshold: number
      algorithm: 'levenshtein' | 'jaccard' | 'cosine'
      description?: string
    }
    packageNameValidation: {
      pattern: string
      reservedNames: string[]
      description?: string
    }
    commitMessage: {
      pattern: string
      maxLength: number
      description?: string
    }
  }

  ignoredPaths: {
    vulnerabilityScanning: string[]
    changesetValidation: string[]
  }

  features: {
    autoFix: {
      enabled: boolean
      description?: string
    }
    strictMode: {
      enabled: boolean
      description?: string
    }
    parallelExecution: {
      enabled: boolean
      maxWorkers: number
      description?: string
    }
    caching: {
      enabled: boolean
      ttlMinutes: number
      description?: string
    }
  }

  output: {
    format: 'json' | 'text' | 'auto'
    verbose: boolean
    showProgress: boolean
    colorize: boolean | 'auto'
    summaryOnly: boolean
    githubAnnotations: boolean
  }

  hooks: {
    preValidation: string[]
    postValidation: string[]
    onError: string[]
    onSuccess: string[]
  }
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: GuardrailsConfig = {
  version: '1.0.0',
  description: 'Default guardrails configuration',

  thresholds: {
    staleChangeset: {
      warningDays: 30,
      errorDays: 60,
    },
    vulnerabilities: {
      critical: 0,
      high: 0,
      medium: 5,
      low: 10,
    },
    coverage: {
      lines: 70,
      branches: 70,
      functions: 70,
      statements: 70,
    },
    bundleSize: {
      maxSizeKB: 500,
      warningThresholdPercent: 10,
    },
  },

  validation: {
    changesetSimilarity: {
      threshold: 0.85,
      algorithm: 'levenshtein',
    },
    packageNameValidation: {
      pattern: '^@[a-z-]+/[a-z-]+$',
      reservedNames: ['core', 'internal', 'private'],
    },
    commitMessage: {
      pattern: '^(feat|fix|docs|style|refactor|test|chore|perf)\\(.+\\): .+',
      maxLength: 100,
    },
  },

  ignoredPaths: {
    vulnerabilityScanning: ['**/test/**', '**/tests/**', '**/__tests__/**'],
    changesetValidation: ['**/CHANGELOG.md', '**/README.md', '**/docs/**'],
  },

  features: {
    autoFix: {
      enabled: false,
    },
    strictMode: {
      enabled: false,
    },
    parallelExecution: {
      enabled: true,
      maxWorkers: 4,
    },
    caching: {
      enabled: true,
      ttlMinutes: 15,
    },
  },

  output: {
    format: 'auto',
    verbose: false,
    showProgress: true,
    colorize: 'auto',
    summaryOnly: false,
    githubAnnotations: true,
  },

  hooks: {
    preValidation: [],
    postValidation: [],
    onError: [],
    onSuccess: [],
  },
}

/**
 * Load configuration from file or use defaults
 */
export function loadConfig(
  configPath?: string,
  rootPath: string = process.cwd(),
): GuardrailsConfig {
  // Check for config file
  const possiblePaths = [
    configPath,
    join(rootPath, 'guardrails.config.json'),
    join(rootPath, '.guardrails.json'),
    join(rootPath, 'config', 'guardrails.json'),
  ].filter(Boolean) as string[]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8')
        const userConfig = JSON.parse(content)
        return mergeConfigs(DEFAULT_CONFIG, userConfig)
      } catch (error) {
        console.warn(`Failed to load config from ${path}:`, error)
      }
    }
  }

  // Return defaults if no config found
  return DEFAULT_CONFIG
}

/**
 * Deep merge configurations
 */
function mergeConfigs(
  defaults: GuardrailsConfig,
  user: Partial<GuardrailsConfig>,
): GuardrailsConfig {
  const merged = { ...defaults }

  // Deep merge each section
  if (user.thresholds) {
    merged.thresholds = {
      ...defaults.thresholds,
      ...user.thresholds,
      staleChangeset: { ...defaults.thresholds.staleChangeset, ...user.thresholds?.staleChangeset },
      vulnerabilities: {
        ...defaults.thresholds.vulnerabilities,
        ...user.thresholds?.vulnerabilities,
      },
      coverage: { ...defaults.thresholds.coverage, ...user.thresholds?.coverage },
      bundleSize: { ...defaults.thresholds.bundleSize, ...user.thresholds?.bundleSize },
    }
  }

  if (user.validation) {
    merged.validation = {
      ...defaults.validation,
      ...user.validation,
      changesetSimilarity: {
        ...defaults.validation.changesetSimilarity,
        ...user.validation?.changesetSimilarity,
      },
      packageNameValidation: {
        ...defaults.validation.packageNameValidation,
        ...user.validation?.packageNameValidation,
      },
      commitMessage: { ...defaults.validation.commitMessage, ...user.validation?.commitMessage },
    }
  }

  if (user.ignoredPaths) {
    merged.ignoredPaths = {
      vulnerabilityScanning:
        user.ignoredPaths.vulnerabilityScanning ?? defaults.ignoredPaths.vulnerabilityScanning,
      changesetValidation:
        user.ignoredPaths.changesetValidation ?? defaults.ignoredPaths.changesetValidation,
    }
  }

  if (user.features) {
    merged.features = {
      ...defaults.features,
      ...user.features,
      autoFix: { ...defaults.features.autoFix, ...user.features?.autoFix },
      strictMode: { ...defaults.features.strictMode, ...user.features?.strictMode },
      parallelExecution: {
        ...defaults.features.parallelExecution,
        ...user.features?.parallelExecution,
      },
      caching: { ...defaults.features.caching, ...user.features?.caching },
    }
  }

  if (user.output) {
    merged.output = { ...defaults.output, ...user.output }
  }

  if (user.hooks) {
    merged.hooks = { ...defaults.hooks, ...user.hooks }
  }

  if (user.version) merged.version = user.version
  if (user.description) merged.description = user.description

  return merged
}

/**
 * Override config with environment variables
 */
export function applyEnvironmentOverrides(config: GuardrailsConfig): GuardrailsConfig {
  const result = { ...config }

  // Check for environment variable overrides
  if (process.env.GUARDRAILS_STRICT === 'true') {
    result.features.strictMode.enabled = true
  }

  if (process.env.GUARDRAILS_VERBOSE === 'true') {
    result.output.verbose = true
  }

  if (process.env.GUARDRAILS_FORMAT) {
    result.output.format = process.env.GUARDRAILS_FORMAT as 'json' | 'text' | 'auto'
  }

  if (process.env.GUARDRAILS_NO_COLOR === 'true') {
    result.output.colorize = false
  }

  if (process.env.GUARDRAILS_NO_PROGRESS === 'true') {
    result.output.showProgress = false
  }

  if (process.env.GUARDRAILS_MAX_WORKERS) {
    result.features.parallelExecution.maxWorkers = parseInt(process.env.GUARDRAILS_MAX_WORKERS, 10)
  }

  return result
}

/**
 * Validate configuration
 */
export function validateConfig(config: GuardrailsConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate thresholds
  if (config.thresholds.staleChangeset.warningDays > config.thresholds.staleChangeset.errorDays) {
    errors.push('staleChangeset.warningDays must be less than errorDays')
  }

  if (config.thresholds.vulnerabilities.critical < 0) {
    errors.push('vulnerabilities.critical must be >= 0')
  }

  // Validate similarity threshold
  if (
    config.validation.changesetSimilarity.threshold < 0 ||
    config.validation.changesetSimilarity.threshold > 1
  ) {
    errors.push('changesetSimilarity.threshold must be between 0 and 1')
  }

  // Validate regex patterns
  try {
    new RegExp(config.validation.packageNameValidation.pattern)
  } catch {
    errors.push('packageNameValidation.pattern is not a valid regex')
  }

  try {
    new RegExp(config.validation.commitMessage.pattern)
  } catch {
    errors.push('commitMessage.pattern is not a valid regex')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get configuration value by path
 */
export function getConfigValue<T>(config: GuardrailsConfig, path: string): T | undefined {
  const parts = path.split('.')
  let current: any = config

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part]
    } else {
      return undefined
    }
  }

  return current as T
}

export default {
  loadConfig,
  applyEnvironmentOverrides,
  validateConfig,
  getConfigValue,
  DEFAULT_CONFIG,
}
