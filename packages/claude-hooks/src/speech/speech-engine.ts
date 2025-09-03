/**
 * Speech engine for macOS text-to-speech functionality
 * Uses the macOS `say` command for speech synthesis
 */

import { exec } from 'node:child_process'

import { detectPlatform, Platform } from '../audio/platform.js'

export interface SpeechOptions {
  voice?: string
  rate?: number
  volume?: number
  enabled?: boolean
}

export interface VoiceInfo {
  name: string
  language: string
  description: string
}

/**
 * Speech engine for macOS text-to-speech
 */
export class SpeechEngine {
  private options: Required<SpeechOptions>
  private platform: Platform

  constructor(options: SpeechOptions = {}) {
    this.platform = detectPlatform()
    this.options = {
      voice: options.voice ?? 'Samantha',
      rate: options.rate ?? 200,
      volume: options.volume ?? 0.8,
      enabled: options.enabled ?? true,
    }
  }

  /**
   * Check if speech is supported on current platform
   */
  isSupported(): boolean {
    return this.platform === Platform.macOS
  }

  /**
   * Speak the given text using macOS say command
   */
  async speak(text: string): Promise<boolean> {
    // Check if speech is enabled
    if (!this.options.enabled) {
      return false
    }

    // Check if platform is supported
    if (!this.isSupported()) {
      return false
    }

    // Validate text
    const cleanText = text.trim()
    if (!cleanText) {
      return false
    }

    try {
      const command = this.buildSayCommand(cleanText)

      return new Promise((resolve) => {
        exec(command, (error) => {
          if (error) {
            resolve(false)
          } else {
            resolve(true)
          }
        })
      })
    } catch (_error) {
      return false
    }
  }

  /**
   * Get list of available voices on macOS
   */
  async getAvailableVoices(): Promise<VoiceInfo[]> {
    if (!this.isSupported()) {
      return []
    }

    try {
      return new Promise((resolve) => {
        exec('say -v ?', (error, stdout) => {
          if (error) {
            resolve([])
            return
          }

          const voices = this.parseVoicesOutput(stdout)
          resolve(voices)
        })
      })
    } catch (_error) {
      return []
    }
  }

  /**
   * Update speech options
   */
  updateOptions(newOptions: Partial<SpeechOptions>): void {
    this.options = {
      ...this.options,
      ...newOptions,
    }
  }

  /**
   * Get current speech options
   */
  getOptions(): Required<SpeechOptions> {
    return { ...this.options }
  }

  /**
   * Enable or disable speech
   */
  setEnabled(enabled: boolean): void {
    this.options.enabled = enabled
  }

  /**
   * Build the say command with options
   */
  private buildSayCommand(text: string): string {
    const escapedText = this.escapeText(text)
    const parts = ['say']

    // Add voice option
    if (this.options.voice) {
      parts.push(`-v "${this.options.voice}"`)
    }

    // Add rate option
    if (this.options.rate !== 200) {
      // 200 is default rate
      parts.push(`-r ${this.options.rate}`)
    }

    // Add volume option
    if (this.options.volume !== 0.8) {
      // Different from default
      parts.push(`--volume=${this.options.volume}`)
    }

    // Add text
    parts.push(`"${escapedText}"`)

    return parts.join(' ')
  }

  /**
   * Escape special characters in text for shell command
   */
  private escapeText(text: string): string {
    // Normalize whitespace and newlines
    let normalized = text.replace(/\s+/g, ' ').trim()

    // Truncate very long text
    if (normalized.length > 500) {
      normalized = `${normalized.substring(0, 500)}...`
    }

    // Escape quotes and shell special characters
    return normalized
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')
  }

  /**
   * Parse the output from `say -v ?` command
   */
  private parseVoicesOutput(output: string): VoiceInfo[] {
    const voices: VoiceInfo[] = []
    const lines = output.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Parse format: "VoiceName    language    # Description"
      const match = trimmed.match(/^(\w+)\s+(\w+_\w+)\s*#\s*(.+)$/)
      if (match) {
        const [, name, language, description] = match
        voices.push({
          name: name.trim(),
          language: language.trim(),
          description: description.trim(),
        })
      }
    }

    return voices
  }
}
