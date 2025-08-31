/**
 * Central test utilities for React Testing Library
 * Provides custom render with providers and common test helpers
 */

import { render as rtlRender, type RenderOptions } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import type { ReactElement } from 'react'
import React from 'react'

// Only import user-event in browser environments
// Use dynamic import to avoid loading in Node environments
type UserEventModule = (typeof import('@testing-library/user-event'))['default']
let userEventModule: UserEventModule | undefined
const loadUserEvent = async (): Promise<UserEventModule | undefined> => {
  if (typeof window !== 'undefined' && userEventModule === undefined) {
    const module = await import('@testing-library/user-event')
    userEventModule = module.default
  }
  return userEventModule
}

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
export type UserEventInstance = UserEvent
export const setupUser = async (): Promise<UserEventInstance> => {
  if (typeof window === 'undefined') {
    throw new Error(
      'userEvent is only available in browser environments. Use @vitest-environment jsdom for React component tests.',
    )
  }
  const userEventModule = await loadUserEvent()
  if (!userEventModule) {
    throw new Error('Failed to load userEvent')
  }
  return userEventModule.setup()
}

// Async wait helper for microtask flush
export const waitForAsync = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
