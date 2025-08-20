import type { Logger } from '@orchestr8/logger'

/* global queueMicrotask */
import { EventEmitter } from 'node:events'

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
 * Circular buffer implementation for O(1) queue operations
 */
class CircularBuffer<T> {
  private readonly buffer: (T | undefined)[]
  private head = 0 // Index where next item will be dequeued
  private tail = 0 // Index where next item will be enqueued
  private size = 0
  private readonly capacity: number

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Capacity must be greater than 0')
    }
    this.capacity = capacity
    this.buffer = new Array(capacity)
  }

  enqueue(item: T): boolean {
    if (this.size === this.capacity) {
      return false // Queue is full
    }

    this.buffer[this.tail] = item
    this.tail = (this.tail + 1) % this.capacity
    this.size++
    return true
  }

  dequeue(): T | undefined {
    if (this.size === 0) {
      return undefined
    }

    const item = this.buffer[this.head]
    this.buffer[this.head] = undefined // Clear reference
    this.head = (this.head + 1) % this.capacity
    this.size--
    return item
  }

  dropOldest(): T | undefined {
    if (this.size === 0) {
      return undefined
    }

    const dropped = this.dequeue()
    return dropped
  }

  getSize(): number {
    return this.size
  }

  isFull(): boolean {
    return this.size === this.capacity
  }

  isEmpty(): boolean {
    return this.size === 0
  }

  clear(): void {
    this.buffer.fill(undefined)
    this.head = 0
    this.tail = 0
    this.size = 0
  }
}

/**
 * BoundedEventBus with queue management and overflow handling
 */
export class BoundedEventBus extends EventEmitter {
  private readonly config: Required<EventBusConfig>
  private readonly queue: CircularBuffer<QueuedEvent>
  private readonly logger?: Logger

  // Metrics tracking
  private droppedCount = 0
  private lastDropTimestamp: number | null = null
  private highWaterMark = 0
  private lastWarnTime = 0
  private dropTimestamps: number[] = []

  // Processing state
  private isProcessing = false

  // Memory tracking
  private memoryEstimate = 0
  private sampleCounter = 0

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

    // Initialize circular buffer with configured capacity
    this.queue = new CircularBuffer<QueuedEvent>(this.config.maxQueueSize)

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

    // Track memory if enabled
    if (this.config.enableMemoryTracking) {
      this.trackMemory(queuedEvent)
    }

    // Try to enqueue, handle overflow if queue is full
    if (!this.queue.enqueue(queuedEvent)) {
      this.handleOverflow()
      // After dropping oldest, enqueue the new event
      this.queue.enqueue(queuedEvent)
    }

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
      queueSize: this.queue.getSize(),
      dropRate: this.calculateDropRate(),
      listeners,
    }
  }

  /**
   * Process queued events
   */
  private async processQueue(): Promise<void> {
    while (!this.queue.isEmpty()) {
      const queuedEvent = this.queue.dequeue()
      if (!queuedEvent) break

      // Emit to listeners with error isolation
      this.emitToListeners(queuedEvent.event)

      // Yield to other microtasks
      await new Promise<void>((resolve) => queueMicrotask(resolve))
    }

    this.isProcessing = false

    // Check if more events were added while processing
    if (!this.queue.isEmpty() && !this.isProcessing) {
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
        ;(cloned as typeof eventWithError).error = eventWithError.error
      }
    }

    return cloned as OrchestrationEvent
  }

  /**
   * Handle queue overflow according to policy
   */
  private handleOverflow(): void {
    if (this.config.overflowPolicy === 'dropOldest') {
      // Remove oldest event using circular buffer's dropOldest
      const dropped = this.queue.dropOldest()
      if (dropped) {
        this.droppedCount++
        this.lastDropTimestamp = Date.now()
        this.dropTimestamps.push(this.lastDropTimestamp)

        // Clean old timestamps (keep last 100 for rate calculation)
        if (this.dropTimestamps.length > 100) {
          this.dropTimestamps = this.dropTimestamps.slice(-100)
        }

        // Log warning (throttled using configured metrics interval)
        if (this.config.warnOnDrop) {
          const now = Date.now()
          // Use metricsInterval for warning throttling (default 60000ms = 1 minute)
          if (now - this.lastWarnTime > this.config.metricsInterval) {
            this.logger?.warn('Event queue overflow - dropping oldest event', {
              droppedCount: this.droppedCount,
              queueSize: this.queue.getSize(),
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
    const currentSize = this.queue.getSize()
    if (currentSize > this.highWaterMark) {
      this.highWaterMark = currentSize
    }
  }

  /**
   * Calculate drop rate (events per configured interval, normalized to per minute)
   */
  private calculateDropRate(): number {
    if (this.dropTimestamps.length === 0) return 0

    const now = Date.now()
    const windowStart = now - this.config.metricsInterval

    // Count drops in the configured metrics interval
    const recentDrops = this.dropTimestamps.filter((ts) => ts > windowStart)

    // Calculate rate per minute (normalize to 60000ms regardless of interval)
    const ratePerMinute =
      (recentDrops.length * 60000) / this.config.metricsInterval
    return Math.round(ratePerMinute)
  }

  /**
   * Track memory usage using sampling heuristic
   */
  private trackMemory(event: QueuedEvent): void {
    if (!this.config.enableMemoryTracking) return

    // Sample 1 in 100 events
    this.sampleCounter++
    if (this.sampleCounter % 100 === 0) {
      try {
        // Estimate size of the event
        const eventSize = this.estimateEventSize(event)

        // Update running average
        this.memoryEstimate = this.memoryEstimate * 0.9 + eventSize * 0.1
      } catch {
        // Ignore errors in memory tracking
      }
    }
  }

  /**
   * Estimate the size of an event in bytes
   */
  private estimateEventSize(event: QueuedEvent): number {
    // Simple heuristic: count string lengths and object properties
    let size = 0

    const countSize = (obj: unknown, depth = 0): void => {
      if (depth > 5) return // Prevent deep recursion

      if (typeof obj === 'string') {
        size += obj.length * 2 // Approximate UTF-16 size
      } else if (typeof obj === 'number') {
        size += 8
      } else if (typeof obj === 'boolean') {
        size += 4
      } else if (obj && typeof obj === 'object') {
        if (obj instanceof Error) {
          // Don't traverse Error objects deeply
          size += 100 + (obj.message?.length ?? 0) * 2
        } else if (Array.isArray(obj)) {
          obj.forEach((item) => countSize(item, depth + 1))
        } else {
          for (const key in obj) {
            size += key.length * 2
            countSize((obj as Record<string, unknown>)[key], depth + 1)
          }
        }
      }
    }

    countSize(event)
    return size
  }
}
