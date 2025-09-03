/**
 * Entry point for the stop hook
 */

import { main } from './stop.js'

// Run the hook
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
