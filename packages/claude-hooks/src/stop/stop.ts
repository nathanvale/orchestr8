/**
 * Stop hook for Claude Code
 * Plays sound when Claude completes a task
 */

// Load environment variables from .env file
import '../utils/env-loader.js'

import type { TTSProvider, TTSProviderConfig } from '../speech/providers/tts-provider.js'
import type { ClaudeStopEvent } from '../types/claude.js'

import { AudioPlayer } from '../audio/audio-player.js'
import { detectPlatform, Platform } from '../audio/platform.js'
import { BaseHook, type HookConfig } from '../base-hook.js'
import { TranscriptParser } from '../logging/transcript-parser.js'
// Import providers and ensure registration
import { initializeProviders } from '../speech/providers/index.js'
import { TTSProviderFactory, type FactoryConfig } from '../speech/providers/provider-factory.js'

// Ensure providers are registered
initializeProviders()

export interface StopHookConfig extends HookConfig {
  chat?: boolean
  speak?: boolean
  notifySound?: boolean
  tts?: {
    provider: 'openai' | 'macos' | 'elevenlabs' | 'auto'
    fallbackProvider?: 'macos' | 'elevenlabs' | 'none'
    openai?: TTSProviderConfig
    macos?: TTSProviderConfig
    elevenlabs?: TTSProviderConfig
  }
}

export class StopHook extends BaseHook<ClaudeStopEvent> {
  private readonly chat: boolean
  private speak: boolean // Remove readonly to allow disabling on error
  private readonly notifySound: boolean
  private readonly player: AudioPlayer
  private readonly ttsProviderPromise: Promise<TTSProvider | null>
  private readonly platform: Platform
  private readonly transcriptParser: TranscriptParser

  constructor(config: StopHookConfig = {}) {
    super('Stop', config)
    this.chat = config.chat ?? false
    this.speak = config.speak ?? false
    this.notifySound = config.notifySound ?? true
    this.player = new AudioPlayer()

    // Initialize TTS provider using factory (async) with configuration from config file
    const ttsConfig = config.tts as Partial<FactoryConfig> | undefined

    // Debug log the TTS config being used
    this.log.debug(`TTS Config: ${JSON.stringify(ttsConfig, null, 2)}`)
    this.log.debug(`OpenAI API Key available: ${!!process.env.OPENAI_API_KEY}`)

    const factoryConfig: FactoryConfig = {
      provider: ttsConfig?.provider || 'auto',
      fallbackProvider: ttsConfig?.fallbackProvider || 'macos',
      openai: ttsConfig?.openai as TTSProviderConfig | undefined,
      macos: ttsConfig?.macos || { enabled: true },
      elevenlabs: ttsConfig?.elevenlabs as TTSProviderConfig | undefined,
    }
    this.ttsProviderPromise = TTSProviderFactory.createWithFallback(factoryConfig)
      .then((provider) => {
        this.log.debug(`TTS Provider selected: ${provider.getProviderInfo().displayName}`)
        return provider
      })
      .catch((error) => {
        // Log the error and disable TTS functionality
        this.log.error(`Failed to initialize TTS provider: ${String(error)}`)
        this.speak = false // Disable speech since provider initialization failed

        // Return null to indicate provider is not available
        // This allows the application to continue without TTS functionality
        return null
      })

    this.platform = detectPlatform()
    this.transcriptParser = new TranscriptParser()
  }

  protected async handle(event: ClaudeStopEvent): Promise<void> {
    // Extract data from either format
    const success = event.data?.success ?? true
    const duration = event.data?.duration ?? event.data?.executionTimeMs
    const task = event.data?.task

    // Extract transcript_path from root level (Claude Code format) or ignore for test format
    const transcriptPath = event.transcript_path

    // Log task completion
    if (success) {
      this.log.success(
        `Task completed${task ? `: ${task}` : ''}${
          duration ? ` in ${Math.round(duration / 1000)}s` : ''
        }`,
      )
    } else {
      this.log.error(
        `Task failed${task ? `: ${task}` : ''}${
          duration ? ` after ${Math.round(duration / 1000)}s` : ''
        }`,
      )
    }

    // Process transcript if chat flag is enabled
    // Check both root level (Claude Code format) and nested (if somehow provided in data)
    if (this.chat && transcriptPath) {
      await this.processTranscript(transcriptPath)
    }

    // Handle speech if enabled
    if (this.speak) {
      await this.handleSpeech(event)
    }

    // Handle sound notification if enabled
    if (this.notifySound) {
      // Check if platform is supported
      if (this.platform === Platform.Unsupported) {
        this.log.warning('Audio notifications not supported on this platform')
        return
      }

      // Get appropriate sound based on success
      const sounds = this.player.getSystemSounds(this.platform)
      const soundFile = success ? sounds.success : sounds.error

      if (!soundFile) {
        this.log.warning('No completion sound available for platform')
        return
      }

      // Play the sound
      try {
        const played = await this.player.playSound(soundFile, this.platform)
        if (!played) {
          this.log.warning('Failed to play completion sound')
        }
      } catch (error) {
        this.log.error(
          `Error playing completion sound: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        )
      }
    }
  }

  private async handleSpeech(event: ClaudeStopEvent): Promise<void> {
    // Wait for TTS provider to be initialized
    const ttsProvider = await this.ttsProviderPromise

    // Check if provider initialization failed
    if (!ttsProvider) {
      this.log.debug('TTS provider initialization failed')
      return
    }

    if (!(await ttsProvider.isAvailable())) {
      this.log.debug('TTS provider not available')
      return
    }

    // Generate speech message based on task completion
    const success = event.data?.success ?? true
    const task = event.data?.task
    const duration = event.data?.duration

    let speechMessage = success ? 'Task completed' : 'Task failed'
    if (task) {
      speechMessage += `: ${task}`
    }
    if (duration) {
      speechMessage += ` in ${Math.round(duration / 1000)} seconds`
    }

    try {
      const result = await ttsProvider.speak(speechMessage)
      if (result.success) {
        this.log.success('Speech notification delivered')
      } else {
        this.log.warning(
          `Failed to deliver speech notification: ${result.error || 'Unknown error'}`,
        )
      }
    } catch (error) {
      this.log.error(
        `Error delivering speech notification: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  private async processTranscript(transcriptPath: string): Promise<void> {
    try {
      // Use the new transcript parser to parse and store the transcript
      const storedTranscript = await this.transcriptParser.parseAndStoreTranscript(transcriptPath)

      if (!storedTranscript) {
        this.log.debug('No transcript content to process')
        return
      }

      const { transcript } = storedTranscript
      const summary = this.transcriptParser.getSummary(transcript)

      this.log.info(
        `Processed transcript: ${summary.totalTurns} turns (${summary.userTurns} user, ${summary.assistantTurns} assistant)`,
      )

      // Show the last assistant message for immediate context
      const lastMessage = this.transcriptParser.getLastAssistantMessage(transcript)
      if (lastMessage) {
        this.log.info('Latest assistant response:')
        console.error(lastMessage)
      }

      // Log storage location for reference
      this.log.debug(`Transcript stored with ID: ${storedTranscript.id}`)
    } catch (error) {
      this.log.warning(
        `Failed to process transcript: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }
}

// Hook entry point
export async function main(): Promise<void> {
  // Debug log to file to see if hook is being called
  try {
    const fs = await import('node:fs')
    await fs.promises.appendFile(
      '/tmp/claude-stop-hook.log',
      `Stop hook called at ${new Date().toISOString()}\n` +
        `Args: ${JSON.stringify(process.argv)}\n` +
        `Env vars: OPENAI_API_KEY=${!!process.env.OPENAI_API_KEY}\n`,
    )
  } catch {
    // Ignore logging errors
  }

  // Load auto-config from .claude/hooks/stop.config.json
  const { loadAutoConfig } = await import('../utils/auto-config.js')
  const jsonConfig = await loadAutoConfig<StopHookConfig>('stop')

  // Merge with CLI arguments (CLI args override JSON)
  const config: StopHookConfig = {
    ...jsonConfig,
    chat: process.argv.includes('--chat') || jsonConfig.chat,
    speak: process.argv.includes('--speak') || jsonConfig.speak,
    debug: process.argv.includes('--debug') || jsonConfig.debug,
  }

  await BaseHook.execute(StopHook, config)
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
