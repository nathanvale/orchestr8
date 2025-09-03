/**
 * Configuration management for quality check hook
 */

import { promises as fs } from 'node:fs'

import type { QualityCheckConfig } from '../types/config.js'

import { parseBoolean } from '../utils/config-loader.js'

export interface ResolvedQualityConfig {
  typescriptEnabled: boolean
  showDependencyErrors: boolean
  eslintEnabled: boolean
  eslintAutofix: boolean
  prettierEnabled: boolean
  prettierAutofix: boolean
  autofixSilent: boolean
  debug: boolean
  ignorePatterns: string[]
  fileConfig: QualityCheckConfig
}

/**
 * Load configuration from JSON file with environment variable overrides
 */
export async function loadQualityConfig(configPath: string): Promise<ResolvedQualityConfig> {
  let fileConfig: QualityCheckConfig = {}

  try {
    const content = await fs.readFile(configPath, 'utf8')
    fileConfig = JSON.parse(content) as QualityCheckConfig
  } catch {
    // Config file not found or invalid, use defaults
  }

  return {
    // TypeScript settings
    typescriptEnabled:
      process.env.CLAUDE_HOOKS_TYPESCRIPT_ENABLED !== undefined
        ? parseBoolean(process.env.CLAUDE_HOOKS_TYPESCRIPT_ENABLED, true)
        : (fileConfig.typescript?.enabled ?? true),

    showDependencyErrors:
      process.env.CLAUDE_HOOKS_SHOW_DEPENDENCY_ERRORS !== undefined
        ? parseBoolean(process.env.CLAUDE_HOOKS_SHOW_DEPENDENCY_ERRORS)
        : (fileConfig.typescript?.showDependencyErrors ?? false),

    // ESLint settings
    eslintEnabled:
      process.env.CLAUDE_HOOKS_ESLINT_ENABLED !== undefined
        ? parseBoolean(process.env.CLAUDE_HOOKS_ESLINT_ENABLED, true)
        : (fileConfig.eslint?.enabled ?? true),

    eslintAutofix:
      process.env.CLAUDE_HOOKS_ESLINT_AUTOFIX !== undefined
        ? parseBoolean(process.env.CLAUDE_HOOKS_ESLINT_AUTOFIX)
        : (fileConfig.eslint?.autofix ?? false),

    // Prettier settings
    prettierEnabled:
      process.env.CLAUDE_HOOKS_PRETTIER_ENABLED !== undefined
        ? parseBoolean(process.env.CLAUDE_HOOKS_PRETTIER_ENABLED, true)
        : (fileConfig.prettier?.enabled ?? true),

    prettierAutofix:
      process.env.CLAUDE_HOOKS_PRETTIER_AUTOFIX !== undefined
        ? parseBoolean(process.env.CLAUDE_HOOKS_PRETTIER_AUTOFIX)
        : (fileConfig.prettier?.autofix ?? false),

    // General settings
    autofixSilent:
      process.env.CLAUDE_HOOKS_AUTOFIX_SILENT !== undefined
        ? parseBoolean(process.env.CLAUDE_HOOKS_AUTOFIX_SILENT)
        : (fileConfig.general?.autofixSilent ?? false),

    debug:
      process.env.CLAUDE_HOOKS_DEBUG !== undefined
        ? parseBoolean(process.env.CLAUDE_HOOKS_DEBUG)
        : (fileConfig.general?.debug ?? false),

    // Ignore patterns
    ignorePatterns: fileConfig.ignore?.patterns || [],

    // Store the full config for rule access
    fileConfig,
  }
}
