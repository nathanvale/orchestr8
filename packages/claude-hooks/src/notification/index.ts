/**
 * Entry point for the notification hook
 */

import { main } from './notification.js'

// Run the hook
await main().catch((error) => {
  console.error('Fatal error:', error)
  throw error
})
