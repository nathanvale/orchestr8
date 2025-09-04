#!/usr/bin/env node
/**
 * Development Alternative: Local Claude Hook File
 * For rapid development and testing
 * Calls the NPM binary for production consistency
 */

import { execSync } from 'node:child_process'

const HOOK_COMMAND = 'quality-check-claude-hook'

try {
  execSync(HOOK_COMMAND, { stdio: 'inherit', timeout: 2000 })
  process.exit(0)
} catch (error) {
  process.exit(error.status || 2)
}
