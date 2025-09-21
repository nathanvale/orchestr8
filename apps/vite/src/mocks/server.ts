/**
 * MSW server setup for testing
 * Uses testkit's MSW infrastructure for consistency
 */

import { setupMSW } from '@template/testkit/msw'
import { handlers } from './handlers'

// Setup MSW using testkit with consistent onUnhandledRequest: 'error' behavior
setupMSW(handlers, {
  onUnhandledRequest: 'error',
  quiet: false,
})
