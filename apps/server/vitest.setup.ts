// Minimal setup for server tests
// No DOM-related imports or mocks needed for Node.js server testing
import { afterAll, afterEach, beforeAll } from 'vitest'

// Type declarations for global properties that may not exist in Node.js
interface MockNavigator {
  clipboard?: unknown
  userAgent: string
}

interface MockWindow {
  navigator: MockNavigator
  document: null
}

declare global {
  var window: MockWindow | undefined
  var navigator: MockNavigator | undefined
  var document: null | undefined
}

// Prevent any browser-specific libraries from loading in Node.js environment
beforeAll(() => {
  // Mock window with navigator for testing library compatibility
  if (typeof globalThis.window === 'undefined') {
    const mockWindow = {
      navigator: {
        clipboard: undefined,
        userAgent: 'Node.js Test Environment',
      },
      document: null,
    }

    Object.defineProperty(globalThis, 'window', {
      writable: true,
      configurable: true,
      value: mockWindow,
    })
  }

  // Mock navigator at global level as well
  if (typeof globalThis.navigator === 'undefined') {
    Object.defineProperty(globalThis, 'navigator', {
      writable: true,
      configurable: true,
      value: {
        clipboard: undefined,
        userAgent: 'Node.js Test Environment',
      },
    })
  }

  // Mock document if it doesn't exist
  if (typeof globalThis.document === 'undefined') {
    Object.defineProperty(globalThis, 'document', {
      writable: true,
      configurable: true,
      value: null,
    })
  }
})

// Clean up any resources after tests
afterEach(() => {
  // Any cleanup needed between tests
})

afterAll(() => {
  // Final cleanup
})
