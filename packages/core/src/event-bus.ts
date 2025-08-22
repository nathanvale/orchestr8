import type { Logger } from '@orchestr8/logger'

/* global queueMicrotask */
import { EventEmitter } from 'node:events'
import { performance } from 'node:perf_hooks'

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
  /** Enable backpressure handling to slow down producers. Default: false */
  enableBackpressure?: boolean
  /** Queue utilization threshold to trigger backpressure (0.0-1.0). Default: 0.8 */
  backpressureThreshold?: number
  /** Maximum delay in ms to apply during backpressure. Default: 100 */
  maxBackpressureDelayMs?: number
  /** Maximum events to process per batch. Default: 10 */
  maxBatchSize?: number
  /** Maximum time to spend processing per cycle (ms). Default: 5 */
  maxProcessingTimeMs?: number
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
  /** Current backpressure status */
  backpressure: {
    /** Whether backpressure is currently active */
    isActive: boolean
    /** Current utilization ratio (0.0-1.0) */
    utilization: number
    /** Current backpressure delay in ms */
    currentDelayMs: number
    /** Number of times backpressure was triggered */
    triggerCount: number
  }
  /** Processing performance metrics */
  processing: {
    /** Average events processed per batch */
    avgBatchSize: number
    /** Average processing time per batch in ms */
    avgProcessingTimeMs: number
    /** Total processing cycles completed */
    totalCycles: number
    /** Processing lag - time from emission to processing (ms) */
    avgLagMs: number
  }
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

  // Backpressure tracking
  private backpressureActive = false
  private currentBackpressureDelay = 0
  private backpressureTriggerCount = 0

  // Processing metrics
  private processingCycles = 0
  private totalBatchSizes = 0
  private totalProcessingTime = 0
  private processingStartTimes: number[] = []

  constructor(config: EventBusConfig = {}, logger?: Logger) {
    super()

    // Validate configuration
    if (config.maxQueueSize !== undefined && config.maxQueueSize <= 0) {
      throw new Error('maxQueueSize must be greater than 0')
    }
    if (
      config.backpressureThreshold !== undefined &&
      (config.backpressureThreshold < 0 || config.backpressureThreshold > 1)
    ) {
      throw new Error('backpressureThreshold must be between 0.0 and 1.0')
    }

    // Set defaults
    this.config = {
      maxQueueSize: config.maxQueueSize ?? 1000,
      overflowPolicy: config.overflowPolicy ?? 'dropOldest',
      warnOnDrop: config.warnOnDrop ?? true,
      metricsInterval: config.metricsInterval ?? 60000,
      maxListenersPerEvent: config.maxListenersPerEvent ?? 100,
      enableMemoryTracking: config.enableMemoryTracking ?? false,
      enableBackpressure: config.enableBackpressure ?? false,
      backpressureThreshold: config.backpressureThreshold ?? 0.8,
      maxBackpressureDelayMs: config.maxBackpressureDelayMs ?? 100,
      maxBatchSize: config.maxBatchSize ?? 10,
      maxProcessingTimeMs: config.maxProcessingTimeMs ?? 5,
    }

    this.logger = logger

    // Initialize circular buffer with configured capacity
    this.queue = new CircularBuffer<QueuedEvent>(this.config.maxQueueSize)

    // Set max listeners per event type
    this.setMaxListeners(this.config.maxListenersPerEvent)
  }

  /**
   * Emit an event synchronously (for compatibility) or asynchronously with backpressure
   */
  emitEvent(event: OrchestrationEvent): boolean {
    // For backpressure-enabled event buses, use async version
    if (this.config.enableBackpressure) {
      // Use async version but don't block callers
      this.emitEventAsync(event).catch((error) => {
        this.logger?.error('Async event emission failed', { error })
      })
      return true
    }

    // Synchronous path for backward compatibility
    return this.emitEventSync(event)
  }

  /**
   * Emit an event asynchronously with backpressure handling
   */
  async emitEventAsync(event: OrchestrationEvent): Promise<boolean> {
    // Add to queue first, then apply backpressure based on actual queue state
    const result = this.emitEventSync(event)

    // Apply backpressure after queuing to check actual utilization
    if (this.config.enableBackpressure) {
      await this.applyBackpressure()
    }

    return result
  }

  /**
   * Emit an event synchronously (internal method)
   */
  private emitEventSync(event: OrchestrationEvent): boolean {
    // Add to queue with timestamp
    const queuedEvent: QueuedEvent = {
      event: this.cloneEvent(event),
      timestamp: performance.now(),
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
   * Apply backpressure by delaying the producer when queue utilization is high
   */
  private async applyBackpressure(): Promise<void> {
    // Check current queue size (event is already in the queue)
    const currentQueueSize = this.queue.getSize()
    const utilization = currentQueueSize / this.config.maxQueueSize

    if (utilization >= this.config.backpressureThreshold) {
      // Calculate delay based on utilization above threshold
      const excessUtilization = utilization - this.config.backpressureThreshold
      const normalizedExcess =
        excessUtilization / (1.0 - this.config.backpressureThreshold)

      // Exponential backoff: delay increases exponentially with utilization
      const baseDelay = this.config.maxBackpressureDelayMs * normalizedExcess
      const exponentialFactor = Math.pow(2, normalizedExcess * 3) // 0-8x multiplier
      this.currentBackpressureDelay = Math.min(
        baseDelay * exponentialFactor,
        this.config.maxBackpressureDelayMs,
      )

      if (!this.backpressureActive) {
        this.backpressureActive = true
        this.backpressureTriggerCount++

        this.logger?.debug('Backpressure activated', {
          utilization: utilization.toFixed(3),
          delayMs: this.currentBackpressureDelay.toFixed(1),
          queueSize: this.queue.getSize(),
        })
      }

      // Apply the delay to slow down the producer
      if (this.currentBackpressureDelay > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.currentBackpressureDelay),
        )
      }
    } else {
      // Release backpressure
      if (this.backpressureActive) {
        this.backpressureActive = false
        this.currentBackpressureDelay = 0

        this.logger?.debug('Backpressure released', {
          utilization: utilization.toFixed(3),
        })
      }
    }
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

    // Calculate processing metrics
    const avgBatchSize =
      this.processingCycles > 0
        ? this.totalBatchSizes / this.processingCycles
        : 0
    const avgProcessingTimeMs =
      this.processingCycles > 0
        ? this.totalProcessingTime / this.processingCycles
        : 0
    const avgLagMs =
      this.processingStartTimes.length > 0
        ? this.processingStartTimes.reduce((sum, lag) => sum + lag, 0) /
          this.processingStartTimes.length
        : 0

    return {
      droppedCount: this.droppedCount,
      lastDropTimestamp: this.lastDropTimestamp,
      highWaterMark: this.highWaterMark,
      queueSize: this.queue.getSize(),
      dropRate: this.calculateDropRate(),
      listeners,
      backpressure: {
        isActive: this.backpressureActive,
        utilization: this.queue.getSize() / this.config.maxQueueSize,
        currentDelayMs: this.currentBackpressureDelay,
        triggerCount: this.backpressureTriggerCount,
      },
      processing: {
        avgBatchSize,
        avgProcessingTimeMs,
        totalCycles: this.processingCycles,
        avgLagMs,
      },
    }
  }

  /**
   * Process queued events with batching and time-bounded processing
   */
  private async processQueue(): Promise<void> {
    const cycleStartTime = performance.now()
    const batchEvents: QueuedEvent[] = []

    // Collect events with smaller batches for time-constrained processing
    while (
      !this.queue.isEmpty() &&
      batchEvents.length < this.config.maxBatchSize
    ) {
      const queuedEvent = this.queue.dequeue()
      if (!queuedEvent) break

      batchEvents.push(queuedEvent)

      // For very short time limits, process smaller batches
      if (this.config.maxProcessingTimeMs <= 5 && batchEvents.length >= 10) {
        // Only log occasionally to reduce noise during tests
        if (process.env.NODE_ENV === 'test' && Math.random() < 0.01) {
          console.log(
            `[BATCH_LIMIT] Breaking at ${batchEvents.length} events due to time limit ${this.config.maxProcessingTimeMs}ms`,
          )
        }
        break // Force smaller batches when time limit is very tight
      }
    }

    // Process the batch
    if (batchEvents.length > 0) {
      await this.processBatch(batchEvents, cycleStartTime)
    }

    this.isProcessing = false

    // Check if more events were added while processing
    if (!this.queue.isEmpty() && !this.isProcessing) {
      this.isProcessing = true
      queueMicrotask(() => this.processQueue())
    }
  }

  /**
   * Process a batch of events with timing metrics
   */
  private async processBatch(
    events: QueuedEvent[],
    cycleStartTime: number,
  ): Promise<void> {
    // Emit all events to listeners with error isolation
    for (const queuedEvent of events) {
      this.emitToListeners(queuedEvent.event)
    }

    await this.updateProcessingMetrics(events, cycleStartTime)
  }

  /**
   * Update processing metrics for a batch of events
   */
  private async updateProcessingMetrics(
    events: QueuedEvent[],
    cycleStartTime: number,
  ): Promise<void> {
    const processingStartTimestamp = performance.now()

    // Track processing lag for each event
    for (const queuedEvent of events) {
      // Track processing lag (time from event creation to processing start)
      const lagMs = processingStartTimestamp - queuedEvent.timestamp
      this.processingStartTimes.push(Math.max(0, lagMs)) // Ensure non-negative

      // Keep only recent lag measurements for averaging
      if (this.processingStartTimes.length > 100) {
        this.processingStartTimes = this.processingStartTimes.slice(-100)
      }
    }

    // Update processing metrics
    const processingTimeMs = performance.now() - cycleStartTime
    this.processingCycles++
    this.totalBatchSizes += events.length
    this.totalProcessingTime += processingTimeMs

    // Yield to other microtasks after batch processing
    await new Promise<void>((resolve) => queueMicrotask(resolve))
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
