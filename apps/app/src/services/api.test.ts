import { describe, expect, test } from 'vitest'
import { fetchHealth, fetchServerLogs, fetchServerMetrics } from './api'

describe('API Service', () => {
  test('fetchHealth is a function', () => {
    // This is a simple unit test to ensure the app package has at least one test
    expect(typeof fetchHealth).toBe('function')
  })

  test('fetchServerLogs is a function', () => {
    expect(typeof fetchServerLogs).toBe('function')
  })

  test('fetchServerMetrics is a function', () => {
    expect(typeof fetchServerMetrics).toBe('function')
  })
})
