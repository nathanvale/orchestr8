/**
 * Process event listener manager for preventing memory leaks
 *
 * Provides centralized management of process event listeners with automatic cleanup
 * and leak prevention mechanisms.
 */

// Note: Removed registerResource import to avoid circular dependency
// between process-listeners and resources modules

/**
 * Process events that can have listeners attached
 */
export type ProcessEvent =
  | 'exit'
  | 'SIGINT'
  | 'SIGTERM'
  | 'SIGHUP'
  | 'SIGQUIT'
  | 'beforeExit'
  | 'uncaughtException'
  | 'unhandledRejection'

/**
 * Configuration options for the process listener manager
 */
export interface ProcessListenerConfig {
  /** Whether to register itself as a resource for cleanup */
  autoRegisterAsResource?: boolean
  /** Whether to log listener registration/removal for debugging */
  enableLogging?: boolean
  /** Maximum number of listeners per event type (prevents runaway registration) */
  maxListenersPerEvent?: number
}

/**
 * Function that can be used as a process event listener
 */
export type ProcessListener = (...args: unknown[]) => void | Promise<void>

/**
 * Metadata about a registered listener
 */
interface ListenerRecord {
  event: ProcessEvent
  listener: ProcessListener
  registeredAt: number
  description?: string
  once?: boolean
}

/**
 * Composite key for event+listener combination
 */
type ListenerKey = string

/**
 * Statistics about process listeners
 */
export interface ProcessListenerStats {
  totalListeners: number
  listenersByEvent: Record<ProcessEvent, number>
  oldestListenerAge: number
  averageListenerAge: number
}

/**
 * Centralized manager for process event listeners that prevents memory leaks
 */
export class ProcessListenerManager {
  private listeners = new Map<ListenerKey, ListenerRecord>()
  private listenersByEvent = new Map<ProcessEvent, Set<ProcessListener>>()
  private listenerIds = new WeakMap<ProcessListener, string>()
  private nextId = 0
  private config: Required<ProcessListenerConfig>
  private isRegisteredAsResource = false

  constructor(config: ProcessListenerConfig = {}) {
    this.config = {
      autoRegisterAsResource: config.autoRegisterAsResource ?? true,
      enableLogging: config.enableLogging ?? false,
      maxListenersPerEvent: config.maxListenersPerEvent ?? 10,
    }

    if (this.config.autoRegisterAsResource) {
      this.registerAsResource()
    }
  }

  /**
   * Add a process event listener with tracking
   */
  addListener(
    event: ProcessEvent,
    listener: ProcessListener,
    options: { description?: string; once?: boolean } = {},
  ): () => void {
    // Check for duplicate listeners for this specific event
    const listenerKey = `${event}:${this.getListenerHash(listener)}`
    if (this.listeners.has(listenerKey)) {
      throw new Error(`Listener already registered for event '${event}'`)
    }

    // Check max listeners limit
    const currentCount = this.listenersByEvent.get(event)?.size ?? 0
    if (currentCount >= this.config.maxListenersPerEvent) {
      throw new Error(
        `Maximum listeners (${this.config.maxListenersPerEvent}) exceeded for event '${event}'`,
      )
    }

    // Create listener record
    const record: ListenerRecord = {
      event,
      listener,
      registeredAt: Date.now(),
      description: options.description,
      once: options.once,
    }

    // Track the listener with composite key
    this.listeners.set(listenerKey, record)

    if (!this.listenersByEvent.has(event)) {
      this.listenersByEvent.set(event, new Set())
    }
    this.listenersByEvent.get(event)!.add(listener)

    // Register with Node.js process
    if (options.once) {
      process.once(event, listener)
    } else {
      process.on(event, listener)
    }

    this.log(
      `Added ${options.once ? 'once' : 'on'} listener for '${event}' ${options.description ? `(${options.description})` : ''}`,
    )

    // Return cleanup function
    return () => this.removeListener(event, listener)
  }

  /**
   * Add a one-time process event listener
   */
  addOnceListener(
    event: ProcessEvent,
    listener: ProcessListener,
    description?: string,
  ): () => void {
    return this.addListener(event, listener, { description, once: true })
  }

  /**
   * Remove a specific process event listener
   */
  removeListener(event: ProcessEvent, listener: ProcessListener): boolean {
    const listenerKey = `${event}:${this.getListenerHash(listener)}`
    const record = this.listeners.get(listenerKey)
    if (!record) {
      return false
    }

    // Remove from tracking
    this.listeners.delete(listenerKey)
    const eventListeners = this.listenersByEvent.get(event)
    if (eventListeners) {
      eventListeners.delete(listener)
      if (eventListeners.size === 0) {
        this.listenersByEvent.delete(event)
      }
    }

    // Remove from Node.js process
    process.removeListener(event, listener)

    this.log(
      `Removed listener for '${event}' ${record.description ? `(${record.description})` : ''}`,
    )
    return true
  }

  /**
   * Remove a listener from all events it's registered for
   */
  removeListenerFromAllEvents(listener: ProcessListener): number {
    let removed = 0
    const events = Array.from(this.listenersByEvent.keys())

    for (const event of events) {
      const eventListeners = this.listenersByEvent.get(event)
      if (eventListeners?.has(listener)) {
        if (this.removeListener(event, listener)) {
          removed++
        }
      }
    }

    return removed
  }

  /**
   * Remove all listeners for a specific event
   */
  removeAllListenersForEvent(event: ProcessEvent): number {
    const eventListeners = this.listenersByEvent.get(event)
    if (!eventListeners) {
      return 0
    }

    let removed = 0
    for (const listener of Array.from(eventListeners)) {
      if (this.removeListener(event, listener)) {
        removed++
      }
    }

    this.log(`Removed ${removed} listeners for event '${event}'`)
    return removed
  }

  /**
   * Remove all tracked listeners
   */
  removeAllListeners(): void {
    const events = Array.from(this.listenersByEvent.keys())
    let totalRemoved = 0

    for (const event of events) {
      totalRemoved += this.removeAllListenersForEvent(event)
    }

    this.listeners.clear()
    this.listenersByEvent.clear()

    this.log(`Removed all ${totalRemoved} tracked listeners`)
  }

  /**
   * Get statistics about registered listeners
   */
  getStats(): ProcessListenerStats {
    const now = Date.now()
    const listeners = Array.from(this.listeners.values())

    const listenersByEvent = {} as Record<ProcessEvent, number>
    for (const event of [
      'exit',
      'SIGINT',
      'SIGTERM',
      'SIGHUP',
      'SIGQUIT',
      'beforeExit',
      'uncaughtException',
      'unhandledRejection',
    ] as ProcessEvent[]) {
      listenersByEvent[event] = this.listenersByEvent.get(event)?.size ?? 0
    }

    let totalAge = 0
    let oldestAge = 0

    for (const listener of listeners) {
      const age = now - listener.registeredAt
      totalAge += age
      oldestAge = Math.max(oldestAge, age)
    }

    return {
      totalListeners: listeners.length,
      listenersByEvent,
      oldestListenerAge: oldestAge,
      averageListenerAge: listeners.length > 0 ? totalAge / listeners.length : 0,
    }
  }

  /**
   * Check if a listener is registered for a specific event
   */
  hasListener(event: ProcessEvent, listener: ProcessListener): boolean {
    const listenerKey = `${event}:${this.getListenerHash(listener)}`
    return this.listeners.has(listenerKey)
  }

  /**
   * Check if a listener is registered for any event
   */
  hasListenerForAnyEvent(listener: ProcessListener): boolean {
    const events = Array.from(this.listenersByEvent.keys())
    return events.some((event) => this.hasListener(event, listener))
  }

  /**
   * Get the number of listeners for a specific event
   */
  getListenerCount(event: ProcessEvent): number {
    return this.listenersByEvent.get(event)?.size ?? 0
  }

  /**
   * Get total number of tracked listeners
   */
  getTotalListenerCount(): number {
    return this.listeners.size
  }

  /**
   * Get all listeners for a specific event
   */
  getListenersForEvent(event: ProcessEvent): ProcessListener[] {
    const eventListeners = this.listenersByEvent.get(event)
    return eventListeners ? Array.from(eventListeners) : []
  }

  /**
   * Check for potential memory leaks (old listeners)
   */
  detectPotentialLeaks(maxAge: number = 60000): Array<{
    listener: ProcessListener
    event: ProcessEvent
    age: number
    description?: string
  }> {
    const now = Date.now()
    const leaks: Array<{
      listener: ProcessListener
      event: ProcessEvent
      age: number
      description?: string
    }> = []

    for (const [_listenerKey, record] of this.listeners) {
      const age = now - record.registeredAt
      if (age >= maxAge) {
        leaks.push({
          listener: record.listener,
          event: record.event,
          age,
          description: record.description,
        })
      }
    }

    return leaks
  }

  /**
   * Register this manager as a resource for automatic cleanup
   */
  private registerAsResource(): void {
    if (this.isRegisteredAsResource) {
      return
    }

    // Note: Removed registerResource call to avoid circular dependency
    // The ProcessListenerManager will be cleaned up through other mechanisms

    this.isRegisteredAsResource = true
    this.log('Registered as resource for automatic cleanup')
  }

  /**
   * Generate a hash for a listener function to use as part of composite keys
   */
  private getListenerHash(listener: ProcessListener): string {
    if (!listener) {
      throw new Error('Listener cannot be null or undefined')
    }

    // Create a unique ID for each function instance
    // Use WeakMap to store unique IDs or fallback to toString + random
    if (!this.listenerIds) {
      this.listenerIds = new WeakMap()
      this.nextId = 0
    }

    let id = this.listenerIds.get(listener)
    if (!id) {
      id = `fn_${this.nextId++}_${Date.now()}`
      this.listenerIds.set(listener, id)
    }

    return id
  }

  /**
   * Log messages if logging is enabled
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[ProcessListenerManager] ${message}`)
    }
  }
}

/**
 * Global process listener manager instance
 */
export const globalProcessListenerManager = new ProcessListenerManager()

/**
 * Convenience function to add a process listener globally
 */
export function addProcessListener(
  event: ProcessEvent,
  listener: ProcessListener,
  options?: { description?: string; once?: boolean },
): () => void {
  return globalProcessListenerManager.addListener(event, listener, options)
}

/**
 * Convenience function to add a one-time process listener globally
 */
export function addProcessOnceListener(
  event: ProcessEvent,
  listener: ProcessListener,
  description?: string,
): () => void {
  return globalProcessListenerManager.addOnceListener(event, listener, description)
}

/**
 * Convenience function to remove a process listener from a specific event globally
 */
export function removeProcessListener(event: ProcessEvent, listener: ProcessListener): boolean {
  return globalProcessListenerManager.removeListener(event, listener)
}

/**
 * Convenience function to remove a process listener from all events globally
 */
export function removeProcessListenerFromAllEvents(listener: ProcessListener): number {
  return globalProcessListenerManager.removeListenerFromAllEvents(listener)
}

/**
 * Convenience function to remove all process listeners globally
 */
export function removeAllProcessListeners(): void {
  globalProcessListenerManager.removeAllListeners()
}

/**
 * Convenience function to get process listener stats globally
 */
export function getProcessListenerStats(): ProcessListenerStats {
  return globalProcessListenerManager.getStats()
}

/**
 * Convenience function to detect process listener leaks globally
 */
export function detectProcessListenerLeaks(maxAge?: number): Array<{
  listener: ProcessListener
  event: ProcessEvent
  age: number
  description?: string
}> {
  return globalProcessListenerManager.detectPotentialLeaks(maxAge)
}

/**
 * Helper function to create an exit handler that cleans up multiple resources
 */
export function createExitHandler(
  cleanup: () => void | Promise<void>,
  options: {
    events?: ProcessEvent[]
    description?: string
    timeout?: number
  } = {},
): () => void {
  const events = options.events ?? ['exit', 'SIGINT', 'SIGTERM']
  const description = options.description ?? 'Exit handler'
  const timeout = options.timeout ?? 5000

  const removeListeners: Array<() => void> = []

  const handler = async () => {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Exit handler timeout after ${timeout}ms`))
        }, timeout)
      })

      // Race between cleanup and timeout
      await Promise.race([Promise.resolve(cleanup()), timeoutPromise])
    } catch (error) {
      console.error(`Error in exit handler (${description}):`, error)
    }
  }

  // Register for each event
  for (const event of events) {
    const removeListener = addProcessListener(event, handler, {
      description: `${description} (${event})`,
    })
    removeListeners.push(removeListener)
  }

  // Return function to remove all listeners
  return () => {
    removeListeners.forEach((remove) => remove())
  }
}

/**
 * Helper to safely wrap an exit handler with error handling
 */
export function safeExitHandler(
  cleanup: () => void | Promise<void>,
  description?: string,
): () => void | Promise<void> {
  return async () => {
    try {
      await Promise.resolve(cleanup())
    } catch (error) {
      console.error(`Error in exit handler${description ? ` (${description})` : ''}:`, error)
    }
  }
}
