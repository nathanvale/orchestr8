// Vitest custom matcher type declarations
// Placed under tests/types to be included by tsconfig root include patterns

import 'vitest'
export {} // ensure this file is a module for global + module augmentation

declare global {
  // Sentinel used in vitest.setup.tsx to guard idempotent polyfill initialization
  // boolean | undefined reflects first-write wins (true once set)
  var __TEST_POLYFILLS_SETUP__: boolean | undefined
}

declare module 'vitest' {
  interface Assertion<T = any> {
    toBeWithinRange(floor: number, ceiling: number): void
  }
  interface AsymmetricMatchersContaining {
    toBeWithinRange(floor: number, ceiling: number): void
  }
}
