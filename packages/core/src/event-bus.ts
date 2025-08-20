import { EventEmitter } from 'node:events'

import type { Logger } from '@orchestr8/logger'

/**
 * Configuration for the BoundedEventBus
 */
export interface EventBusConfig {
  /** Maximum number of events that can be queued. Default: 1000 */
  maxQueueSize?: number
  /** Overflow policy when queue is full. Default: 'dropOldest' */
  overflowPolicy?: 'dropOldest'
  /** Whether to warn when events are dropped. Default: true */
  warnOnDrop?: boolean
  /** Interval for calculating metrics like drop rate (ms). Default: 60000 */
  metricsInterval?: number
  /** Maximum listeners per event type. Default: 100 */
  maxListenersPerEvent?: number
  /** Enable memory tracking (has performance cost). Default: false */
  enableMemoryTracking?: boolean
}

/**
 * Metrics exposed by the event bus
 */
export interface EventBusMetrics {
  /** Number of events dropped due to queue overflow */
  droppedCount: number
  /** Timestamp of last dropped event */
  lastDropTimestamp: number | null
  /** Maximum queue size reached */
  highWaterMark: number
  /** Current queue size */
  queueSize: number
  /** Events dropped per minute */
  dropRate: number
  /** Map of event types to listener counts */
  listeners: Map<string, number>
}

/**
 * Workflow lifecycle events
 */
export type WorkflowEvent =
  | { type: 'workflow.started'; workflowId: string; timestamp: number }
  | { type: 'workflow.completed'; workflowId: string; duration: number }
  | { type: 'workflow.failed'; workflowId: string; error: Error }

/**
 * Execution lifecycle events
 */
export type ExecutionEvent =
  | { type: 'execution.queued'; executionId: string; workflowId: string }
  | { type: 'execution.started'; executionId: string }
  | { type: 'execution.cancelled'; executionId: string; reason: string }

/**
 * Step execution events
 */
export type StepEvent =
  | { type: 'step.started'; stepId: string; executionId: string }
  | { type: 'step.completed'; stepId: string; output: unknown }
  | { type: 'step.failed'; stepId: string; error: Error; retryable: boolean }

/**
 * Resilience pattern events
 */
export type ResilienceEvent =
  | { type: 'retry.attempted'; stepId: string; attempt: number; delay: number }
  | { type: 'circuitBreaker.opened'; key: string; failures: number }
  | { type: 'timeout.exceeded'; stepId: string; duration: number }

/**
 * All orchestration events
 */
export type OrchestrationEvent =
  | WorkflowEvent
  | ExecutionEvent
  | StepEvent
  | ResilienceEvent

/**
 * Internal event wrapper for queue management
 */
interface QueuedEvent {
  event: OrchestrationEvent
  timestamp: number
}

/**
 * BoundedEventBus with queue management and overflow handling
 */
export class BoundedEventBus extends EventEmitter {
  private readonly config: Required<EventBusConfig>
  private readonly queue: QueuedEvent[] = []
  private readonly logger?: Logger

  // Metrics tracking
  private droppedCount = 0
  private lastDropTimestamp: number | null = null
  private highWaterMark = 0
  private lastWarnTime = 0
  private dropTimestamps: number[] = []

  // Processing state
  private isProcessing = false

  constructor(config: EventBusConfig = {}, logger?: Logger) {
    super()

    // Validate configuration
    if (config.maxQueueSize !== undefined && config.maxQueueSize <= 0) {
      throw new Error('maxQueueSize must be greater than 0')
    }

    // Set defaults
    this.config = {
      maxQueueSize: config.maxQueueSize ?? 1000,
      overflowPolicy: config.overflowPolicy ?? 'dropOldest',
      warnOnDrop: config.warnOnDrop ?? true,
      metricsInterval: config.metricsInterval ?? 60000,
      maxListenersPerEvent: config.maxListenersPerEvent ?? 100,
      enableMemoryTracking: config.enableMemoryTracking ?? false,
    }

    this.logger = logger

    // Set max listeners per event type
    this.setMaxListeners(this.config.maxListenersPerEvent)
  }

  /**
   * Emit an event asynchronously using queueMicrotask
   */
  emitEvent(event: OrchestrationEvent): boolean {
    // Add to queue with timestamp
    const queuedEvent: QueuedEvent = {
      event: this.cloneEvent(event),
      timestamp: Date.now(),
    }

    // Check queue capacity
    if (this.queue.length >= this.config.maxQueueSize) {
      this.handleOverflow()
    }

    this.queue.push(queuedEvent)
    this.updateHighWaterMark()

    // Schedule processing if not already scheduled
    if (!this.isProcessing) {
      this.isProcessing = true
      queueMicrotask(() => this.processQueue())
    }

    return true
  }

  /**
   * Add event listener with type safety
   */
  on(
    eventType: OrchestrationEvent['type'],
    listener: (event: OrchestrationEvent) => void,
  ): this {
    return super.on(eventType, listener)
  }

  /**
   * Remove event listener
   */
  off(
    eventType: OrchestrationEvent['type'],
    listener: (event: OrchestrationEvent) => void,
  ): this {
    return super.off(eventType, listener)
  }

  /**
   * Get current metrics
   */
  getMetrics(): EventBusMetrics {
    const listeners = new Map<string, number>()

    // Count listeners for each event type
    for (const eventType of this.eventNames()) {
      const count = this.listenerCount(eventType)
      if (count > 0) {
        listeners.set(eventType as string, count)
      }
    }

    return {
      droppedCount: this.droppedCount,
      lastDropTimestamp: this.lastDropTimestamp,
      highWaterMark: this.highWaterMark,
      queueSize: this.queue.length,
      dropRate: this.calculateDropRate(),
      listeners,
    }
  }

  /**
   * Process queued events
   */
  private async processQueue(): Promise<void> {
    while (this.queue.length > 0) {
      const queuedEvent = this.queue.shift()
      if (!queuedEvent) break

      // Emit to listeners with error isolation
      this.emitToListeners(queuedEvent.event)

      // Yield to other microtasks
      await new Promise<void>((resolve) => queueMicrotask(resolve))
    }

    this.isProcessing = false

    // Check if more events were added while processing
    if (this.queue.length > 0 && !this.isProcessing) {
      this.isProcessing = true
      queueMicrotask(() => this.processQueue())
    }
  }

  /**
   * Emit event to listeners with error isolation
   */
  private emitToListeners(event: OrchestrationEvent): void {
    const listeners = this.listeners(event.type)

    for (const listener of listeners) {
      try {
        if (typeof listener === 'function') {
          listener(event)
        }
      } catch (error) {
        // Log error but continue processing
        this.logger?.error('Listener error', {
          eventType: event.type,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  /**
   * Clone event for queue isolation (hybrid approach)
   */
  private cloneEvent(event: OrchestrationEvent): OrchestrationEvent {
    // Shallow clone the event object
    const cloned = { ...event }

    // Preserve Error objects without cloning (maintain stack traces)
    // Type assertion is safe here as we're checking for 'error' property
    if ('error' in event) {
      const eventWithError = event as StepEvent | WorkflowEvent
      if ('error' in eventWithError && eventWithError.error instanceof Error) {
        (cloned as typeof eventWithError).error = eventWithError.error
      }
    }

    return cloned as OrchestrationEvent
  }

  /**
   * Handle queue overflow according to policy
   */
  private handleOverflow(): void {
    if (this.config.overflowPolicy === 'dropOldest') {
      // Remove oldest event
      const dropped = this.queue.shift()
      if (dropped) {
        this.droppedCount++
        this.lastDropTimestamp = Date.now()
        this.dropTimestamps.push(this.lastDropTimestamp)

        // Clean old timestamps (keep last 100 for rate calculation)
        if (this.dropTimestamps.length > 100) {
          this.dropTimestamps = this.dropTimestamps.slice(-100)
        }

        // Log warning (throttled to 1 per minute)
        if (this.config.warnOnDrop) {
          const now = Date.now()
          if (now - this.lastWarnTime > 60000) {
            this.logger?.warn('Event queue overflow - dropping oldest event', {
              droppedCount: this.droppedCount,
              queueSize: this.queue.length,
              eventType: dropped.event.type,
            })
            this.lastWarnTime = now
          }
        }
      }
    }
  }

  /**
   * Update high water mark
   */
  private updateHighWaterMark(): void {
    if (this.queue.length > this.highWaterMark) {
      this.highWaterMark = this.queue.length
    }
  }

  /**
   * Calculate drop rate (events per minute)
   */
  private calculateDropRate(): number {
    if (this.dropTimestamps.length === 0) return 0

    const now = Date.now()
    const oneMinuteAgo = now - 60000

    // Count drops in last minute
    const recentDrops = this.dropTimestamps.filter((ts) => ts > oneMinuteAgo)

    return recentDrops.length
  }
}
