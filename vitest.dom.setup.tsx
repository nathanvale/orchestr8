// DOM-specific setup file for happy-dom environment tests
// This file loads jest-dom matchers and DOM-specific setup

// Load jest-dom matchers for DOM environments
import '@testing-library/jest-dom/vitest'

// Re-export all shared setup from main setup file
export * from './vitest.setup'
