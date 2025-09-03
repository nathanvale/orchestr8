/**
 * Configuration schema and validation for Claude hooks
 * Provides comprehensive validation and type safety for all hook configurations
 */

// Note: env-config.js imports from this file, so we can't re-export it here

export interface HookConfig {
  debug?: boolean
  notifySound?: boolean
  speak?: boolean
}

export interface CooldownConfig {
  cooldownPeriod: number
  allowUrgentOverride?: boolean
  perTypeSettings?: Partial<Record<NotificationType, number>>
}

export interface QuietHoursRange {
  start: string // HH:MM format
  end: string // HH:MM format
  name?: string
}

export interface QuietHoursConfig {
  enabled: boolean
  ranges: QuietHoursRange[]
  allowUrgentOverride?: boolean
  days?: string[]
  timezone?: string
}

export interface SpeechConfig {
  voice?: string
  rate?: number // Words per minute
  volume?: number // 0.0 to 1.0
  enabled?: boolean
}

/**
 * OpenAI TTS Provider Configuration
 */
export interface OpenAITTSConfig {
  apiKey?: string
  model?: 'tts-1' | 'tts-1-hd'
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  speed?: number // 0.25 to 4.0
  format?: 'mp3' | 'opus' | 'aac' | 'flac'
}

/**
 * macOS TTS Provider Configuration
 */
export interface MacOSTTSConfig {
  voice?: string
  rate?: number // Words per minute
  volume?: number // 0.0 to 1.0
  enabled?: boolean
}

/**
 * ElevenLabs TTS Provider Configuration
 */
export interface ElevenLabsTTSConfig {
  apiKey?: string
  voiceId?: string
  modelId?: 'eleven_multilingual_v2' | 'eleven_flash_v2_5' | 'eleven_monolingual_v1' | string
  outputFormat?:
    | 'mp3_44100_128'
    | 'mp3_44100_192'
    | 'mp3_22050_32'
    | 'pcm_16000'
    | 'ulaw_8000'
    | 'alaw_8000'
    | 'opus_48000_128'
    | string
  stability?: number // 0.0 to 1.0
  similarityBoost?: number // 0.0 to 1.0
  speed?: number // 0.5 to 2.0
  enableLogging?: boolean
}

/**
 * TTS Provider Configuration
 */
export interface TTSConfig {
  provider: 'openai' | 'macos' | 'elevenlabs' | 'auto'
  fallbackProvider?: 'openai' | 'macos' | 'elevenlabs' | 'none'
  openai?: OpenAITTSConfig
  macos?: MacOSTTSConfig
  elevenlabs?: ElevenLabsTTSConfig
}

/**
 * Audio cache normalization configuration
 */
export interface AudioCacheNormalizationConfig {
  caseSensitive?: boolean
  stripPriorityPrefixes?: boolean
  normalizeWhitespace?: boolean
}

/**
 * Audio cache configuration
 */
export interface AudioCacheConfig {
  enabled?: boolean
  maxSizeMB?: number
  maxAgeDays?: number
  maxEntries?: number
  normalization?: AudioCacheNormalizationConfig
}

export interface CompleteHookConfig extends HookConfig {
  cooldownPeriod?: number
  allowUrgentOverride?: boolean
  quietHours?: QuietHoursConfig
  speech?: SpeechConfig
  tts?: TTSConfig
  audioCache?: AudioCacheConfig
  perTypeSettings?: Partial<Record<NotificationType, number>>
}

export type NotificationType = 'speech' | 'audio' | 'urgent' | 'notification' | 'stop' | 'subagent'

export interface ValidationError {
  field: string
  message: string
  value?: unknown
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

/**
 * Configuration validator with comprehensive validation rules
 */
export class ConfigValidator {
  private static readonly TIME_REGEX = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
  private static readonly VALID_DAYS = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]
  private static readonly VALID_NOTIFICATION_TYPES: NotificationType[] = [
    'speech',
    'audio',
    'urgent',
    'notification',
    'stop',
    'subagent',
  ]

  /**
   * Validate complete hook configuration
   */
  static validate(config: unknown): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    if (
      config === null ||
      config === undefined ||
      typeof config !== 'object' ||
      Array.isArray(config)
    ) {
      return {
        isValid: false,
        errors: [{ field: 'root', message: 'Configuration must be an object' }],
        warnings: [],
      }
    }

    const cfg = config as Record<string, unknown>

    // Validate basic hook configuration
    this.validateHookConfig(cfg, errors, warnings)

    // Validate cooldown configuration
    this.validateCooldownConfig(cfg, errors, warnings)

    // Validate quiet hours configuration
    if (cfg.quietHours !== undefined) {
      this.validateQuietHoursConfig(cfg.quietHours, errors, warnings)
    }

    // Validate speech configuration
    if (cfg.speech !== undefined) {
      this.validateSpeechConfig(cfg.speech, errors, warnings)
    }

    // Validate TTS configuration
    if (cfg.tts !== undefined) {
      this.validateTTSConfig(cfg.tts, errors, warnings)
    }

    // Validate per-type settings
    if (cfg.perTypeSettings !== undefined) {
      this.validatePerTypeSettings(cfg.perTypeSettings, errors, warnings)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate basic hook configuration
   */
  private static validateHookConfig(
    config: Record<string, unknown>,
    errors: ValidationError[],
    _warnings: ValidationError[],
  ): void {
    const booleanFields = ['debug', 'notifySound', 'speak']

    for (const field of booleanFields) {
      if (config[field] !== undefined && typeof config[field] !== 'boolean') {
        errors.push({
          field,
          message: `${field} must be a boolean`,
          value: config[field],
        })
      }
    }
  }

  /**
   * Validate cooldown configuration
   */
  private static validateCooldownConfig(
    config: Record<string, unknown>,
    errors: ValidationError[],
    _warnings: ValidationError[],
  ): void {
    if (config.cooldownPeriod !== undefined) {
      if (typeof config.cooldownPeriod !== 'number' || config.cooldownPeriod < 0) {
        errors.push({
          field: 'cooldownPeriod',
          message: 'cooldownPeriod must be a non-negative number',
          value: config.cooldownPeriod,
        })
      } else if (config.cooldownPeriod > 300000) {
        // 5 minutes
        _warnings.push({
          field: 'cooldownPeriod',
          message: 'cooldownPeriod is very long (>5 minutes)',
          value: config.cooldownPeriod,
        })
      }
    }

    if (
      config.allowUrgentOverride !== undefined &&
      typeof config.allowUrgentOverride !== 'boolean'
    ) {
      errors.push({
        field: 'allowUrgentOverride',
        message: 'allowUrgentOverride must be a boolean',
        value: config.allowUrgentOverride,
      })
    }
  }

  /**
   * Validate quiet hours configuration
   */
  private static validateQuietHoursConfig(
    quietHours: unknown,
    errors: ValidationError[],
    _warnings: ValidationError[],
  ): void {
    if (typeof quietHours !== 'object' || quietHours === null) {
      errors.push({
        field: 'quietHours',
        message: 'quietHours must be an object',
        value: quietHours,
      })
      return
    }

    const qh = quietHours as Record<string, unknown>

    // Validate enabled
    if (typeof qh.enabled !== 'boolean') {
      errors.push({
        field: 'quietHours.enabled',
        message: 'quietHours.enabled must be a boolean',
        value: qh.enabled,
      })
    }

    // Validate ranges
    if (!Array.isArray(qh.ranges)) {
      errors.push({
        field: 'quietHours.ranges',
        message: 'quietHours.ranges must be an array',
        value: qh.ranges,
      })
    } else {
      for (const [index, range] of qh.ranges.entries()) {
        this.validateTimeRange(range, `quietHours.ranges[${index}]`, errors, _warnings)
      }
    }

    // Validate allowUrgentOverride
    if (qh.allowUrgentOverride !== undefined && typeof qh.allowUrgentOverride !== 'boolean') {
      errors.push({
        field: 'quietHours.allowUrgentOverride',
        message: 'quietHours.allowUrgentOverride must be a boolean',
        value: qh.allowUrgentOverride,
      })
    }

    // Validate days
    if (qh.days !== undefined) {
      if (!Array.isArray(qh.days)) {
        errors.push({
          field: 'quietHours.days',
          message: 'quietHours.days must be an array',
          value: qh.days,
        })
      } else {
        for (const [index, day] of qh.days.entries()) {
          if (typeof day !== 'string' || !this.VALID_DAYS.includes(day.toLowerCase())) {
            errors.push({
              field: `quietHours.days[${index}]`,
              message: `Invalid day name. Must be one of: ${this.VALID_DAYS.join(', ')}`,
              value: day,
            })
          }
        }
      }
    }

    // Validate timezone
    if (qh.timezone !== undefined && typeof qh.timezone !== 'string') {
      errors.push({
        field: 'quietHours.timezone',
        message: 'quietHours.timezone must be a string',
        value: qh.timezone,
      })
    }
  }

  /**
   * Validate time range
   */
  private static validateTimeRange(
    range: unknown,
    fieldPrefix: string,
    errors: ValidationError[],
    _warnings: ValidationError[],
  ): void {
    if (typeof range !== 'object' || range === null) {
      errors.push({
        field: fieldPrefix,
        message: 'Time range must be an object',
        value: range,
      })
      return
    }

    const r = range as Record<string, unknown>

    // Validate start time
    if (typeof r.start !== 'string' || !this.TIME_REGEX.test(r.start)) {
      errors.push({
        field: `${fieldPrefix}.start`,
        message: 'start time must be in HH:MM format (24-hour)',
        value: r.start,
      })
    }

    // Validate end time
    if (typeof r.end !== 'string' || !this.TIME_REGEX.test(r.end)) {
      errors.push({
        field: `${fieldPrefix}.end`,
        message: 'end time must be in HH:MM format (24-hour)',
        value: r.end,
      })
    }

    // Validate name (optional)
    if (r.name !== undefined && typeof r.name !== 'string') {
      errors.push({
        field: `${fieldPrefix}.name`,
        message: 'name must be a string',
        value: r.name,
      })
    }
  }

  /**
   * Validate speech configuration
   */
  private static validateSpeechConfig(
    speech: unknown,
    errors: ValidationError[],
    _warnings: ValidationError[],
  ): void {
    if (typeof speech !== 'object' || speech === null) {
      errors.push({
        field: 'speech',
        message: 'speech configuration must be an object',
        value: speech,
      })
      return
    }

    const s = speech as Record<string, unknown>

    // Validate voice
    if (s.voice !== undefined && typeof s.voice !== 'string') {
      errors.push({
        field: 'speech.voice',
        message: 'speech.voice must be a string',
        value: s.voice,
      })
    }

    // Validate rate
    if (s.rate !== undefined) {
      if (typeof s.rate !== 'number' || s.rate <= 0) {
        errors.push({
          field: 'speech.rate',
          message: 'speech.rate must be a positive number',
          value: s.rate,
        })
      } else if (s.rate < 50 || s.rate > 500) {
        _warnings.push({
          field: 'speech.rate',
          message: 'speech.rate outside typical range (50-500 WPM)',
          value: s.rate,
        })
      }
    }

    // Validate volume
    if (s.volume !== undefined) {
      if (typeof s.volume !== 'number' || s.volume < 0 || s.volume > 1) {
        errors.push({
          field: 'speech.volume',
          message: 'speech.volume must be a number between 0 and 1',
          value: s.volume,
        })
      }
    }

    // Validate enabled
    if (s.enabled !== undefined && typeof s.enabled !== 'boolean') {
      errors.push({
        field: 'speech.enabled',
        message: 'speech.enabled must be a boolean',
        value: s.enabled,
      })
    }
  }

  /**
   * Validate TTS configuration
   */
  private static validateTTSConfig(
    tts: unknown,
    errors: ValidationError[],
    _warnings: ValidationError[],
  ): void {
    if (typeof tts !== 'object' || tts === null) {
      errors.push({
        field: 'tts',
        message: 'tts configuration must be an object',
        value: tts,
      })
      return
    }

    const t = tts as Record<string, unknown>

    // Validate provider (required)
    const validProviders = ['openai', 'macos', 'elevenlabs', 'auto']
    if (typeof t.provider !== 'string' || !validProviders.includes(t.provider)) {
      errors.push({
        field: 'tts.provider',
        message: `tts.provider must be one of: ${validProviders.join(', ')}`,
        value: t.provider,
      })
    }

    // Validate fallbackProvider (optional)
    if (t.fallbackProvider !== undefined) {
      const validFallbacks = ['openai', 'macos', 'elevenlabs', 'none']
      if (typeof t.fallbackProvider !== 'string' || !validFallbacks.includes(t.fallbackProvider)) {
        errors.push({
          field: 'tts.fallbackProvider',
          message: `tts.fallbackProvider must be one of: ${validFallbacks.join(', ')}`,
          value: t.fallbackProvider,
        })
      }
    }

    // Validate OpenAI config (optional)
    if (t.openai !== undefined) {
      this.validateOpenAIConfig(t.openai, errors, _warnings)
    }

    // Validate macOS config (optional)
    if (t.macos !== undefined) {
      this.validateMacOSConfig(t.macos, errors, _warnings)
    }

    // Validate ElevenLabs config (optional)
    if (t.elevenlabs !== undefined) {
      this.validateElevenLabsConfig(t.elevenlabs, errors, _warnings)
    }
  }

  /**
   * Validate OpenAI TTS configuration
   */
  private static validateOpenAIConfig(
    openai: unknown,
    errors: ValidationError[],
    _warnings: ValidationError[],
  ): void {
    if (typeof openai !== 'object' || openai === null) {
      errors.push({
        field: 'tts.openai',
        message: 'tts.openai must be an object',
        value: openai,
      })
      return
    }

    const o = openai as Record<string, unknown>

    // Validate apiKey (optional, can be empty string)
    if (o.apiKey !== undefined && typeof o.apiKey !== 'string') {
      errors.push({
        field: 'tts.openai.apiKey',
        message: 'tts.openai.apiKey must be a string',
        value: o.apiKey,
      })
    }

    // Validate model (optional)
    if (o.model !== undefined) {
      const validModels = ['tts-1', 'tts-1-hd']
      if (typeof o.model !== 'string' || !validModels.includes(o.model)) {
        errors.push({
          field: 'tts.openai.model',
          message: `tts.openai.model must be one of: ${validModels.join(', ')}`,
          value: o.model,
        })
      }
    }

    // Validate voice (optional)
    if (o.voice !== undefined) {
      const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']
      if (typeof o.voice !== 'string' || !validVoices.includes(o.voice)) {
        errors.push({
          field: 'tts.openai.voice',
          message: `tts.openai.voice must be one of: ${validVoices.join(', ')}`,
          value: o.voice,
        })
      }
    }

    // Validate speed (optional)
    if (o.speed !== undefined) {
      if (typeof o.speed !== 'number' || o.speed < 0.25 || o.speed > 4.0) {
        errors.push({
          field: 'tts.openai.speed',
          message: 'tts.openai.speed must be a number between 0.25 and 4.0',
          value: o.speed,
        })
      }
    }

    // Validate format (optional)
    if (o.format !== undefined) {
      const validFormats = ['mp3', 'opus', 'aac', 'flac']
      if (typeof o.format !== 'string' || !validFormats.includes(o.format)) {
        errors.push({
          field: 'tts.openai.format',
          message: `tts.openai.format must be one of: ${validFormats.join(', ')}`,
          value: o.format,
        })
      }
    }
  }

  /**
   * Validate macOS TTS configuration
   */
  private static validateMacOSConfig(
    macos: unknown,
    errors: ValidationError[],
    _warnings: ValidationError[],
  ): void {
    if (typeof macos !== 'object' || macos === null) {
      errors.push({
        field: 'tts.macos',
        message: 'tts.macos must be an object',
        value: macos,
      })
      return
    }

    const m = macos as Record<string, unknown>

    // Validate voice (optional)
    if (m.voice !== undefined && typeof m.voice !== 'string') {
      errors.push({
        field: 'tts.macos.voice',
        message: 'tts.macos.voice must be a string',
        value: m.voice,
      })
    }

    // Validate rate (optional)
    if (m.rate !== undefined) {
      if (typeof m.rate !== 'number' || m.rate <= 0 || m.rate > 500) {
        errors.push({
          field: 'tts.macos.rate',
          message: 'tts.macos.rate must be a positive number <= 500',
          value: m.rate,
        })
      }
    }

    // Validate volume (optional)
    if (m.volume !== undefined) {
      if (typeof m.volume !== 'number' || m.volume < 0 || m.volume > 1) {
        errors.push({
          field: 'tts.macos.volume',
          message: 'tts.macos.volume must be a number between 0 and 1',
          value: m.volume,
        })
      }
    }

    // Validate enabled (optional)
    if (m.enabled !== undefined && typeof m.enabled !== 'boolean') {
      errors.push({
        field: 'tts.macos.enabled',
        message: 'tts.macos.enabled must be a boolean',
        value: m.enabled,
      })
    }
  }

  /**
   * Validate ElevenLabs TTS configuration
   */
  private static validateElevenLabsConfig(
    elevenlabs: unknown,
    errors: ValidationError[],
    _warnings: ValidationError[],
  ): void {
    if (typeof elevenlabs !== 'object' || elevenlabs === null) {
      errors.push({
        field: 'tts.elevenlabs',
        message: 'tts.elevenlabs must be an object',
        value: elevenlabs,
      })
      return
    }

    const el = elevenlabs as Record<string, unknown>

    // Validate apiKey (optional)
    if (el.apiKey !== undefined && typeof el.apiKey !== 'string') {
      errors.push({
        field: 'tts.elevenlabs.apiKey',
        message: 'tts.elevenlabs.apiKey must be a string',
        value: el.apiKey,
      })
    }

    // Validate voiceId (optional)
    if (el.voiceId !== undefined && typeof el.voiceId !== 'string') {
      errors.push({
        field: 'tts.elevenlabs.voiceId',
        message: 'tts.elevenlabs.voiceId must be a string',
        value: el.voiceId,
      })
    }

    // Validate modelId (optional)
    if (el.modelId !== undefined && typeof el.modelId !== 'string') {
      errors.push({
        field: 'tts.elevenlabs.modelId',
        message: 'tts.elevenlabs.modelId must be a string',
        value: el.modelId,
      })
    }

    // Validate outputFormat (optional)
    if (el.outputFormat !== undefined && typeof el.outputFormat !== 'string') {
      errors.push({
        field: 'tts.elevenlabs.outputFormat',
        message: 'tts.elevenlabs.outputFormat must be a string',
        value: el.outputFormat,
      })
    }

    // Validate stability (optional)
    if (el.stability !== undefined) {
      if (typeof el.stability !== 'number' || el.stability < 0 || el.stability > 1) {
        errors.push({
          field: 'tts.elevenlabs.stability',
          message: 'tts.elevenlabs.stability must be a number between 0 and 1',
          value: el.stability,
        })
      }
    }

    // Validate similarityBoost (optional)
    if (el.similarityBoost !== undefined) {
      if (
        typeof el.similarityBoost !== 'number' ||
        el.similarityBoost < 0 ||
        el.similarityBoost > 1
      ) {
        errors.push({
          field: 'tts.elevenlabs.similarityBoost',
          message: 'tts.elevenlabs.similarityBoost must be a number between 0 and 1',
          value: el.similarityBoost,
        })
      }
    }

    // Validate speed (optional)
    if (el.speed !== undefined) {
      if (typeof el.speed !== 'number' || el.speed < 0.5 || el.speed > 2.0) {
        errors.push({
          field: 'tts.elevenlabs.speed',
          message: 'tts.elevenlabs.speed must be a number between 0.5 and 2.0',
          value: el.speed,
        })
      }
    }

    // Validate enableLogging (optional)
    if (el.enableLogging !== undefined && typeof el.enableLogging !== 'boolean') {
      errors.push({
        field: 'tts.elevenlabs.enableLogging',
        message: 'tts.elevenlabs.enableLogging must be a boolean',
        value: el.enableLogging,
      })
    }
  }

  /**
   * Validate per-type settings
   */
  private static validatePerTypeSettings(
    perTypeSettings: unknown,
    errors: ValidationError[],
    _warnings: ValidationError[],
  ): void {
    if (typeof perTypeSettings !== 'object' || perTypeSettings === null) {
      errors.push({
        field: 'perTypeSettings',
        message: 'perTypeSettings must be an object',
        value: perTypeSettings,
      })
      return
    }

    const pts = perTypeSettings as Record<string, unknown>

    for (const [type, period] of Object.entries(pts)) {
      // Validate notification type
      if (!this.VALID_NOTIFICATION_TYPES.includes(type as NotificationType)) {
        errors.push({
          field: `perTypeSettings.${type}`,
          message: `Invalid notification type. Must be one of: ${this.VALID_NOTIFICATION_TYPES.join(', ')}`,
          value: type,
        })
        continue
      }

      // Validate period
      if (typeof period !== 'number' || period < 0) {
        errors.push({
          field: `perTypeSettings.${type}`,
          message: 'Period must be a non-negative number',
          value: period,
        })
      } else if (period > 300000) {
        // 5 minutes
        _warnings.push({
          field: `perTypeSettings.${type}`,
          message: 'Period is very long (>5 minutes)',
          value: period,
        })
      }
    }
  }

  /**
   * Validate time string format
   */
  static validateTimeString(time: string): boolean {
    return this.TIME_REGEX.test(time)
  }

  /**
   * Validate day name
   */
  static validateDayName(day: string): boolean {
    return this.VALID_DAYS.includes(day.toLowerCase())
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): CompleteHookConfig {
    return {
      debug: false,
      notifySound: false,
      speak: false,
      cooldownPeriod: 5000, // 5 seconds
      allowUrgentOverride: false,
      quietHours: {
        enabled: false,
        ranges: [],
        allowUrgentOverride: false,
        days: this.VALID_DAYS,
        timezone: 'local',
      },
      speech: {
        voice: 'default',
        rate: 200,
        volume: 0.7,
        enabled: false,
      },
      tts: {
        provider: 'auto',
        fallbackProvider: 'macos',
        openai: {
          model: 'tts-1',
          voice: 'alloy',
          speed: 1.0,
          format: 'mp3',
        },
        macos: {
          voice: 'Alex',
          rate: 200,
          volume: 0.7,
          enabled: true,
        },
        elevenlabs: {
          modelId: 'eleven_multilingual_v2',
          outputFormat: 'mp3_44100_128',
          stability: 0.5,
          similarityBoost: 0.75,
          speed: 1.0,
          enableLogging: true,
        },
      },
      perTypeSettings: {},
    }
  }
}
