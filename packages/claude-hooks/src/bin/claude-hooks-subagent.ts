#!/usr/bin/env tsx

/**
 * Bin entry for subagent stop hook
 * This file will be compiled to dist/bin/claude-hooks-subagent.js
 */

// Load environment variables before any other imports
import { main } from '../subagent-stop/subagent-stop.js'
import '../utils/env-loader.js'

// Execute the main function
try {
  await main()
} catch (error: unknown) {
  console.error('Fatal error:', error)
  process.exit(1)
}
