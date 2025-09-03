/**
 * Cross-platform audio player
 */

import { exec } from 'node:child_process'

import { Platform } from './platform.js'

// Helper to promisify exec
const execAsync = (command: string): Promise<{ stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error)
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

/**
 * System sound definitions
 */
export interface SystemSounds {
  success: string
  error: string
  notification: string
}

/**
 * Audio player with cross-platform support
 */
export class AudioPlayer {
  /**
   * Play a sound file on the current platform
   */
  async playSound(soundFile: string, platform: Platform): Promise<boolean> {
    try {
      switch (platform) {
        case Platform.macOS:
          return await this.playMacOS(soundFile)
        case Platform.Windows:
          return await this.playWindows(soundFile)
        case Platform.Linux:
          return await this.playLinux(soundFile)
        default:
          return false
      }
    } catch {
      return false
    }
  }

  /**
   * Play sound on macOS using afplay
   */
  private async playMacOS(soundFile: string): Promise<boolean> {
    try {
      await execAsync(`afplay "${soundFile}"`)
      return true
    } catch {
      return false
    }
  }

  /**
   * Play sound on Windows using PowerShell
   */
  private async playWindows(soundFile: string): Promise<boolean> {
    try {
      const command = `powershell -c "(New-Object System.Media.SoundPlayer '${soundFile}').PlaySync()"`
      await execAsync(command)
      return true
    } catch {
      return false
    }
  }

  /**
   * Play sound on Linux with fallback chain
   */
  private async playLinux(soundFile: string): Promise<boolean> {
    // Try audio players in order of preference
    const players = ['aplay', 'paplay', 'play']

    for (const player of players) {
      if (await this.checkCommand(player)) {
        try {
          await execAsync(`${player} "${soundFile}"`)
          return true
        } catch {
          // Try next player
          continue
        }
      }
    }

    return false
  }

  /**
   * Check if a command exists on the system
   */
  private async checkCommand(command: string): Promise<boolean> {
    try {
      await execAsync(`which ${command}`)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get system sounds for the platform
   */
  getSystemSounds(platform: Platform): SystemSounds {
    switch (platform) {
      case Platform.macOS:
        return {
          success: '/System/Library/Sounds/Glass.aiff',
          error: '/System/Library/Sounds/Sosumi.aiff',
          notification: '/System/Library/Sounds/Ping.aiff',
        }
      case Platform.Windows:
        return {
          success: 'C:\\Windows\\Media\\chimes.wav',
          error: 'C:\\Windows\\Media\\chord.wav',
          notification: 'C:\\Windows\\Media\\notify.wav',
        }
      case Platform.Linux:
        // Linux doesn't have standard system sounds
        return {
          success: '',
          error: '',
          notification: '',
        }
      default:
        return {
          success: '',
          error: '',
          notification: '',
        }
    }
  }
}
