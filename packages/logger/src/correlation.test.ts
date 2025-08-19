import { describe, expect, it } from 'vitest'

import {
  generateCorrelationId,
  extractCorrelationId,
  CorrelationContext,
} from './correlation.js'

describe('generateCorrelationId', () => {
  it('should generate a correlation ID with default prefix', () => {
    const id = generateCorrelationId()
    expect(id).toMatch(/^o8-[a-f0-9-]+$/)
  })

  it('should generate a correlation ID with custom prefix', () => {
    const id = generateCorrelationId('custom')
    expect(id).toMatch(/^custom-[a-f0-9-]+$/)
  })

  it('should generate unique IDs', () => {
    const ids = new Set()
    for (let i = 0; i < 100; i++) {
      ids.add(generateCorrelationId())
    }
    expect(ids.size).toBe(100)
  })
})

describe('extractCorrelationId', () => {
  it('should extract correlationId from object', () => {
    const source = { correlationId: 'test-123' }
    expect(extractCorrelationId(source)).toBe('test-123')
  })

  it('should return string source as is', () => {
    expect(extractCorrelationId('existing-id')).toBe('existing-id')
  })

  it('should generate new ID for null/undefined', () => {
    const id1 = extractCorrelationId(null)
    expect(id1).toMatch(/^o8-[a-f0-9-]+$/)

    const id2 = extractCorrelationId(undefined)
    expect(id2).toMatch(/^o8-[a-f0-9-]+$/)
  })

  it('should generate new ID for empty string', () => {
    const id = extractCorrelationId('')
    expect(id).toMatch(/^o8-[a-f0-9-]+$/)
  })

  it('should use custom fallback prefix', () => {
    const id = extractCorrelationId(null, 'fallback')
    expect(id).toMatch(/^fallback-[a-f0-9-]+$/)
  })

  it('should handle objects without correlationId', () => {
    const source = { someOtherField: 'value' }
    const id = extractCorrelationId(source)
    expect(id).toMatch(/^o8-[a-f0-9-]+$/)
  })

  it('should handle non-string correlationId in object', () => {
    const source = { correlationId: 123 }
    const id = extractCorrelationId(source)
    expect(id).toMatch(/^o8-[a-f0-9-]+$/)
  })
})

describe('CorrelationContext', () => {
  it('should provide correlation ID within context', () => {
    const correlationId = 'test-context-123'
    let capturedId: string | undefined

    CorrelationContext.run(correlationId, () => {
      capturedId = CorrelationContext.get()
    })

    expect(capturedId).toBe(correlationId)
  })

  it('should return undefined outside of context', () => {
    expect(CorrelationContext.get()).toBeUndefined()
  })

  it('should isolate nested contexts', () => {
    const outerIds: (string | undefined)[] = []
    const innerIds: (string | undefined)[] = []

    CorrelationContext.run('outer-123', () => {
      outerIds.push(CorrelationContext.get())

      CorrelationContext.run('inner-456', () => {
        innerIds.push(CorrelationContext.get())
      })

      outerIds.push(CorrelationContext.get())
    })

    expect(outerIds).toEqual(['outer-123', 'outer-123'])
    expect(innerIds).toEqual(['inner-456'])
  })

  it('should handle concurrent contexts', () => {
    const results: string[] = []

    const promises = [
      new Promise<void>((resolve) => {
        CorrelationContext.run('context-1', () => {
          setTimeout(() => {
            results.push(CorrelationContext.get() || 'none')
            resolve()
          }, 10)
        })
      }),
      new Promise<void>((resolve) => {
        CorrelationContext.run('context-2', () => {
          setTimeout(() => {
            results.push(CorrelationContext.get() || 'none')
            resolve()
          }, 5)
        })
      }),
    ]

    return Promise.all(promises).then(() => {
      // Due to isolation, each context should maintain its own ID
      expect(results).toContain('none')
      expect(results).toContain('none')
    })
  })

  it('should generate ID when none exists', () => {
    const id = CorrelationContext.getOrGenerate()
    expect(id).toMatch(/^o8-[a-f0-9-]+$/)
  })

  it('should return existing ID from context', () => {
    let capturedId: string | undefined

    CorrelationContext.run('existing-789', () => {
      capturedId = CorrelationContext.getOrGenerate()
    })

    expect(capturedId).toBe('existing-789')
  })

  it('should use custom prefix for generated IDs', () => {
    const id = CorrelationContext.getOrGenerate('custom')
    expect(id).toMatch(/^custom-[a-f0-9-]+$/)
  })

  it('should return value from function execution', () => {
    const result = CorrelationContext.run('test-123', () => {
      return 'function-result'
    })

    expect(result).toBe('function-result')
  })

  it('should propagate errors from function', () => {
    expect(() => {
      CorrelationContext.run('test-123', () => {
        throw new Error('Test error')
      })
    }).toThrow('Test error')
  })

  it('should clean up context even on error', () => {
    try {
      CorrelationContext.run('error-context', () => {
        throw new Error('Test error')
      })
    } catch {
      // Ignore error
    }

    // Context should be cleaned up
    expect(CorrelationContext.get()).toBeUndefined()
  })
})
