# Streaming Specification

This document defines fine-grained tool streaming support for Claude subagents integration.

> Created: 2025-01-19
> Version: 1.0.0

## Overview

Fine-grained tool streaming enables real-time progress updates and partial JSON assembly for long-running orchestr8 workflows. This specification addresses client-side validation, error recovery, and WebSocket/SSE integration.

## Streaming Architecture

### Beta Configuration

```typescript
export const STREAMING_CONFIG = {
  // Beta header for fine-grained streaming
  headers: {
    'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14',
  },

  // Streaming-specific settings
  settings: {
    validatePartialJson: true, // Client-side validation
    assembleInputDeltas: true, // Reconstruct JSON from deltas
    bufferSize: 1024 * 64, // 64KB buffer for partial data
    flushInterval: 100, // Flush buffer every 100ms
    reconnectAttempts: 3, // WebSocket reconnection attempts
  },
}
```

## Partial JSON Assembly

### StreamingJsonAssembler

```typescript
export class StreamingJsonAssembler {
  private accumulated: string = ''
  private bracketStack: string[] = []
  private lastValidJson: any = null
  private errorCount: number = 0

  addDelta(delta: InputJsonDelta): void {
    if (delta.type !== 'input_json_delta') {
      throw new Error(`Unexpected delta type: ${delta.type}`)
    }

    this.accumulated += delta.partial_json
    this.updateBracketStack(delta.partial_json)

    // Try to parse if brackets are balanced
    if (this.isComplete()) {
      try {
        this.lastValidJson = JSON.parse(this.accumulated)
        this.errorCount = 0
      } catch (error) {
        this.errorCount++
        // Keep accumulating, might be incomplete
      }
    }
  }

  private updateBracketStack(text: string): void {
    const brackets: Record<string, string> = {
      '{': '}',
      '[': ']',
    }

    const closingBrackets: Record<string, string> = {
      '}': '{',
      ']': '[',
    }

    for (const char of text) {
      if (brackets[char]) {
        this.bracketStack.push(char)
      } else if (closingBrackets[char]) {
        const expected = closingBrackets[char]
        if (this.bracketStack[this.bracketStack.length - 1] === expected) {
          this.bracketStack.pop()
        } else {
          // Mismatched bracket - mark as error
          this.errorCount++
        }
      }
    }
  }

  isComplete(): boolean {
    return this.bracketStack.length === 0 && this.accumulated.length > 0
  }

  getJson(): unknown {
    // Return last valid JSON if available
    if (this.lastValidJson !== null) {
      return this.lastValidJson
    }

    // Attempt to repair if incomplete
    if (!this.isComplete()) {
      return this.repairJson(this.accumulated)
    }

    try {
      return JSON.parse(this.accumulated)
    } catch (error) {
      return this.repairJson(this.accumulated)
    }
  }

  private repairJson(partial: string): unknown {
    // Smart repair based on context
    let repaired = partial

    // Add missing closing brackets
    const closingBrackets = this.bracketStack
      .reverse()
      .map((b) => (b === '{' ? '}' : ']'))
      .join('')

    repaired += closingBrackets

    // Try to add missing quotes for incomplete strings
    const quoteCount = (repaired.match(/"/g) || []).length
    if (quoteCount % 2 !== 0) {
      repaired += '"'
    }

    try {
      return JSON.parse(repaired)
    } catch {
      // Return partial data with metadata
      return {
        __partial: true,
        __data: partial,
        __canRecover: this.errorCount < 3,
        __bracketDepth: this.bracketStack.length,
      }
    }
  }

  reset(): void {
    this.accumulated = ''
    this.bracketStack = []
    this.lastValidJson = null
    this.errorCount = 0
  }

  getStats(): AssemblerStats {
    return {
      accumulatedSize: this.accumulated.length,
      bracketDepth: this.bracketStack.length,
      isValid: this.lastValidJson !== null,
      errorCount: this.errorCount,
      completeness: this.isComplete(),
    }
  }
}
```

## WebSocket Integration

### Real-time Streaming Client

```typescript
export class WebSocketStreamingClient {
  private ws: WebSocket | null = null
  private assemblers: Map<string, StreamingJsonAssembler> = new Map()
  private reconnectAttempts: number = 0

  constructor(
    private url: string,
    private options: StreamingOptions = {},
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        resolve()
      }

      this.ws.onerror = (error) => {
        if (this.reconnectAttempts < 3) {
          this.reconnect()
        } else {
          reject(error)
        }
      }

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data))
      }

      this.ws.onclose = () => {
        if (this.options.autoReconnect) {
          this.reconnect()
        }
      }
    })
  }

  private async reconnect(): Promise<void> {
    this.reconnectAttempts++
    const delay = Math.pow(2, this.reconnectAttempts) * 1000

    await new Promise((resolve) => setTimeout(resolve, delay))
    return this.connect()
  }

  private handleMessage(message: StreamingMessage): void {
    switch (message.type) {
      case 'input_json_delta':
        this.handleInputDelta(message)
        break

      case 'tool_use_start':
        this.handleToolStart(message)
        break

      case 'tool_use_complete':
        this.handleToolComplete(message)
        break

      case 'error':
        this.handleError(message)
        break
    }
  }

  private handleInputDelta(message: InputJsonDelta): void {
    const assembler = this.getOrCreateAssembler(message.tool_use_id)
    assembler.addDelta(message)

    // Emit progress event
    this.emit('progress', {
      toolUseId: message.tool_use_id,
      partial: assembler.getJson(),
      stats: assembler.getStats(),
    })
  }

  private handleToolStart(message: ToolUseStart): void {
    this.assemblers.set(message.tool_use_id, new StreamingJsonAssembler())

    this.emit('toolStart', {
      toolUseId: message.tool_use_id,
      toolName: message.name,
      timestamp: Date.now(),
    })
  }

  private handleToolComplete(message: ToolUseComplete): void {
    const assembler = this.assemblers.get(message.tool_use_id)

    if (assembler) {
      const finalJson = assembler.getJson()

      this.emit('toolComplete', {
        toolUseId: message.tool_use_id,
        result: finalJson,
        duration: message.duration_ms,
      })

      // Clean up assembler
      this.assemblers.delete(message.tool_use_id)
    }
  }

  private handleError(message: StreamingError): void {
    const assembler = this.assemblers.get(message.tool_use_id)

    if (assembler) {
      // Try to recover partial data
      const partial = assembler.getJson()

      this.emit('error', {
        toolUseId: message.tool_use_id,
        error: message.error,
        partial,
        recoverable: message.recoverable,
      })
    }
  }

  private getOrCreateAssembler(toolUseId: string): StreamingJsonAssembler {
    if (!this.assemblers.has(toolUseId)) {
      this.assemblers.set(toolUseId, new StreamingJsonAssembler())
    }
    return this.assemblers.get(toolUseId)!
  }

  // Event emitter implementation
  private listeners: Map<string, Set<Function>> = new Map()

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach((cb) => cb(data))
    }
  }

  async streamToolExecution(
    toolCall: ToolCall,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<ToolResult> {
    return new Promise((resolve, reject) => {
      const toolUseId = toolCall.id

      // Set up progress handler
      if (onProgress) {
        this.on('progress', (event) => {
          if (event.toolUseId === toolUseId) {
            onProgress(event)
          }
        })
      }

      // Set up completion handler
      this.once(`complete:${toolUseId}`, (result) => {
        resolve(result)
      })

      // Set up error handler
      this.once(`error:${toolUseId}`, (error) => {
        reject(error)
      })

      // Send tool call
      this.ws?.send(
        JSON.stringify({
          type: 'tool_call',
          ...toolCall,
        }),
      )
    })
  }

  private once(event: string, callback: Function): void {
    const wrapper = (...args: any[]) => {
      callback(...args)
      this.off(event, wrapper)
    }
    this.on(event, wrapper)
  }

  private off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback)
  }
}
```

## Server-Sent Events (SSE) Integration

### SSE Streaming Adapter

```typescript
export class SSEStreamingAdapter {
  private eventSource: EventSource | null = null
  private assemblers: Map<string, StreamingJsonAssembler> = new Map()

  constructor(
    private url: string,
    private options: SSEOptions = {},
  ) {}

  connect(): void {
    this.eventSource = new EventSource(this.url, {
      withCredentials: this.options.withCredentials ?? false,
    })

    this.eventSource.onopen = () => {
      console.log('SSE connection established')
    }

    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error)

      if (this.options.onError) {
        this.options.onError(error)
      }

      // EventSource will auto-reconnect
    }

    // Register event handlers
    this.eventSource.addEventListener('input_json_delta', (event) => {
      this.handleInputDelta(JSON.parse(event.data))
    })

    this.eventSource.addEventListener('tool_complete', (event) => {
      this.handleToolComplete(JSON.parse(event.data))
    })

    this.eventSource.addEventListener('error', (event) => {
      this.handleStreamError(JSON.parse(event.data))
    })
  }

  private handleInputDelta(delta: InputJsonDelta): void {
    const assembler = this.getOrCreateAssembler(delta.tool_use_id)

    try {
      assembler.addDelta(delta)

      // Emit progress
      if (this.options.onProgress) {
        this.options.onProgress({
          toolUseId: delta.tool_use_id,
          partial: assembler.getJson(),
          complete: assembler.isComplete(),
        })
      }
    } catch (error) {
      console.error('Failed to process delta:', error)

      // Try to recover
      if (assembler.getStats().errorCount < 3) {
        // Continue accumulating
      } else {
        // Too many errors, reset
        assembler.reset()
      }
    }
  }

  private handleToolComplete(message: ToolCompleteMessage): void {
    const assembler = this.assemblers.get(message.tool_use_id)

    if (assembler) {
      const result = assembler.getJson()

      if (this.options.onComplete) {
        this.options.onComplete({
          toolUseId: message.tool_use_id,
          result,
          duration: message.duration_ms,
        })
      }

      // Clean up
      this.assemblers.delete(message.tool_use_id)
    }
  }

  private handleStreamError(error: StreamError): void {
    if (this.options.onError) {
      this.options.onError(new Error(error.message))
    }

    // Try to recover partial data
    const assembler = this.assemblers.get(error.tool_use_id)
    if (assembler) {
      const partial = assembler.getJson()

      if (partial && !partial.__partial) {
        // We have valid partial data
        if (this.options.onPartialResult) {
          this.options.onPartialResult({
            toolUseId: error.tool_use_id,
            partial,
            error: error.message,
          })
        }
      }
    }
  }

  private getOrCreateAssembler(toolUseId: string): StreamingJsonAssembler {
    if (!this.assemblers.has(toolUseId)) {
      this.assemblers.set(toolUseId, new StreamingJsonAssembler())
    }
    return this.assemblers.get(toolUseId)!
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.assemblers.clear()
  }
}
```

## Client-Side Validation

### Streaming Validator

```typescript
export class StreamingValidator {
  constructor(private schema?: z.ZodSchema) {}

  validatePartial(data: unknown): ValidationResult {
    // Check if data is marked as partial
    if (this.isPartialData(data)) {
      return {
        valid: false,
        partial: true,
        errors: [],
        canContinue: data.__canRecover,
      }
    }

    // No schema, just check structure
    if (!this.schema) {
      return {
        valid: this.isValidJson(data),
        partial: false,
        errors: [],
      }
    }

    // Validate against schema
    try {
      this.schema.parse(data)
      return {
        valid: true,
        partial: false,
        errors: [],
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Check if errors are due to missing required fields
        const missingRequired = this.getMissingRequired(error)

        return {
          valid: false,
          partial: missingRequired.length > 0,
          errors: error.errors,
          missingFields: missingRequired,
          canContinue: missingRequired.length > 0,
        }
      }

      return {
        valid: false,
        partial: false,
        errors: [{ message: error.message }],
      }
    }
  }

  private isPartialData(data: any): data is PartialData {
    return data && typeof data === 'object' && data.__partial === true
  }

  private isValidJson(data: unknown): boolean {
    try {
      JSON.stringify(data)
      return true
    } catch {
      return false
    }
  }

  private getMissingRequired(error: z.ZodError): string[] {
    return error.errors
      .filter((e) => e.code === 'invalid_type' && e.received === 'undefined')
      .map((e) => e.path.join('.'))
  }
}

interface ValidationResult {
  valid: boolean
  partial: boolean
  errors: any[]
  missingFields?: string[]
  canContinue?: boolean
}

interface PartialData {
  __partial: true
  __data: string
  __canRecover: boolean
  __bracketDepth: number
}
```

## Error Recovery

### Streaming Error Handler

```typescript
export class StreamingErrorHandler {
  private retryBuffers: Map<string, string[]> = new Map()

  handleStreamingError(
    error: StreamingError,
    context: StreamingContext,
  ): RecoveryAction {
    switch (error.type) {
      case 'malformed_json':
        return this.handleMalformedJson(error, context)

      case 'connection_lost':
        return this.handleConnectionLost(error, context)

      case 'buffer_overflow':
        return this.handleBufferOverflow(error, context)

      case 'validation_failed':
        return this.handleValidationFailure(error, context)

      default:
        return { action: 'abort', reason: 'Unknown error type' }
    }
  }

  private handleMalformedJson(
    error: StreamingError,
    context: StreamingContext,
  ): RecoveryAction {
    const assembler = context.assembler
    const stats = assembler.getStats()

    if (stats.errorCount < 3) {
      // Try to recover by waiting for more data
      return {
        action: 'continue',
        strategy: 'accumulate',
        maxAdditionalBytes: 1024,
      }
    }

    // Try to extract partial data
    const partial = assembler.getJson()
    if (partial && !partial.__partial) {
      return {
        action: 'use_partial',
        data: partial,
        warning: 'Using incomplete but valid JSON',
      }
    }

    return {
      action: 'reset',
      savePartial: true,
    }
  }

  private handleConnectionLost(
    error: StreamingError,
    context: StreamingContext,
  ): RecoveryAction {
    // Save current state
    const toolUseId = context.toolUseId
    const currentData = context.assembler.getJson()

    this.retryBuffers.set(toolUseId, [JSON.stringify(currentData)])

    return {
      action: 'reconnect',
      resumeFrom: toolUseId,
      timeout: 5000,
    }
  }

  private handleBufferOverflow(
    error: StreamingError,
    context: StreamingContext,
  ): RecoveryAction {
    // Flush and continue with new buffer
    return {
      action: 'flush',
      saveData: true,
      continueStreaming: true,
    }
  }

  private handleValidationFailure(
    error: StreamingError,
    context: StreamingContext,
  ): RecoveryAction {
    const validationResult = context.validationResult

    if (validationResult?.partial && validationResult.canContinue) {
      // Missing required fields, wait for more data
      return {
        action: 'continue',
        expectedFields: validationResult.missingFields,
      }
    }

    // Validation truly failed
    return {
      action: 'abort',
      errors: validationResult?.errors,
      partialData: context.assembler.getJson(),
    }
  }
}

interface RecoveryAction {
  action: 'continue' | 'abort' | 'reset' | 'reconnect' | 'use_partial' | 'flush'
  [key: string]: any
}
```

## Usage Examples

### Basic Streaming Setup

```typescript
// Initialize streaming client
const streamingClient = new WebSocketStreamingClient(
  'wss://orchestr8.io/stream',
  {
    autoReconnect: true,
    bufferSize: 64 * 1024,
  },
)

// Connect and set up handlers
await streamingClient.connect()

streamingClient.on('progress', (event) => {
  console.log(
    `Tool ${event.toolUseId}: ${event.stats.completeness * 100}% complete`,
  )

  // Update UI with partial results
  if (event.partial && !event.partial.__partial) {
    updateUI(event.partial)
  }
})

streamingClient.on('toolComplete', (event) => {
  console.log(`Tool ${event.toolUseId} completed in ${event.duration}ms`)
  finalizeUI(event.result)
})

streamingClient.on('error', (event) => {
  console.error(`Tool ${event.toolUseId} error:`, event.error)

  if (event.partial) {
    // Use partial results
    updateUIWithPartial(event.partial)
  }
})

// Execute tool with streaming
const result = await streamingClient.streamToolExecution(
  {
    id: 'tool_123',
    name: 'run_workflow',
    input: { workflowId: 'data-processing' },
  },
  (progress) => {
    // Real-time progress updates
    console.log('Progress:', progress)
  },
)
```

### SSE Integration Example

```typescript
// Set up SSE streaming
const sseAdapter = new SSEStreamingAdapter('/api/stream', {
  withCredentials: true,
  onProgress: (event) => {
    // Handle progress
    updateProgressBar(event.complete ? 100 : 50)
  },
  onComplete: (event) => {
    // Handle completion
    displayResults(event.result)
  },
  onPartialResult: (event) => {
    // Handle partial results on error
    displayPartialResults(event.partial)
  },
  onError: (error) => {
    // Handle errors
    console.error('SSE Error:', error)
  },
})

// Start streaming
sseAdapter.connect()

// Clean up when done
window.addEventListener('beforeunload', () => {
  sseAdapter.disconnect()
})
```

## Performance Optimization

### Buffer Management

```typescript
export class StreamBuffer {
  private buffer: string = ''
  private maxSize: number
  private flushCallback: (data: string) => void

  constructor(maxSize: number, flushCallback: (data: string) => void) {
    this.maxSize = maxSize
    this.flushCallback = flushCallback
  }

  append(data: string): void {
    this.buffer += data

    if (this.buffer.length >= this.maxSize) {
      this.flush()
    }
  }

  flush(): void {
    if (this.buffer.length > 0) {
      this.flushCallback(this.buffer)
      this.buffer = ''
    }
  }

  getSize(): number {
    return this.buffer.length
  }
}
```

### Connection Pooling

```typescript
export class StreamingConnectionPool {
  private connections: Map<string, WebSocket> = new Map()
  private maxConnections: number = 5

  async getConnection(url: string): Promise<WebSocket> {
    // Reuse existing connection if available
    if (this.connections.has(url)) {
      const ws = this.connections.get(url)!
      if (ws.readyState === WebSocket.OPEN) {
        return ws
      }
    }

    // Create new connection
    if (this.connections.size >= this.maxConnections) {
      // Close least recently used
      this.closeLRU()
    }

    const ws = new WebSocket(url)
    await this.waitForOpen(ws)

    this.connections.set(url, ws)
    return ws
  }

  private waitForOpen(ws: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = (err) => reject(err)
    })
  }

  private closeLRU(): void {
    // Implementation of LRU eviction
    const oldest = this.connections.entries().next().value
    if (oldest) {
      const [url, ws] = oldest
      ws.close()
      this.connections.delete(url)
    }
  }
}
```

## Testing Patterns

### Streaming Tests

```typescript
describe('StreamingJsonAssembler', () => {
  it('should handle partial JSON correctly', () => {
    const assembler = new StreamingJsonAssembler()

    assembler.addDelta({
      type: 'input_json_delta',
      partial_json: '{"status":"run',
    })

    expect(assembler.isComplete()).toBe(false)

    assembler.addDelta({
      type: 'input_json_delta',
      partial_json: 'ning","id":"123"}',
    })

    expect(assembler.isComplete()).toBe(true)
    expect(assembler.getJson()).toEqual({
      status: 'running',
      id: '123',
    })
  })

  it('should repair incomplete JSON', () => {
    const assembler = new StreamingJsonAssembler()

    assembler.addDelta({
      type: 'input_json_delta',
      partial_json: '{"data":{"value":42',
    })

    const repaired = assembler.getJson()
    expect(repaired.__partial).toBe(true)
    expect(repaired.__canRecover).toBe(true)
  })
})
```

## References

- [Fine-grained Tool Streaming](https://docs.anthropic.com/en/api/streaming)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [JSON Streaming](https://jsonlines.org/)
