import '@testing-library/jest-dom/vitest';
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HttpHandler } from 'msw';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactElement } from 'react';
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

// Mock the 'bun' module for tests that import it
// This must be done before any other imports to prevent Vite resolution issues
// eslint-disable-next-line @typescript-eslint/require-await
vi.mock('bun', async () => {
  const mockServer = {
    port: 3000,
    hostname: 'localhost',
    stop: vi.fn(),
    reload: vi.fn(),
    ref: vi.fn(),
    unref: vi.fn(),
  };

  return {
    serve: vi.fn(() => mockServer),
    file: vi.fn((path: string) => ({
      exists: vi.fn(() => Promise.resolve(true)),
      text: vi.fn(() => Promise.resolve('mock file content')),
      json: vi.fn(() => Promise.resolve({})),
      arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
      stream: vi.fn(() => Promise.resolve(new ReadableStream())),
      size: 0,
      type: 'text/plain',
      name: path,
    })),
    write: vi.fn(() => Promise.resolve(0)),
    env: process.env,
    argv: ['bun', 'test'],
    version: '1.1.38',
    revision: 'mock-revision',
    which: vi.fn(() => '/usr/local/bin/bun'),
    build: vi.fn(() => Promise.resolve({ success: true, outputs: [] })),
    plugin: vi.fn(),
    default: {},
  };
});

// Mock handlers for common API patterns
const defaultHandlers: HttpHandler[] = [
  // Example API handlers
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' });
  }),

  http.get('/api/user/:id', ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      id,
      name: `Test User ${String(id)}`,
      email: `test${String(id)}@example.com`,
    });
  }),

  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      token: 'mock-jwt-token',
      user: { id: '1', name: 'Test User' },
    });
  }),
];

// Setup MSW server
export const server = setupServer(...defaultHandlers);

// Global setup and teardown
beforeAll(() => {
  // Start MSW server
  server.listen({
    onUnhandledRequest: 'warn', // Log unhandled requests in development
  });

  // Mock common browser APIs only in test environment
  if (process.env['VITEST'] === 'true' || process.env.NODE_ENV === 'test') {
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
      });
    }

    // Mock ResizeObserver only if it doesn't exist
    if (!global.ResizeObserver) {
      global.ResizeObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }));
    }

    // Mock IntersectionObserver only if it doesn't exist
    if (!global.IntersectionObserver) {
      global.IntersectionObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }));
    }

    // Mock localStorage only if it doesn't exist
    if (!window.localStorage) {
      const localStorageMock = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      };
      Object.defineProperty(window, 'localStorage', {
        writable: true,
        configurable: true,
        value: localStorageMock,
      });

      // Mock sessionStorage with the same implementation
      Object.defineProperty(window, 'sessionStorage', {
        writable: true,
        configurable: true,
        value: { ...localStorageMock },
      });
    }
  }

  // Native Bun fetch is available, no polyfill needed

  // Setup console mocking for cleaner test output
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

beforeEach(() => {
  // Clear all timers (clearMocks is handled by vitest config)
  vi.clearAllTimers();
});

afterEach(() => {
  // Reset any request handlers that may have been added during tests
  server.resetHandlers();

  // Clear all timers and mocks (only if timers are mocked)
  if (vi.isFakeTimers?.()) {
    vi.runOnlyPendingTimers();
  }
  vi.clearAllTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();

  // Clean up DOM if using happy-dom
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

afterAll(async () => {
  // Clean up MSW server with proper async handling
  await new Promise<void>((resolve) => {
    const cleanup = () => {
      try {
        server.close();
        resolve();
      } catch {
        // Server might already be closed, continue cleanup
        resolve();
      }
    };

    // Give active requests time to complete
    setTimeout(cleanup, 100);
  });

  // Restore all mocks
  vi.restoreAllMocks();

  // Clear all timers one final time
  vi.clearAllTimers();
  vi.useRealTimers();

  // Restore console methods
  if (console.warn && typeof (console.warn as any).mockRestore === 'function') {
    (console.warn as any).mockRestore();
  }
  if (console.error && typeof (console.error as any).mockRestore === 'function') {
    (console.error as any).mockRestore();
  }
});

// Utility functions for test setup
export const mockApiResponse = (url: string, response: unknown, status = 200): void => {
  server.use(
    http.get(url, () => {
      // @ts-expect-error - response can be any type for testing
      return HttpResponse.json(response, { status });
    }),
  );
};

export const mockApiError = (url: string, status = 500, message = 'Server Error'): void => {
  server.use(
    http.get(url, () => {
      return HttpResponse.json({ error: message }, { status });
    }),
  );
};

// React Testing Library configuration already imported above

// Wrapper component for providers (customize as needed)
const AllTheProviders = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  // Add your providers here (Router, Theme, Context, etc.)
  return <>{children}</>;
};

export const render = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): ReturnType<typeof rtlRender> => rtlRender(ui, { wrapper: AllTheProviders, ...options });

// Export all testing utilities (no re-export of userEvent; import directly where needed)
export * from '@testing-library/react';
// User event convenience instance (idempotent; local to each test run)
export const user = (userEvent as any)?.setup ? (userEvent as any).setup() : userEvent;

// Async wait helper (microtask-ish flush)
export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

// Custom matchers (example matcher retained; extend here as needed)
export const customMatchers = {
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${String(received)} not to be within range ${String(floor)} - ${String(ceiling)}`
          : `expected ${String(received)} to be within range ${String(floor)} - ${String(ceiling)}`,
    };
  },
};

// Register matchers once (expect is global in Vitest)
if (typeof (globalThis as any).expect?.extend === 'function') {
  (globalThis as any).expect.extend(customMatchers);
}
