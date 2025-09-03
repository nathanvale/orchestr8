#!/usr/bin/env tsx

/**
 * Bin entry for stop hook
 * This file will be compiled to dist/bin/claude-hooks-stop.js
 */

// Load environment variables before any other imports
import { main } from '../stop/stop.js'
import '../utils/env-loader.js'

// Execute the main function
try {
  await main()
} catch (error) {
  console.error('Fatal error:', error)
  process.exit(1)
}
