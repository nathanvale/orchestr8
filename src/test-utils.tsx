/**
 * Central test utilities for React Testing Library
 * Provides custom render with providers and common test helpers
 */

import { render as rtlRender, type RenderOptions } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import type { ReactElement } from 'react'
import React from 'react'

// Wrapper component for providers (customize as needed)
const AllTheProviders = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  // Add your providers here (Router, Theme, Context, etc.)
  return <>{children}</>
}

// Custom render function with providers
export const render = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): ReturnType<typeof rtlRender> => {
  return rtlRender(ui, { wrapper: AllTheProviders, ...options })
}

// Re-export everything from React Testing Library
export * from '@testing-library/react'

// User event setup helper - creates a new user instance for each test
// Provide a typed setup wrapper; fallback if .setup is unavailable (older versions)
export type UserEventInstance = ReturnType<(typeof userEvent)['setup']>
export const setupUser = (): UserEventInstance => userEvent.setup()

// Async wait helper for microtask flush
export const waitForAsync = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
