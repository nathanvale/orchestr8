import { describe, expect, it } from 'vitest'
import { isEven } from './is-even'

describe('isEven', () => {
  it('should return true for even numbers', () => {
    expect(isEven(2)).toBe(true)
    expect(isEven(4)).toBe(true)
    expect(isEven(0)).toBe(true)
    expect(isEven(-2)).toBe(true)
  })

  it('should return false for odd numbers', () => {
    expect(isEven(1)).toBe(false)
    expect(isEven(3)).toBe(false)
    expect(isEven(-1)).toBe(false)
    expect(isEven(99)).toBe(false)
  })
})
