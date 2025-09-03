/**
 * Base class for all Claude Code hooks
 */

import type { ClaudeHookEvent, HookEventType } from './types/claude.js'

import { EventLogger } from './logging/event-logger.js'
import { HookExitCode } from './types/claude.js'
import { createLogger, type Logger } from './utils/logger.js'

export interface HookConfig {
  debug?: boolean
  [key: string]: unknown
}

export abstract class BaseHook<TEvent extends ClaudeHookEvent = ClaudeHookEvent> {
  protected readonly eventType: HookEventType
  protected readonly config: HookConfig
  protected readonly log: Logger
  protected readonly eventLogger: EventLogger

  constructor(eventType: HookEventType, config: HookConfig = {}) {
    this.eventType = eventType
    this.config = config
    this.log = createLogger(eventType.toUpperCase(), config.debug ?? false)

    // Configure EventLogger with environment variables
    const eventLoggerConfig = {
      logDir: process.env.CLAUDE_HOOKS_LOG_DIR,
      useLocalDir: process.env.CLAUDE_HOOKS_USE_LOCAL_DIR === 'true',
    }
    this.eventLogger = new EventLogger(eventLoggerConfig)
  }

  /**
   * Parse event from stdin
   */
  protected async parseEvent(): Promise<TEvent | null> {
    try {
      // Check if stdin is available
      if (process.stdin.isTTY) {
        this.log.debug('No stdin input available (TTY mode)')
        return null
      }

      // Read from stdin
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) {
        chunks.push(chunk)
      }

      const input = Buffer.concat(chunks).toString('utf-8').trim()
      if (!input) {
        this.log.debug('Empty stdin input')
        return null
      }

      // Parse JSON
      const event = JSON.parse(input) as TEvent & { hook_event_name?: string }

      // Handle Claude Code's actual format (hook_event_name) or test format (type)
      if (event.hook_event_name === this.eventType) {
        // Claude Code format - normalize to our expected format
        const normalizedEvent = {
          ...event,
          type: this.eventType,
        } as TEvent
        this.log.debug(
          `Parsed Claude Code ${this.eventType} event: ${JSON.stringify(normalizedEvent)}`,
        )
        return normalizedEvent
      } else if (event.type === this.eventType) {
        // Test format - already in expected format
        this.log.debug(`Parsed ${this.eventType} event: ${JSON.stringify(event)}`)
        return event
      } else {
        this.log.warning(
          `Expected ${this.eventType} event, got type=${String(event.type)}, hook_event_name=${String(event.hook_event_name)}`,
        )
        return null
      }

      return event
    } catch (error) {
      this.log.error(
        `Failed to parse event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
      return null
    }
  }

  /**
   * Handle the hook event
   */
  protected abstract handle(event: TEvent): Promise<void>

  /**
   * Run the hook
   */
  async run(): Promise<void> {
    let exitCode = HookExitCode.Success

    try {
      this.log.debug(`${this.eventType} Hook - Starting...`)

      // Parse event from stdin
      const event = await this.parseEvent()
      if (!event) {
        this.log.debug('No valid event received - exiting')
        exitCode = HookExitCode.Success
      } else {
        // Log the event
        await this.eventLogger.logEvent(event, {
          hookType: this.eventType,
          timestamp: new Date().toISOString(),
        })

        // Handle the event
        await this.handle(event)

        // Success
        this.log.debug(`${this.eventType} Hook - Completed successfully`)
      }
    } catch (error) {
      this.log.error(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      exitCode = HookExitCode.GeneralError
    }

    if (exitCode !== HookExitCode.Success) {
      throw new Error(`Hook execution failed with exit code ${exitCode}`)
    }
  }

  /**
   * Setup error handlers
   */
  setupErrorHandlers(): void {
    process.on('unhandledRejection', (error) => {
      this.log.error(
        `Unhandled rejection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
      process.exit(HookExitCode.GeneralError)
    })

    process.on('uncaughtException', (error) => {
      this.log.error(`Uncaught exception: ${error.message}`)
      process.exit(HookExitCode.GeneralError)
    })
  }

  /**
   * Entry point for hook execution
   */
  static async execute<T extends BaseHook, A extends readonly unknown[]>(
    HookClass: new (...args: A) => T,
    ...args: A
  ): Promise<void> {
    const hook = new HookClass(...args)
    hook.setupErrorHandlers()
    await hook.run()
  }
}
