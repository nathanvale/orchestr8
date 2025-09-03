/**
 * Auto-configuration loading for Claude hooks
 * Searches multiple paths for configuration files to support various deployment scenarios
 */

import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

import { loadConfigFromEnv } from '../config/env-config.js'
import { findMonorepoRoot, findProjectRoot } from './config-loader.js'

/**
 * Substitute environment variables in JSON config values
 * Supports ${VAR_NAME} syntax
 */
function substituteEnvironmentVariables(obj: unknown): unknown {
  if (typeof obj === 'string') {
    // Replace ${VAR_NAME} with environment variable value
    return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const envValue = process.env[varName]
      if (envValue === undefined) {
        console.warn(
          `Warning: Environment variable ${String(varName)} not found, keeping placeholder`,
        )
        return match // Keep the placeholder if env var not found
      }
      return envValue
    })
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => substituteEnvironmentVariables(item))
  }

  if (obj != null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvironmentVariables(value)
    }
    return result
  }

  return obj
}

/**
 * Get the original working directory where Claude Code was executed
 * This handles cases where the bin command is executed from a different directory
 */
function getOriginalWorkingDirectory(): string {
  // Priority order:
  // 1. INIT_CWD - npm/pnpm sets this to the original working directory
  // 2. PWD - shell sets this to the original directory
  // 3. Fall back to process.cwd()

  if (process.env.INIT_CWD != null && process.env.INIT_CWD !== '') {
    return process.env.INIT_CWD
  }

  if (process.env.PWD != null && process.env.PWD !== '' && process.env.PWD !== process.cwd()) {
    return process.env.PWD
  }

  return process.cwd()
}

/**
 * Get all potential config search paths in priority order
 * @param hookName - Name of the hook
 * @returns Array of paths to search for config files
 */
function getConfigSearchPaths(hookName: string): string[] {
  const configFileName = `${hookName}.config.json`
  const paths: string[] = []

  // Get the original working directory where Claude Code was invoked
  const originalCwd = getOriginalWorkingDirectory()
  const currentCwd = process.cwd()

  // 1. Environment variable override (highest priority)

  if (process.env.CLAUDE_HOOKS_CONFIG_DIR != null && process.env.CLAUDE_HOOKS_CONFIG_DIR !== '') {
    paths.push(path.join(process.env.CLAUDE_HOOKS_CONFIG_DIR, configFileName))
  }

  // 2. Monorepo root from original working directory (most important for our use case)
  const monorepoRootFromOriginal = findMonorepoRoot(originalCwd)
  if (monorepoRootFromOriginal != null && monorepoRootFromOriginal !== '') {
    paths.push(path.join(monorepoRootFromOriginal, '.claude', 'hooks', configFileName))
  }

  // 3. Project root from original working directory
  const projectRootFromOriginal = findProjectRoot(originalCwd)
  paths.push(path.join(projectRootFromOriginal, '.claude', 'hooks', configFileName))

  // 4. Original working directory itself
  if (originalCwd !== projectRootFromOriginal) {
    paths.push(path.join(originalCwd, '.claude', 'hooks', configFileName))
  }

  // 5. Also check from current working directory (for standalone npm package usage)
  if (currentCwd !== originalCwd) {
    const monorepoRootFromCurrent = findMonorepoRoot(currentCwd)
    if (
      monorepoRootFromCurrent != null &&
      monorepoRootFromCurrent !== '' &&
      monorepoRootFromCurrent !== monorepoRootFromOriginal
    ) {
      paths.push(path.join(monorepoRootFromCurrent, '.claude', 'hooks', configFileName))
    }

    const projectRootFromCurrent = findProjectRoot(currentCwd)
    if (projectRootFromCurrent !== projectRootFromOriginal) {
      paths.push(path.join(projectRootFromCurrent, '.claude', 'hooks', configFileName))
    }
  }

  // 6. User's home directory (global config)
  paths.push(path.join(homedir(), '.claude', 'hooks', configFileName))

  // Remove duplicates while preserving order
  return [...new Set(paths)]
}

/**
 * Load JSON configuration from .claude/hooks directory
 * Searches multiple paths to find the configuration file
 * @param hookName - Name of the hook (e.g., 'notification', 'stop', 'quality-check')
 * @returns Parsed JSON config or empty object if not found
 */
export async function loadAutoConfig<T extends Record<string, unknown>>(
  hookName: string,
  debug = false,
): Promise<T> {
  const searchPaths = getConfigSearchPaths(hookName)

  if (debug || process.env.CLAUDE_HOOKS_DEBUG === 'true') {
    console.error(`[DEBUG] Config search paths for ${hookName}:`)
    for (const [i, p] of searchPaths.entries()) {
      console.error(`  ${i + 1}. ${p}`)
    }
  }

  let configFilePath: string | null = null
  let config: T | null = null

  // Try each path in order
  for (const configPath of searchPaths) {
    try {
      const content = await fs.readFile(configPath, 'utf8')
      let parsedConfig = JSON.parse(content) as T

      // Extract settings if it exists, otherwise use the whole config
      if (parsedConfig != null && typeof parsedConfig === 'object' && 'settings' in parsedConfig) {
        parsedConfig = (parsedConfig as unknown as { settings: T }).settings
      }

      // Substitute environment variables in the config
      config = substituteEnvironmentVariables(parsedConfig) as T
      configFilePath = configPath

      if (debug || process.env.CLAUDE_HOOKS_DEBUG === 'true') {
        console.error(`[DEBUG] Loaded config from: ${configPath}`)
      }

      break // Found a config, stop searching
    } catch {
      // Config not found at this path, try next
      continue
    }
  }

  if (!config) {
    if (debug || process.env.CLAUDE_HOOKS_DEBUG === 'true') {
      console.error('[DEBUG] No config file found, using environment variables only')
    }
    config = {} as T
  }

  // Apply environment variable overrides
  const configWithEnv = loadConfigFromEnv(config as Record<string, unknown>) as T

  // Add metadata about where config was loaded from (useful for debugging)
  if (configFilePath != null && configFilePath !== '' && typeof configWithEnv === 'object') {
    ;(configWithEnv as unknown as Record<string, unknown>).__configPath = configFilePath
  }

  return configWithEnv
}

/**
 * Get the path to a hook's config file in .claude/hooks directory
 * Returns the first valid path from the search paths
 * @param hookName - Name of the hook
 * @returns Full path to the config file (first search path)
 */
export function getAutoConfigPath(hookName: string): string {
  const searchPaths = getConfigSearchPaths(hookName)
  return searchPaths[0] || path.join(process.cwd(), '.claude', 'hooks', `${hookName}.config.json`)
}
