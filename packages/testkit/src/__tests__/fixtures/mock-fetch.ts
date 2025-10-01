/**
 * Mock fetch implementation for testing retry examples
 */

interface MockResponse {
  ok: boolean
  status: number
  json(): Promise<unknown>
}

interface MockFetchState {
  callCount: number
  shouldFailUntil: number
  responseData: unknown
}

export function createMockFetch(config: {
  failUntilCall?: number
  responseData?: unknown
  status?: number
}): [typeof fetch, MockFetchState] {
  const state: MockFetchState = {
    callCount: 0,
    shouldFailUntil: config.failUntilCall || 0,
    responseData: config.responseData || { data: 'success' },
  }

  const mockFetch = async (_url: string): Promise<MockResponse> => {
    state.callCount++

    if (state.callCount <= state.shouldFailUntil) {
      return {
        ok: false,
        status: config.status || 500,
        json: async () => ({ error: 'Server error' }),
      }
    }

    return {
      ok: true,
      status: 200,
      json: async () => state.responseData,
    }
  }

  return [mockFetch as unknown as typeof fetch, state]
}

export function createSlowPromise<T>(value: T, delayMs: number): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), delayMs)
  })
}
