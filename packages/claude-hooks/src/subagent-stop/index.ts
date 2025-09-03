/**
 * Entry point for the subagent stop hook
 */

import { main } from './subagent-stop.js'

// Run the hook
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
