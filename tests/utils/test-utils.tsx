import { cleanup, render as rtlRender, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach } from 'vitest'
import type { ReactElement } from 'react'
import React from 'react'

// Automatically cleanup after each test
afterEach(() => {
  cleanup()
})

// Custom render function that wraps components with providers
export function render(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): ReturnType<typeof rtlRender> {
  // Wrapper component for providers
  const AllTheProviders = ({ children }: { children: React.ReactNode }): ReactElement => {
    // Add your providers here as needed:
    // - Router Provider
    // - Theme Provider
    // - Auth Context
    // - Redux/Zustand Store
    return <>{children}</>
  }

  return rtlRender(ui, {
    wrapper: AllTheProviders,
    ...options
  })
}

// Enhanced user event setup for better interaction testing
export function setupUser(): ReturnType<typeof userEvent.setup> {
  return userEvent.setup()
}

// Re-export everything from testing library
export * from '@testing-library/react'
export { userEvent }

// Utility function to wait for async operations
export const waitForAsync = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

// Custom matchers and assertions can be added here
export const customMatchers = {
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () => `expected ${String(received)} not to be within range ${String(floor)} - ${String(ceiling)}`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${String(received)} to be within range ${String(floor)} - ${String(ceiling)}`,
        pass: false,
      }
    }
  },
}