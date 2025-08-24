#!/usr/bin/env node
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { WorkflowSchema, type WorkflowZod } from '@orchestr8/schema'
import { Command } from 'commander'

import { createAgentCommand } from './commands/create-agent.js'
// Import commands
import { initCommand } from './commands/init.js'
import { inspectCommand } from './commands/inspect.js'
import { runCommand } from './commands/run.js'
import { testCommand } from './commands/test.js'

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

/**
 * Validates workflow name to ensure it's safe for file system and follows naming conventions
 * @param name The workflow name to validate
 * @returns The validated and trimmed workflow name
 * @throws Error if the name is invalid
 */
function validateWorkflowName(name: string): string {
  if (!name || name.trim().length === 0) {
    throw new Error('Workflow name cannot be empty')
  }

  const trimmedName = name.trim()

  if (trimmedName.length < 2 || trimmedName.length > 64) {
    throw new Error('Workflow name must be between 2 and 64 characters')
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
    throw new Error(
      'Workflow name can only contain letters, numbers, hyphens, and underscores',
    )
  }

  if (/^[-_]|[-_]$/.test(trimmedName)) {
    throw new Error(
      'Workflow name cannot start or end with hyphens or underscores',
    )
  }

  return trimmedName
}

// Add create:workflow command (alias for create:agent with workflow template)
program
  .command('create:workflow <name>')
  .description('Create a new workflow definition')
  .option('-d, --description <desc>', 'Workflow description')
  .option('-f, --force', 'Overwrite existing workflow')
  .option('-v, --verbose', 'Verbose output')
  .action(async (name: string, options) => {
    const fs = await import('fs/promises')
    const path = await import('path')

    try {
      // Validate workflow name
      const validatedName = validateWorkflowName(name)

      // Validate description if provided
      if (options.description && options.description.length > 500) {
        throw new Error('Description must be less than 500 characters')
      }

      const workflowsDir = path.join(process.cwd(), 'workflows')
      const workflowPath = path.join(workflowsDir, `${validatedName}.json`)

      // Check if workflow already exists
      if (!options.force) {
        try {
          await fs.access(workflowPath)
          console.log(
            `⚠️  Workflow ${validatedName} already exists. Use --force to overwrite.`,
          )
          return
        } catch {
          // File doesn't exist, proceed
        }
      }

      // Create workflows directory if it doesn't exist
      try {
        await fs.mkdir(workflowsDir, { recursive: true })
      } catch (error) {
        const code = (error as { code?: string }).code
        if (code === 'EACCES') {
          throw new Error(
            'Permission denied: Cannot create workflows directory',
          )
        }
        throw error
      }

      // Generate UUID for workflow
      const workflowId = randomUUID()

      // Create schema-compliant workflow definition
      const workflow: WorkflowZod = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        schemaHash: 'a'.repeat(64), // Placeholder hash - would be computed in real implementation
        metadata: {
          id: workflowId,
          name:
            validatedName.charAt(0).toUpperCase() +
            validatedName.slice(1).replace(/-/g, ' '),
          description:
            options.description || `${validatedName} workflow for orchestr8`,
          tags: ['generated', 'template'],
        },
        steps: [
          {
            id: 'step-1',
            name: 'First Step',
            type: 'agent',
            onError: 'fail',
            agent: {
              id: '@orchestr8/example-agent',
              version: '1.0.0',
            },
          },
        ],
        context: {
          environment: {},
          variables: {},
        },
      }

      // Validate workflow against schema
      const validation = WorkflowSchema.safeParse(workflow)
      if (!validation.success) {
        throw new Error(
          `Generated workflow is invalid: ${validation.error.message}`,
        )
      }

      // Write workflow file with error handling
      try {
        await fs.writeFile(
          workflowPath,
          JSON.stringify(workflow, null, 2),
          'utf-8',
        )
      } catch (error) {
        const code = (error as { code?: string }).code
        if (code === 'EACCES') {
          throw new Error(`Permission denied: Cannot write to ${workflowPath}`)
        } else if (code === 'ENOSPC') {
          throw new Error('No space left on device')
        }
        throw error
      }

      console.log(`✅ Created workflow: workflows/${validatedName}.json`)
      console.log(`\nWorkflow configuration:`)
      console.log(`  ID: ${workflow.metadata.id}`)
      console.log(`  Name: ${workflow.metadata.name}`)
      console.log(`  Steps: ${workflow.steps.length}`)

      if (options.verbose) {
        console.log(`  Description: ${workflow.metadata.description}`)
        console.log(`  Version: ${workflow.version}`)
        console.log(`  Context: ${JSON.stringify(workflow.context, null, 2)}`)
      }

      console.log(`\nNext steps:`)
      console.log(`  1. Edit the workflow file to customize steps`)
      console.log(`  2. Create required agents: o8 create:agent example-agent`)
      console.log(
        `  3. Run your workflow: o8 run workflows/${validatedName}.json`,
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(`❌ Failed to create workflow: ${errorMessage}`)

      if (options.verbose && error instanceof Error && error.stack) {
        console.error(error.stack)
      }

      process.exitCode = 1
    }
  })

// Add validate command
program
  .command('validate <file>')
  .description('Validate a workflow or agent JSON file')
  .option('-v, --verbose', 'Verbose output')
  .action(async (file: string, options) => {
    const fs = await import('fs/promises')
    const { WorkflowValidator } = await import('@orchestr8/schema')
    const { resolve, isAbsolute } = await import('path')

    try {
      // Validate and resolve file path
      const cwd = process.cwd()
      const resolvedPath = isAbsolute(file) ? resolve(file) : resolve(cwd, file)

      // Prevent directory traversal
      if (!resolvedPath.startsWith(resolve(cwd))) {
        throw new Error(`Path "${file}" is outside current directory`)
      }

      // Check file accessibility
      try {
        await fs.access(resolvedPath, fs.constants.R_OK)
      } catch (error) {
        const code = (error as { code?: string }).code
        if (code === 'ENOENT') {
          throw new Error(`File not found: ${file}`)
        } else if (code === 'EACCES') {
          throw new Error(`Permission denied: ${file}`)
        }
        throw error
      }

      // Read and parse file
      let data: unknown
      try {
        const content = await fs.readFile(resolvedPath, 'utf-8')

        // Check for empty files
        if (content.trim().length === 0) {
          throw new Error('File is empty')
        }

        // Check file size (prevent loading huge files)
        const stats = await fs.stat(resolvedPath)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (stats.size > maxSize) {
          throw new Error(
            `File too large: ${Math.round(stats.size / 1024 / 1024)}MB (max: ${maxSize / 1024 / 1024}MB)`,
          )
        }

        data = JSON.parse(content)
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(`Invalid JSON syntax: ${error.message}`)
        }
        throw error
      }

      // Validate workflow
      const validator = new WorkflowValidator()
      const result = validator.validate(data)

      if (result.valid) {
        console.log(`✅ Valid workflow: ${file}`)
        console.log(`  ID: ${result.data?.metadata?.id || 'unknown'}`)
        console.log(`  Name: ${result.data?.metadata?.name || 'unnamed'}`)
        console.log(`  Steps: ${result.data?.steps?.length || 0}`)

        if (options.verbose && result.data) {
          console.log(`  Version: ${result.data.version || 'not specified'}`)
          console.log(
            `  Description: ${result.data.metadata?.description || 'none'}`,
          )
        }
      } else {
        console.error(`❌ Validation failed: ${file}`)
        if (result.errors && result.errors.length > 0) {
          result.errors.forEach((error) => {
            console.error(`  - ${error.path || 'root'}: ${error.message}`)
          })
        } else {
          console.error('  Unknown validation error')
        }
        process.exitCode = 1
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(`❌ Failed to validate: ${errorMessage}`)

      if (options.verbose && error instanceof Error && error.stack) {
        console.error(error.stack)
      }

      process.exitCode = 1
    }
  })

// Parse arguments
program.parse()
