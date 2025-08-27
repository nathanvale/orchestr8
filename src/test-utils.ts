// Central barrel re-export for test utilities.
// Utilities now live in vitest.setup.tsx. Only re-export what actually exists.
export * from '@testing-library/react';
export { customMatchers, render, user, waitForAsync } from '../vitest.setup.js';

// NOTE:
// - customMatchers, user, waitForAsync were removed from setup to simplify runtime.
//   Import userEvent directly with: import userEvent from '@testing-library/user-event'
//   Add back helpers here only if reintroduced in vitest.setup.tsx.
