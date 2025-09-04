// Only import testing-library in browser-like environments
if (typeof window !== 'undefined') {
  import('@testing-library/jest-dom/vitest')
}

import type { HttpHandler } from 'msw'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, vi, expect } from 'vitest'

// Mock handlers for common API patterns
const defaultHandlers: HttpHandler[] = [
  // Example API handlers
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' })
  }),

  http.get('/api/user/:id', ({ params }) => {
    const { id } = params
    return HttpResponse.json({
      id,
      name: `Test User ${String(id)}`,
      email: `test${String(id)}@example.com`,
    })
  }),

  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      token: 'mock-jwt-token',
      user: { id: '1', name: 'Test User' },
    })
  }),

  // Pagination endpoint with edge case handling
  http.get('/api/items', ({ request }) => {
    const url = new URL(request.url)
    const limitParam = url.searchParams.get('limit')
    const pageParam = url.searchParams.get('page')

    // Handle limit edge cases
    let limit = 10 // default
    if (limitParam !== null) {
      const parsedLimit = parseInt(limitParam, 10)
      if (limitParam === 'NaN' || isNaN(parsedLimit)) {
        // NaN should use default
        limit = 10
      } else if (parsedLimit < 0) {
        // Negative limits treated as 0
        limit = 0
      } else if (parsedLimit === 0) {
        // limit=0 returns empty
        limit = 0
      } else if (parsedLimit > 1000) {
        // Cap at maximum
        limit = 100
      } else {
        limit = parsedLimit
      }
    }

    // Handle page edge cases
    let page = 1 // default (1-indexed)
    if (pageParam !== null) {
      const parsedPage = parseInt(pageParam, 10)
      if (pageParam === 'NaN' || isNaN(parsedPage)) {
        page = 1
      } else if (parsedPage < 1) {
        // Pages less than 1 default to 1
        page = 1
      } else {
        page = parsedPage
      }
    }

    // Generate mock items based on limit
    const items = Array.from({ length: limit }, (_, i) => ({
      id: `item-${(page - 1) * limit + i + 1}`,
      name: `Item ${(page - 1) * limit + i + 1}`,
    }))

    return HttpResponse.json({
      items,
      page,
      limit,
      total: 1000, // Mock total count
    })
  }),
]

// Setup MSW server
export const server = setupServer(...defaultHandlers)

// Global setup and teardown
beforeAll(() => {
  // Start MSW server
  server.listen({
    onUnhandledRequest: 'warn', // Log unhandled requests in development
  })

  // Mock common browser APIs only in test environment and when window exists
  // Use sentinel to prevent double polyfill setup
  if (
    (process.env['VITEST'] === 'true' || process.env['NODE_ENV'] === 'test') &&
    !(globalThis as any).__TEST_POLYFILLS_SETUP__ &&
    typeof window !== 'undefined'
  ) {
    ;(globalThis as any).__TEST_POLYFILLS_SETUP__ = true

    // Mock matchMedia only if it doesn't exist
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })
    }

    // Mock ResizeObserver only if it doesn't exist
    if (!global.ResizeObserver) {
      global.ResizeObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }))
    }

    // Mock IntersectionObserver only if it doesn't exist
    if (!global.IntersectionObserver) {
      global.IntersectionObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }))
    }

    // Always mock localStorage with Vitest spies for testing
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      writable: true,
      configurable: true,
      value: localStorageMock,
    })

    // Mock sessionStorage with the same implementation
    Object.defineProperty(window, 'sessionStorage', {
      writable: true,
      configurable: true,
      value: { ...localStorageMock },
    })
  }

  // Native Bun fetch is available, no polyfill needed
})

beforeEach(() => {
  // Clear all timers (clearMocks is handled by vitest config)
  vi.clearAllTimers()
})

afterEach(() => {
  // Reset any request handlers that may have been added during tests
  server.resetHandlers()

  // Clear all timers and mocks (only if timers are mocked)
  if (vi.isFakeTimers?.()) {
    vi.runOnlyPendingTimers()
  }
  vi.clearAllTimers()

  // Clean up DOM if using happy-dom
  if (typeof document !== 'undefined') {
    document.body.innerHTML = ''
    document.head.innerHTML = ''
  }
})

afterAll(() => {
  // Clean up MSW server - simplified without arbitrary timeout
  try {
    server.close()
  } catch {
    // Server might already be closed, continue cleanup
  }

  // Restore all mocks
  vi.restoreAllMocks()

  // Clear all timers one final time
  vi.clearAllTimers()
  vi.useRealTimers()
})

// Utility functions for test setup
export const mockApiResponse = (url: string, response: unknown, status = 200): void => {
  server.use(
    http.get(url, () => {
      // @ts-expect-error - response can be any type for testing
      return HttpResponse.json(response, { status })
    }),
  )
}

export const mockApiError = (url: string, status = 500, message = 'Server Error'): void => {
  server.use(
    http.get(url, () => {
      return HttpResponse.json({ error: message }, { status })
    }),
  )
}

// Test utilities are exported from src/test-utils.ts for better organization
// Import testing utilities from there in your tests:
// import { render, setupUser, waitForAsync } from '@/test-utils';

// Custom matchers (example matcher retained; extend here as needed)
export const customMatchers = {
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    return {
      pass,
      message: () =>
        pass
          ? `expected ${String(received)} not to be within range ${String(floor)} - ${String(ceiling)}`
          : `expected ${String(received)} to be within range ${String(floor)} - ${String(ceiling)}`,
    }
  },
}

// Register matchers with Vitest's expect
expect.extend(customMatchers)

// --- Fail-fast esbuild / vite subprocess diagnostics (opt-in) ---
// Activate by running with env BUN_TEMPLATE_ESBUILD_DIAG=1 (or using diag scripts).
// Captures stderr patterns (EPIPE/Broken pipe / abnormal esbuild exits) and forces a non-zero exit
// code (111) if anomalies occurred but tests otherwise passed, surfacing hidden tooling instability.
if (process.env['BUN_TEMPLATE_ESBUILD_DIAG'] === '1') {
  const suspicious: { msg: string; time: number }[] = []
  const origWrite = process.stderr.write.bind(process.stderr)
  ;(process.stderr.write as unknown as (
    chunk: string | Uint8Array,
    encoding?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void,
  ) => boolean) = (
    chunk: string | Uint8Array,
    encoding?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void,
  ) => {
    try {
      const text = typeof chunk === 'string' ? chunk : ((chunk as any)?.toString?.() ?? '')
      if (/EPIPE|Broken pipe|esbuild|vite.*(exit|error)/i.test(text)) {
        suspicious.push({ msg: text.trim(), time: Date.now() })
      }
    } catch {
      // swallow diagnostics parsing errors
    }
    return origWrite(chunk, encoding as any, cb as any)
  }
  process.on('beforeExit', (code) => {
    if (!suspicious.length) return
    const seen = new Set<string>()
    const lines = suspicious
      .map((s) => s.msg)
      .filter((m) => (seen.has(m) ? false : (seen.add(m), true)))
    console.error('\n[fail-fast][esbuild-diag] Detected potential toolchain instability:')
    let i = 0
    for (const line of lines) {
      i += 1
      console.error(`${i}. ${line}`)
    }
    if (code === 0) {
      process.exitCode = 111
      console.error(
        '[fail-fast][esbuild-diag] Forcing exitCode=111 (tests passed but tooling anomalies detected).',
      )
    }
  })
}
