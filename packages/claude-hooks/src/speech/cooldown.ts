/**
 * Cooldown period management for notifications
 * Prevents notification spam by enforcing minimum time intervals between notifications
 */

export type NotificationType = 'speech' | 'audio' | 'urgent' | 'notification' | 'stop' | 'subagent'

export interface CooldownConfig {
  cooldownPeriod: number // Milliseconds
  allowUrgentOverride?: boolean
  perTypeSettings?: Partial<Record<NotificationType, number>>
}

export interface CooldownState {
  lastNotificationTime: number | null
  perTypeState?: Partial<Record<NotificationType, { lastTime: number | null }>>
}

/**
 * Manages cooldown periods between notifications to prevent spam
 */
export class Cooldown {
  private config: Required<CooldownConfig>
  private state: Required<CooldownState>

  constructor(config: CooldownConfig) {
    this.config = {
      cooldownPeriod: Math.max(0, config.cooldownPeriod), // Normalize negative values to 0
      allowUrgentOverride: config.allowUrgentOverride ?? false,
      perTypeSettings: config.perTypeSettings ?? {},
    }

    this.state = {
      lastNotificationTime: null,
      perTypeState: {},
    }

    // Initialize per-type state if settings provided
    if (config.perTypeSettings) {
      for (const type of Object.keys(config.perTypeSettings)) {
        this.state.perTypeState![type as NotificationType] = { lastTime: null }
      }
    }
  }

  /**
   * Check if a notification can be sent
   */
  canNotify(urgent: boolean = false, type?: NotificationType): boolean {
    const currentTime = Date.now()

    // Use type-specific state if available
    if (type && this.state.perTypeState![type]) {
      return this.canNotifyForType(currentTime, type, urgent)
    }

    // Use general cooldown
    if (!this.state.lastNotificationTime) {
      return true
    }

    const timeSinceLastV = currentTime - this.state.lastNotificationTime
    const cooldownExpired = timeSinceLastV >= this.config.cooldownPeriod

    return cooldownExpired || (urgent && this.config.allowUrgentOverride)
  }

  /**
   * Record a successful notification
   */
  recordNotification(type?: NotificationType): void {
    const currentTime = Date.now()

    // Update general state
    this.state.lastNotificationTime = currentTime

    // Update type-specific state if applicable
    if (type && this.state.perTypeState![type]) {
      this.state.perTypeState![type]!.lastTime = currentTime
    }
  }

  /**
   * Get remaining cooldown time in milliseconds
   */
  getRemainingCooldown(type?: NotificationType): number {
    const currentTime = Date.now()

    let lastTime: number | null
    let cooldownPeriod: number

    if (type && this.state.perTypeState![type] && this.config.perTypeSettings![type]) {
      lastTime = this.state.perTypeState![type]!.lastTime
      cooldownPeriod = this.config.perTypeSettings![type]!
    } else {
      lastTime = this.state.lastNotificationTime
      cooldownPeriod = this.config.cooldownPeriod
    }

    if (!lastTime) {
      return 0
    }

    const elapsed = currentTime - lastTime
    return Math.max(0, cooldownPeriod - elapsed)
  }

  /**
   * Get next available notification time
   */
  getNextAvailableTime(type?: NotificationType): number | null {
    let lastTime: number | null
    let cooldownPeriod: number

    if (type && this.state.perTypeState![type] && this.config.perTypeSettings![type]) {
      lastTime = this.state.perTypeState![type]!.lastTime
      cooldownPeriod = this.config.perTypeSettings![type]!
    } else {
      lastTime = this.state.lastNotificationTime
      cooldownPeriod = this.config.cooldownPeriod
    }

    if (!lastTime) {
      return null // Can notify immediately
    }

    return lastTime + cooldownPeriod
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CooldownConfig>): void {
    if (newConfig.cooldownPeriod !== undefined) {
      this.config.cooldownPeriod = Math.max(0, newConfig.cooldownPeriod)
    }

    if (newConfig.allowUrgentOverride !== undefined) {
      this.config.allowUrgentOverride = newConfig.allowUrgentOverride
    }

    if (newConfig.perTypeSettings !== undefined) {
      this.config.perTypeSettings = {
        ...this.config.perTypeSettings,
        ...newConfig.perTypeSettings,
      }

      // Initialize new type states
      for (const type of Object.keys(newConfig.perTypeSettings)) {
        if (!this.state.perTypeState![type as NotificationType]) {
          this.state.perTypeState![type as NotificationType] = {
            lastTime: null,
          }
        }
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<CooldownConfig> {
    return { ...this.config }
  }

  /**
   * Get current state (for debugging)
   */
  getState(): Required<CooldownState> {
    return {
      lastNotificationTime: this.state.lastNotificationTime,
      perTypeState: { ...this.state.perTypeState },
    }
  }

  /**
   * Reset cooldown state
   */
  reset(): void {
    this.state.lastNotificationTime = null
    for (const type of Object.keys(this.state.perTypeState!)) {
      this.state.perTypeState![type as NotificationType] = { lastTime: null }
    }
  }

  /**
   * Validate configuration
   */
  static validateConfig(config: CooldownConfig): boolean {
    if (typeof config.cooldownPeriod !== 'number' || config.cooldownPeriod < 0) {
      return false
    }

    if (
      config.allowUrgentOverride !== undefined &&
      typeof config.allowUrgentOverride !== 'boolean'
    ) {
      return false
    }

    if (config.perTypeSettings !== undefined) {
      if (typeof config.perTypeSettings !== 'object' || config.perTypeSettings === null) {
        return false
      }

      for (const [_type, period] of Object.entries(config.perTypeSettings)) {
        if (typeof period !== 'number' || period < 0) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Check if notification can be sent for specific type
   */
  private canNotifyForType(currentTime: number, type: NotificationType, urgent: boolean): boolean {
    const typeState = this.state.perTypeState![type]
    const typePeriod = this.config.perTypeSettings![type]

    if (!typeState || !typePeriod) {
      // Fall back to general cooldown
      return this.canNotify(urgent)
    }

    if (!typeState.lastTime) {
      return true
    }

    const elapsed = currentTime - typeState.lastTime
    const cooldownExpired = elapsed >= typePeriod

    return cooldownExpired || (urgent && this.config.allowUrgentOverride)
  }
}
