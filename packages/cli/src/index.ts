export * from './cli.js'

// Re-export commands for programmatic usage
export { createAgentCommand } from './commands/create-agent.js'
export { initCommand } from './commands/init.js'
export { inspectCommand } from './commands/inspect.js'
export { runCommand } from './commands/run.js'
export { testCommand } from './commands/test.js'
