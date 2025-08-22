#!/usr/bin/env node
import { Command } from 'commander'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

// Import commands
import { initCommand } from './commands/init.js'
import { createAgentCommand } from './commands/create-agent.js'
import { runCommand } from './commands/run.js'
import { testCommand } from './commands/test.js'
import { inspectCommand } from './commands/inspect.js'

// Get package.json for version
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
)

// Create main program
const program = new Command()
  .name('o8')
  .description('Orchestr8 CLI - Workflow orchestration and agent management')
  .version(packageJson.version)

// Add commands
program.addCommand(initCommand)
program.addCommand(createAgentCommand)
program.addCommand(runCommand)
program.addCommand(testCommand)
program.addCommand(inspectCommand)

// Add create:workflow command (alias for create:agent with workflow template)
program
  .command('create:workflow <name>')
  .description('Create a new workflow definition')
  .option('-d, --description <desc>', 'Workflow description')
  .option('-f, --force', 'Overwrite existing workflow')
  .action(async (name: string, options) => {
    const fs = await import('fs/promises')
    const path = await import('path')

    const workflowsDir = path.join(process.cwd(), 'workflows')
    const workflowPath = path.join(workflowsDir, `${name}.json`)

    // Check if workflow already exists
    if (!options.force) {
      try {
        await fs.access(workflowPath)
        console.log(
          `⚠️  Workflow ${name} already exists. Use --force to overwrite.`,
        )
        return
      } catch {
        // File doesn't exist, proceed
      }
    }

    // Create workflows directory if it doesn't exist
    await fs.mkdir(workflowsDir, { recursive: true })

    // Create workflow definition
    const workflow = {
      id: name,
      name: name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' '),
      description: options.description || `${name} workflow for orchestr8`,
      version: '1.0.0',
      steps: [
        {
          id: 'step-1',
          name: 'First Step',
          type: 'action',
          agentId: 'example-agent',
          input: {
            message: 'Hello from step 1',
          },
          retryPolicy: {
            maxAttempts: 3,
            delay: '1s',
          },
        },
        {
          id: 'step-2',
          name: 'Second Step',
          type: 'parallel',
          steps: [
            {
              id: 'step-2a',
              name: 'Parallel Step A',
              type: 'action',
              agentId: 'example-agent',
              input: {
                message: 'Parallel execution A',
              },
            },
            {
              id: 'step-2b',
              name: 'Parallel Step B',
              type: 'action',
              agentId: 'example-agent',
              input: {
                message: 'Parallel execution B',
              },
            },
          ],
        },
        {
          id: 'step-3',
          name: 'Final Step',
          type: 'action',
          agentId: 'example-agent',
          input: {
            message: 'Workflow complete',
            previousResults: '${steps.step-1.output}',
          },
        },
      ],
      context: {
        environment: 'development',
        timeout: '5m',
      },
    }

    // Write workflow file
    await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2), 'utf-8')

    console.log(`✅ Created workflow: workflows/${name}.json`)
    console.log(`\nNext steps:`)
    console.log(`  1. Edit the workflow file to customize steps`)
    console.log(`  2. Create required agents: o8 create:agent example-agent`)
    console.log(`  3. Run your workflow: o8 run workflows/${name}.json`)
  })

// Add validate command
program
  .command('validate <file>')
  .description('Validate a workflow or agent JSON file')
  .action(async (file: string) => {
    const fs = await import('fs/promises')
    const { WorkflowValidator } = await import('@orchestr8/schema')

    try {
      const content = await fs.readFile(file, 'utf-8')
      const data = JSON.parse(content)

      const validator = new WorkflowValidator()
      const result = validator.validate(data)

      if (result.valid) {
        console.log(`✅ Valid workflow: ${file}`)
        console.log(`  ID: ${result.data?.metadata?.id}`)
        console.log(`  Steps: ${result.data?.steps.length}`)
      } else {
        console.error(`❌ Validation failed: ${file}`)
        result.errors?.forEach((error) => {
          console.error(`  - ${error.path}: ${error.message}`)
        })
        process.exit(1)
      }
    } catch (error) {
      console.error(`❌ Failed to validate: ${(error as Error).message}`)
      process.exit(1)
    }
  })

// Parse arguments
program.parse()
