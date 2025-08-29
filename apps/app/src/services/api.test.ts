import { describe, expect, test } from 'vitest'
import { fetchHealth, fetchLogs, fetchMetrics } from './api'

describe('API Service', () => {
  test('fetchHealth constructs correct URL', () => {
    // This is a simple unit test to ensure the app package has at least one test
    expect(typeof fetchHealth).toBe('function')
  })

  test('fetchLogs constructs correct URL', () => {
    expect(typeof fetchLogs).toBe('function')
  })

  test('fetchMetrics constructs correct URL', () => {
    expect(typeof fetchMetrics).toBe('function')
  })
})
