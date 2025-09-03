#!/usr/bin/env tsx

/**
 * Bin entry for list-voices command
 * This file will be compiled to dist/bin/claude-hooks-list-voices.js
 */

// Load environment variables before any other imports
import '../utils/env-loader.js'
import { main } from '../voices/list-voices.js'

// Execute the main function
try {
  await main()
} catch (error) {
  console.error('Fatal error:', error)
  process.exit(1)
}
