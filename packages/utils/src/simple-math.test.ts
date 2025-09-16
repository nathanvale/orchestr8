import { describe, expect, it } from 'vitest'
import { add } from './simple-math'

describe('simple-math', () => {
  it('should add two numbers correctly', () => {
    expect(add(2, 3)).toBe(5)
  })

  it('should handle negative numbers', () => {
    expect(add(-1, 1)).toBe(0)
  })
})
