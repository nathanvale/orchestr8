import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('Dual Consumption', () => {
  let originalNodeEnv: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it('should support development imports', async () => {
    process.env.NODE_ENV = 'development'
    const module = await import('./index')
    expect(module).toBeDefined()
    expect(typeof module).toBe('object')
  })

  it('should resolve to source files in development', () => {
    process.env.NODE_ENV = 'development'
    expect(import.meta.url).toContain('/src/')
    expect(import.meta.url).not.toContain('/dist/')
  })
})