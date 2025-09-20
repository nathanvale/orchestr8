import { describe, it, expect } from 'vitest'

describe('Hello World', () => {
  it('should pass a basic test', () => {
    expect('Hello World').toBe('Hello World')
  })

  it('should add numbers correctly', () => {
    expect(1 + 1).toBe(2)
  })
})
