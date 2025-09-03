/**
 * Quiet hours configuration for suppressing notifications during specified time periods
 * Supports multiple time ranges, timezone awareness, and day-of-week restrictions
 */

export interface QuietHoursRange {
  start: string // HH:MM format
  end: string // HH:MM format
  name?: string // Optional name for the range
}

export interface QuietHoursConfig {
  enabled: boolean
  ranges: QuietHoursRange[]
  timezone?: string // 'local' or timezone identifier
  allowUrgentOverride?: boolean
  days?: string[] // Day names to apply quiet hours
}

export interface TimeComponents {
  hours: number
  minutes: number
}

/**
 * Manages quiet hours configuration and checking
 */
export class QuietHours {
  private config: Required<QuietHoursConfig>

  constructor(config: QuietHoursConfig = { enabled: false, ranges: [] }) {
    this.config = {
      enabled: config.enabled,
      ranges: config.ranges,
      timezone: config.timezone ?? 'local',
      allowUrgentOverride: config.allowUrgentOverride ?? false,
      days: config.days ?? [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ],
    }
  }

  /**
   * Check if quiet hours are currently active
   */
  isQuietTime(currentTime?: Date, urgent: boolean = false): boolean {
    if (!this.config.enabled) {
      return false
    }

    // Allow urgent notifications to override quiet hours
    if (urgent && this.config.allowUrgentOverride) {
      return false
    }

    const now = currentTime ?? new Date()
    const dayName = this.getDayName(now)

    // Check if today is included in configured days
    if (!this.config.days.includes(dayName)) {
      return false
    }

    const currentTimeComponents = this.getTimeComponents(now)

    // Check if current time falls within any quiet hour range
    return this.config.ranges.some((range) => {
      return this.isTimeInRange(currentTimeComponents, range)
    })
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<QuietHoursConfig> {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<QuietHoursConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      ranges: newConfig.ranges ?? this.config.ranges,
      days: newConfig.days ?? this.config.days,
    }
  }

  /**
   * Validate a time string (HH:MM format)
   */
  static validateTimeString(time: string): boolean {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    return timeRegex.test(time)
  }

  /**
   * Parse time string to components
   */
  static parseTimeString(time: string): TimeComponents | null {
    if (!QuietHours.validateTimeString(time)) {
      return null
    }

    const [hours, minutes] = time.split(':').map(Number)
    return { hours, minutes }
  }

  /**
   * Convert 12-hour time to 24-hour format
   */
  static convert12to24Hour(time: string): string | null {
    const regex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
    const match = time.match(regex)

    if (!match) {
      return null
    }

    const [, hoursStr, minutesStr, period] = match
    let hours = parseInt(hoursStr, 10)
    const minutes = parseInt(minutesStr, 10)

    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      return null
    }

    // Convert to 24-hour format
    if (period.toUpperCase() === 'PM' && hours !== 12) {
      hours += 12
    } else if (period.toUpperCase() === 'AM' && hours === 12) {
      hours = 0
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  /**
   * Get time components from Date object
   */
  private getTimeComponents(date: Date): TimeComponents {
    return {
      hours: date.getHours(),
      minutes: date.getMinutes(),
    }
  }

  /**
   * Get day name from Date object
   */
  private getDayName(date: Date): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    return days[date.getDay()]
  }

  /**
   * Check if time is within a specific range
   */
  private isTimeInRange(time: TimeComponents, range: QuietHoursRange): boolean {
    const startTime = QuietHours.parseTimeString(range.start)
    const endTime = QuietHours.parseTimeString(range.end)

    if (!startTime || !endTime) {
      return false // Invalid range
    }

    const currentMinutes = time.hours * 60 + time.minutes
    const startMinutes = startTime.hours * 60 + startTime.minutes
    const endMinutes = endTime.hours * 60 + endTime.minutes

    if (startMinutes <= endMinutes) {
      // Same day range (e.g., 09:00 to 17:00)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes
    } else {
      // Overnight range (e.g., 22:00 to 08:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes
    }
  }

  /**
   * Add a quiet hours range
   */
  addRange(range: QuietHoursRange): boolean {
    // Validate range
    if (!QuietHours.validateTimeString(range.start) || !QuietHours.validateTimeString(range.end)) {
      return false
    }

    this.config.ranges.push(range)
    return true
  }

  /**
   * Remove a quiet hours range by index
   */
  removeRange(index: number): boolean {
    if (index < 0 || index >= this.config.ranges.length) {
      return false
    }

    this.config.ranges.splice(index, 1)
    return true
  }

  /**
   * Clear all ranges
   */
  clearRanges(): void {
    this.config.ranges = []
  }

  /**
   * Get next time when quiet hours will end
   */
  getNextQuietEndTime(currentTime?: Date): Date | null {
    if (!this.config.enabled || this.config.ranges.length === 0) {
      return null
    }

    const now = currentTime ?? new Date()
    const currentTimeComponents = this.getTimeComponents(now)

    // Find the range we're currently in
    const activeRange = this.config.ranges.find((range) => {
      return this.isTimeInRange(currentTimeComponents, range)
    })

    if (!activeRange) {
      return null // Not currently in quiet hours
    }

    const endTime = QuietHours.parseTimeString(activeRange.end)
    if (!endTime) {
      return null
    }

    const result = new Date(now)
    result.setHours(endTime.hours, endTime.minutes, 0, 0)

    // If end time is earlier in the day, it's tomorrow
    const startTime = QuietHours.parseTimeString(activeRange.start)
    if (startTime && startTime.hours > endTime.hours) {
      result.setDate(result.getDate() + 1)
    }

    return result
  }
}
