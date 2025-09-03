/**
 * Configuration for Sub-agent Integration
 * Controls escalation sensitivity and cost optimization
 */

export interface SubAgentConfig {
  /**
   * Whether sub-agent analysis is enabled
   * @default true
   */
  enabled: boolean

  /**
   * Escalation sensitivity level
   * - 'conservative': Only escalate complex type errors (10-15% target)
   * - 'balanced': Escalate moderate complexity errors (15-25% target)
   * - 'aggressive': Escalate most TypeScript errors (25-40% target)
   * @default 'conservative'
   */
  escalationSensitivity: 'conservative' | 'balanced' | 'aggressive'

  /**
   * Maximum percentage of errors to escalate (cost control)
   * @default 0.15 (15%)
   */
  maxEscalationRate: number

  /**
   * Monthly cost limit in USD
   * @default 10
   */
  monthlyCostLimit: number

  /**
   * Daily invocation limit
   * @default 100
   */
  dailyInvocationLimit: number

  /**
   * Timeout for sub-agent analysis in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout: number

  /**
   * Circuit breaker configuration
   */
  circuitBreaker: {
    /**
     * Number of consecutive failures before opening circuit
     * @default 3
     */
    maxFailures: number

    /**
     * Cooldown period in milliseconds before retrying
     * @default 60000 (1 minute)
     */
    cooldownPeriod: number
  }

  /**
   * Error patterns to always escalate (regex patterns)
   * @default []
   */
  alwaysEscalatePatterns: string[]

  /**
   * Error patterns to never escalate (regex patterns)
   * @default []
   */
  neverEscalatePatterns: string[]

  /**
   * Minimum complexity score for escalation (0-100)
   * Used with sensitivity levels
   * @default 50
   */
  minComplexityScore: number

  /**
   * Enable usage metrics tracking
   * @default true
   */
  trackMetrics: boolean

  /**
   * Enable debug logging
   * @default false
   */
  debug: boolean
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: SubAgentConfig = {
  enabled: true,
  escalationSensitivity: 'conservative',
  maxEscalationRate: 0.15,
  monthlyCostLimit: 10,
  dailyInvocationLimit: 100,
  timeout: 30000,
  circuitBreaker: {
    maxFailures: 3,
    cooldownPeriod: 60000,
  },
  alwaysEscalatePatterns: [],
  neverEscalatePatterns: [],
  minComplexityScore: 50,
  trackMetrics: true,
  debug: false,
}

/**
 * Sensitivity level configurations
 */
export const SENSITIVITY_CONFIGS = {
  conservative: {
    minComplexityScore: 70,
    targetEscalationRate: 0.125, // 12.5% (middle of 10-15% range)
  },
  balanced: {
    minComplexityScore: 50,
    targetEscalationRate: 0.2, // 20% (middle of 15-25% range)
  },
  aggressive: {
    minComplexityScore: 30,
    targetEscalationRate: 0.325, // 32.5% (middle of 25-40% range)
  },
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): Partial<SubAgentConfig> {
  const config: Partial<SubAgentConfig> = {}

  // Main toggles
  if (process.env.CLAUDE_HOOKS_SUBAGENT_ENABLED !== undefined) {
    config.enabled = process.env.CLAUDE_HOOKS_SUBAGENT_ENABLED === 'true'
  }

  if (process.env.CLAUDE_HOOKS_SUBAGENT_SENSITIVITY) {
    const sensitivity = process.env.CLAUDE_HOOKS_SUBAGENT_SENSITIVITY as
      | 'conservative'
      | 'balanced'
      | 'aggressive'
    if (['conservative', 'balanced', 'aggressive'].includes(sensitivity)) {
      config.escalationSensitivity = sensitivity
    }
  }

  // Cost controls
  if (process.env.CLAUDE_HOOKS_SUBAGENT_MAX_ESCALATION_RATE) {
    const rate = parseFloat(process.env.CLAUDE_HOOKS_SUBAGENT_MAX_ESCALATION_RATE)
    if (!isNaN(rate) && rate > 0 && rate <= 1) {
      config.maxEscalationRate = rate
    }
  }

  if (process.env.CLAUDE_HOOKS_SUBAGENT_MONTHLY_COST_LIMIT) {
    const limit = parseFloat(process.env.CLAUDE_HOOKS_SUBAGENT_MONTHLY_COST_LIMIT)
    if (!isNaN(limit) && limit > 0) {
      config.monthlyCostLimit = limit
    }
  }

  if (process.env.CLAUDE_HOOKS_SUBAGENT_DAILY_LIMIT) {
    const limit = parseInt(process.env.CLAUDE_HOOKS_SUBAGENT_DAILY_LIMIT, 10)
    if (!isNaN(limit) && limit > 0) {
      config.dailyInvocationLimit = limit
    }
  }

  // Timeout
  if (process.env.CLAUDE_HOOKS_SUBAGENT_TIMEOUT) {
    const timeout = parseInt(process.env.CLAUDE_HOOKS_SUBAGENT_TIMEOUT, 10)
    if (!isNaN(timeout) && timeout > 0) {
      config.timeout = timeout
    }
  }

  // Circuit breaker
  if (process.env.CLAUDE_HOOKS_SUBAGENT_MAX_FAILURES) {
    const maxFailures = parseInt(process.env.CLAUDE_HOOKS_SUBAGENT_MAX_FAILURES, 10)
    if (!isNaN(maxFailures) && maxFailures > 0) {
      if (!config.circuitBreaker) {
        config.circuitBreaker = {
          maxFailures: DEFAULT_CONFIG.circuitBreaker.maxFailures,
          cooldownPeriod: DEFAULT_CONFIG.circuitBreaker.cooldownPeriod,
        }
      }
      config.circuitBreaker.maxFailures = maxFailures
    }
  }

  if (process.env.CLAUDE_HOOKS_SUBAGENT_COOLDOWN) {
    const cooldown = parseInt(process.env.CLAUDE_HOOKS_SUBAGENT_COOLDOWN, 10)
    if (!isNaN(cooldown) && cooldown > 0) {
      if (!config.circuitBreaker) {
        config.circuitBreaker = {
          maxFailures: DEFAULT_CONFIG.circuitBreaker.maxFailures,
          cooldownPeriod: DEFAULT_CONFIG.circuitBreaker.cooldownPeriod,
        }
      }
      config.circuitBreaker.cooldownPeriod = cooldown
    }
  }

  // Debug mode
  if (process.env.CLAUDE_HOOKS_SUBAGENT_DEBUG !== undefined) {
    config.debug = process.env.CLAUDE_HOOKS_SUBAGENT_DEBUG === 'true'
  }

  return config
}

/**
 * Merge configurations with proper precedence
 */
export function mergeConfig(...configs: Partial<SubAgentConfig>[]): SubAgentConfig {
  const merged = { ...DEFAULT_CONFIG }

  for (const config of configs) {
    if (config.enabled !== undefined) merged.enabled = config.enabled
    if (config.escalationSensitivity !== undefined) {
      merged.escalationSensitivity = config.escalationSensitivity
    }
    if (config.maxEscalationRate !== undefined) {
      merged.maxEscalationRate = config.maxEscalationRate
    }
    if (config.monthlyCostLimit !== undefined) {
      merged.monthlyCostLimit = config.monthlyCostLimit
    }
    if (config.dailyInvocationLimit !== undefined) {
      merged.dailyInvocationLimit = config.dailyInvocationLimit
    }
    if (config.timeout !== undefined) merged.timeout = config.timeout
    if (config.circuitBreaker) {
      merged.circuitBreaker = {
        ...merged.circuitBreaker,
        ...config.circuitBreaker,
      }
    }
    if (config.alwaysEscalatePatterns) {
      merged.alwaysEscalatePatterns = config.alwaysEscalatePatterns
    }
    if (config.neverEscalatePatterns) {
      merged.neverEscalatePatterns = config.neverEscalatePatterns
    }
    if (config.minComplexityScore !== undefined) {
      merged.minComplexityScore = config.minComplexityScore
    }
    if (config.trackMetrics !== undefined) {
      merged.trackMetrics = config.trackMetrics
    }
    if (config.debug !== undefined) merged.debug = config.debug
  }

  // Apply sensitivity level overrides
  const sensitivityConfig = SENSITIVITY_CONFIGS[merged.escalationSensitivity]
  if (sensitivityConfig) {
    // Only override if not explicitly set
    if (!configs.some((c) => c.minComplexityScore !== undefined)) {
      merged.minComplexityScore = sensitivityConfig.minComplexityScore
    }
  }

  return merged
}

/**
 * Validate configuration
 */
export function validateConfig(config: SubAgentConfig): string[] {
  const errors: string[] = []

  if (config.maxEscalationRate <= 0 || config.maxEscalationRate > 1) {
    errors.push('maxEscalationRate must be between 0 and 1')
  }

  if (config.monthlyCostLimit <= 0) {
    errors.push('monthlyCostLimit must be positive')
  }

  if (config.dailyInvocationLimit <= 0) {
    errors.push('dailyInvocationLimit must be positive')
  }

  if (config.timeout <= 0) {
    errors.push('timeout must be positive')
  }

  if (config.circuitBreaker.maxFailures <= 0) {
    errors.push('circuitBreaker.maxFailures must be positive')
  }

  if (config.circuitBreaker.cooldownPeriod <= 0) {
    errors.push('circuitBreaker.cooldownPeriod must be positive')
  }

  if (config.minComplexityScore < 0 || config.minComplexityScore > 100) {
    errors.push('minComplexityScore must be between 0 and 100')
  }

  // Validate regex patterns
  for (const pattern of [...config.alwaysEscalatePatterns, ...config.neverEscalatePatterns]) {
    try {
      new RegExp(pattern)
    } catch {
      errors.push(`Invalid regex pattern: ${pattern}`)
    }
  }

  return errors
}

/**
 * Calculate complexity score for an error
 */
export function calculateComplexityScore(error: string): number {
  let score = 0

  // Base complexity by error type
  if (error.includes('generic')) score += 30
  if (error.includes('constraint')) score += 25
  if (error.includes('interface')) score += 20
  if (error.includes('not assignable to type')) score += 25
  if (error.includes('does not exist on type')) score += 15
  if (error.includes('cannot find module')) score += 10

  // Additional complexity factors
  if (error.includes('Promise<')) score += 15
  if (error.includes('extends')) score += 20
  if (error.includes('infer')) score += 30
  if (error.includes('keyof')) score += 20
  if (error.includes('typeof')) score += 10

  // Complexity by error length (longer errors tend to be more complex)
  const errorLength = error.length
  if (errorLength > 500) score += 20
  else if (errorLength > 300) score += 15
  else if (errorLength > 200) score += 10
  else if (errorLength > 100) score += 5

  // Cap at 100
  return Math.min(score, 100)
}

/**
 * Check if error should be escalated based on configuration
 */
export function shouldEscalateError(
  error: string,
  config: SubAgentConfig,
  currentEscalationRate: number,
): boolean {
  // Check if sub-agent is enabled
  if (!config.enabled) return false

  // Check never escalate patterns
  for (const pattern of config.neverEscalatePatterns) {
    if (new RegExp(pattern).test(error)) {
      return false
    }
  }

  // Check always escalate patterns
  for (const pattern of config.alwaysEscalatePatterns) {
    if (new RegExp(pattern).test(error)) {
      return true
    }
  }

  // Check escalation rate limit
  if (currentEscalationRate >= config.maxEscalationRate) {
    return false
  }

  // Check complexity score
  const complexityScore = calculateComplexityScore(error)
  return complexityScore >= config.minComplexityScore
}

/**
 * Create a configuration from CLI arguments
 */
export function createConfigFromArgs(args: string[]): Partial<SubAgentConfig> {
  const config: Partial<SubAgentConfig> = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]

    switch (arg) {
      case '--subagent-enabled':
        config.enabled = nextArg === 'true'
        i++
        break
      case '--subagent-sensitivity':
        if (['conservative', 'balanced', 'aggressive'].includes(nextArg)) {
          config.escalationSensitivity = nextArg as 'conservative' | 'balanced' | 'aggressive'
          i++
        }
        break
      case '--subagent-max-rate': {
        const rate = parseFloat(nextArg)
        if (!isNaN(rate)) {
          config.maxEscalationRate = rate
          i++
        }
        break
      }
      case '--subagent-cost-limit': {
        const costLimit = parseFloat(nextArg)
        if (!isNaN(costLimit)) {
          config.monthlyCostLimit = costLimit
          i++
        }
        break
      }
      case '--subagent-daily-limit': {
        const dailyLimit = parseInt(nextArg, 10)
        if (!isNaN(dailyLimit)) {
          config.dailyInvocationLimit = dailyLimit
          i++
        }
        break
      }
      case '--subagent-timeout': {
        const timeout = parseInt(nextArg, 10)
        if (!isNaN(timeout)) {
          config.timeout = timeout
          i++
        }
        break
      }
      case '--subagent-debug':
        config.debug = true
        break
    }
  }

  return config
}
