#!/usr/bin/env node
export * from './cli.js'

// Re-export commands for programmatic usage
export { initCommand } from './commands/init.js'
export { createAgentCommand } from './commands/create-agent.js'
export { runCommand } from './commands/run.js'
export { testCommand } from './commands/test.js'
export { inspectCommand } from './commands/inspect.js'

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  import('./cli.js')
}
