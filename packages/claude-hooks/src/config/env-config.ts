/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Environment variable configuration support for Claude hooks
 * Allows hook configurations to be overridden via environment variables
 */

import type { CompleteHookConfig } from './config-schema.js'

/**
 * Environment variable mapping for hook configuration
 */
export interface EnvVarMapping {
  envVar: string
  configPath: string
  type: 'boolean' | 'number' | 'string'
  parser?: (value: string) => any
}

/**
 * Default environment variable mappings
 */
export const DEFAULT_ENV_MAPPINGS: EnvVarMapping[] = [
  // Configuration directory override
  {
    envVar: 'CLAUDE_HOOKS_CONFIG_DIR',
    configPath: 'configDir',
    type: 'string',
  },

  // Basic hook configuration
  { envVar: 'CLAUDE_HOOKS_DEBUG', configPath: 'debug', type: 'boolean' },
  {
    envVar: 'CLAUDE_HOOKS_NOTIFY_SOUND',
    configPath: 'notifySound',
    type: 'boolean',
  },
  { envVar: 'CLAUDE_HOOKS_SPEAK', configPath: 'speak', type: 'boolean' },

  // Cooldown configuration
  {
    envVar: 'CLAUDE_HOOKS_COOLDOWN_PERIOD',
    configPath: 'cooldownPeriod',
    type: 'number',
  },
  {
    envVar: 'CLAUDE_HOOKS_ALLOW_URGENT_OVERRIDE',
    configPath: 'allowUrgentOverride',
    type: 'boolean',
  },

  // Quiet hours configuration
  {
    envVar: 'CLAUDE_HOOKS_QUIET_HOURS_ENABLED',
    configPath: 'quietHours.enabled',
    type: 'boolean',
  },
  {
    envVar: 'CLAUDE_HOOKS_QUIET_HOURS_ALLOW_URGENT',
    configPath: 'quietHours.allowUrgentOverride',
    type: 'boolean',
  },
  {
    envVar: 'CLAUDE_HOOKS_QUIET_HOURS_TIMEZONE',
    configPath: 'quietHours.timezone',
    type: 'string',
  },
  {
    envVar: 'CLAUDE_HOOKS_QUIET_HOURS_DAYS',
    configPath: 'quietHours.days',
    type: 'string',
    parser: (value: string) => value.split(',').map((day) => day.trim().toLowerCase()),
  },
  {
    envVar: 'CLAUDE_HOOKS_QUIET_HOURS_RANGES',
    configPath: 'quietHours.ranges',
    type: 'string',
    parser: (value: string) => {
      // Format: "22:00-08:00,12:00-13:00"
      return value.split(',').map((range) => {
        const [start, end] = range.trim().split('-')
        return { start: start.trim(), end: end.trim() }
      })
    },
  },

  // Speech configuration (legacy)
  {
    envVar: 'CLAUDE_HOOKS_SPEECH_ENABLED',
    configPath: 'speech.enabled',
    type: 'boolean',
  },
  {
    envVar: 'CLAUDE_HOOKS_SPEECH_VOICE',
    configPath: 'speech.voice',
    type: 'string',
  },
  {
    envVar: 'CLAUDE_HOOKS_SPEECH_RATE',
    configPath: 'speech.rate',
    type: 'number',
  },
  {
    envVar: 'CLAUDE_HOOKS_SPEECH_VOLUME',
    configPath: 'speech.volume',
    type: 'number',
  },

  // TTS Provider configuration
  {
    envVar: 'CLAUDE_HOOKS_TTS_PROVIDER',
    configPath: 'tts.provider',
    type: 'string',
  },
  {
    envVar: 'CLAUDE_HOOKS_TTS_FALLBACK_PROVIDER',
    configPath: 'tts.fallbackProvider',
    type: 'string',
  },

  // OpenAI TTS configuration
  {
    envVar: 'OPENAI_API_KEY',
    configPath: 'tts.openai.apiKey',
    type: 'string',
  },
  {
    envVar: 'CLAUDE_HOOKS_OPENAI_TTS_MODEL',
    configPath: 'tts.openai.model',
    type: 'string',
  },
  {
    envVar: 'CLAUDE_HOOKS_OPENAI_TTS_VOICE',
    configPath: 'tts.openai.voice',
    type: 'string',
  },
  {
    envVar: 'CLAUDE_HOOKS_OPENAI_TTS_SPEED',
    configPath: 'tts.openai.speed',
    type: 'number',
  },
  {
    envVar: 'CLAUDE_HOOKS_OPENAI_TTS_FORMAT',
    configPath: 'tts.openai.format',
    type: 'string',
  },

  // macOS TTS configuration
  {
    envVar: 'CLAUDE_HOOKS_MACOS_TTS_VOICE',
    configPath: 'tts.macos.voice',
    type: 'string',
  },
  {
    envVar: 'CLAUDE_HOOKS_MACOS_TTS_RATE',
    configPath: 'tts.macos.rate',
    type: 'number',
  },
  {
    envVar: 'CLAUDE_HOOKS_MACOS_TTS_VOLUME',
    configPath: 'tts.macos.volume',
    type: 'number',
  },
  {
    envVar: 'CLAUDE_HOOKS_MACOS_TTS_ENABLED',
    configPath: 'tts.macos.enabled',
    type: 'boolean',
  },

  // ElevenLabs TTS configuration
  {
    envVar: 'ELEVENLABS_API_KEY',
    configPath: 'tts.elevenlabs.apiKey',
    type: 'string',
  },
  // Legacy support for old naming convention (processed first, lower priority)
  {
    envVar: 'CLAUDE_HOOKS_ELEVENLABS_TTS_VOICE',
    configPath: 'tts.elevenlabs.voiceId',
    type: 'string',
  },
  // New naming convention (processed last, higher priority - will override legacy if both set)
  {
    envVar: 'CLAUDE_HOOKS_ELEVENLABS_VOICE_ID',
    configPath: 'tts.elevenlabs.voiceId',
    type: 'string',
  },
  {
    envVar: 'CLAUDE_HOOKS_ELEVENLABS_MODEL_ID',
    configPath: 'tts.elevenlabs.modelId',
    type: 'string',
  },
  {
    envVar: 'CLAUDE_HOOKS_ELEVENLABS_OUTPUT_FORMAT',
    configPath: 'tts.elevenlabs.outputFormat',
    type: 'string',
  },
  {
    envVar: 'CLAUDE_HOOKS_ELEVENLABS_SPEED',
    configPath: 'tts.elevenlabs.speed',
    type: 'number',
  },
  {
    envVar: 'CLAUDE_HOOKS_ELEVENLABS_STABILITY',
    configPath: 'tts.elevenlabs.stability',
    type: 'number',
  },
  {
    envVar: 'CLAUDE_HOOKS_ELEVENLABS_SIMILARITY_BOOST',
    configPath: 'tts.elevenlabs.similarityBoost',
    type: 'number',
  },
  {
    envVar: 'CLAUDE_HOOKS_ELEVENLABS_ENABLE_LOGGING',
    configPath: 'tts.elevenlabs.enableLogging',
    type: 'boolean',
  },

  // Audio Cache configuration
  {
    envVar: 'CLAUDE_HOOKS_AUDIO_CACHE_ENABLED',
    configPath: 'audioCache.enabled',
    type: 'boolean',
  },
  {
    envVar: 'CLAUDE_HOOKS_AUDIO_CACHE_MAX_SIZE_MB',
    configPath: 'audioCache.maxSizeMB',
    type: 'number',
    parser: (value: string) => parseFloat(value) * 1024 * 1024, // Convert MB to bytes
  },
  {
    envVar: 'CLAUDE_HOOKS_AUDIO_CACHE_MAX_AGE_DAYS',
    configPath: 'audioCache.maxAgeDays',
    type: 'number',
    parser: (value: string) => parseFloat(value) * 24 * 60 * 60 * 1000, // Convert days to milliseconds
  },
  {
    envVar: 'CLAUDE_HOOKS_AUDIO_CACHE_MAX_ENTRIES',
    configPath: 'audioCache.maxEntries',
    type: 'number',
  },

  // Audio Cache normalization options
  {
    envVar: 'CLAUDE_HOOKS_AUDIO_CACHE_CASE_SENSITIVE',
    configPath: 'audioCache.normalization.caseSensitive',
    type: 'boolean',
  },
  {
    envVar: 'CLAUDE_HOOKS_AUDIO_CACHE_STRIP_PRIORITY_PREFIXES',
    configPath: 'audioCache.normalization.stripPriorityPrefixes',
    type: 'boolean',
  },
  {
    envVar: 'CLAUDE_HOOKS_AUDIO_CACHE_NORMALIZE_WHITESPACE',
    configPath: 'audioCache.normalization.normalizeWhitespace',
    type: 'boolean',
  },
]

/**
 * Environment configuration loader
 */
export class EnvConfigLoader {
  private mappings: EnvVarMapping[]

  constructor(mappings: EnvVarMapping[] = DEFAULT_ENV_MAPPINGS) {
    this.mappings = mappings
  }

  /**
   * Load configuration values from environment variables
   */
  loadFromEnv(baseConfig: Partial<CompleteHookConfig> = {}): Partial<CompleteHookConfig> {
    const config = JSON.parse(JSON.stringify(baseConfig)) // Deep clone

    for (const mapping of this.mappings) {
      const envValue = process.env[mapping.envVar]
      if (envValue !== undefined) {
        const parsedValue = this.parseEnvValue(envValue, mapping)
        this.setConfigValue(config, mapping.configPath, parsedValue)
      }
    }

    return config
  }

  /**
   * Get all environment variables that would affect configuration
   */
  getRelevantEnvVars(): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {}

    for (const mapping of this.mappings) {
      const value = process.env[mapping.envVar]
      if (value !== undefined) {
        result[mapping.envVar] = value
      }
    }

    return result
  }

  /**
   * Validate environment variable values
   */
  validateEnvVars(): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    for (const mapping of this.mappings) {
      const envValue = process.env[mapping.envVar]
      if (envValue !== undefined) {
        try {
          this.parseEnvValue(envValue, mapping)
        } catch (error) {
          errors.push(
            `Invalid value for ${mapping.envVar}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          )
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Parse environment variable value according to its type
   */
  private parseEnvValue(value: string, mapping: EnvVarMapping): any {
    if (mapping.parser) {
      return mapping.parser(value)
    }

    switch (mapping.type) {
      case 'boolean':
        return this.parseBoolean(value)
      case 'number':
        return this.parseNumber(value)
      case 'string':
        return value
      default:
        throw new Error(`Unknown type: ${String(mapping.type)}`)
    }
  }

  /**
   * Parse boolean from environment variable
   */
  private parseBoolean(value: string): boolean {
    const normalized = value.toLowerCase().trim()

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false
    }

    throw new Error(`Cannot parse "${value}" as boolean. Use: true/false, 1/0, yes/no, on/off`)
  }

  /**
   * Parse number from environment variable
   */
  private parseNumber(value: string): number {
    const parsed = Number(value)

    if (isNaN(parsed)) {
      throw new Error(`Cannot parse "${value}" as number`)
    }

    return parsed
  }

  /**
   * Set nested configuration value using dot notation path
   */
  private setConfigValue(config: any, path: string, value: any): void {
    const parts = path.split('.')
    let current = config

    // Navigate to the parent object
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (current[part] == null || typeof current[part] !== 'object') {
        current[part] = {}
      }
      current = current[part]
    }

    // Set the final value
    const finalKey = parts[parts.length - 1]
    current[finalKey] = value
  }

  /**
   * Add custom environment variable mapping
   */
  addMapping(mapping: EnvVarMapping): void {
    this.mappings.push(mapping)
  }

  /**
   * Remove environment variable mapping
   */
  removeMapping(envVar: string): void {
    this.mappings = this.mappings.filter((m) => m.envVar !== envVar)
  }

  /**
   * Get all mappings
   */
  getMappings(): EnvVarMapping[] {
    return [...this.mappings]
  }
}

/**
 * Default environment configuration loader instance
 */
export const envConfigLoader = new EnvConfigLoader()

/**
 * Convenience function to load configuration from environment variables
 */
export function loadConfigFromEnv(
  baseConfig: Partial<CompleteHookConfig> = {},
): Partial<CompleteHookConfig> {
  return envConfigLoader.loadFromEnv(baseConfig)
}
