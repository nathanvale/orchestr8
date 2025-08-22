import { watch } from 'fs'
import fs from 'fs/promises'
import { dirname, resolve, isAbsolute } from 'path'

import { OrchestrationEngine, JsonExecutionModel } from '@orchestr8/core'
import {
  WorkflowValidator,
  type Workflow,
  type WorkflowResult,
} from '@orchestr8/schema'
import { Command } from 'commander'

/**
 * Validates and resolves a file path to prevent directory traversal attacks
 * @param filePath The file path to validate
 * @param baseDir The base directory to resolve against (defaults to current working directory)
 * @returns The resolved absolute path
 * @throws Error if the path is outside the allowed directory
 */
function validateFilePath(filePath: string, baseDir?: string): string {
  const cwd = process.cwd()
  const base = baseDir || cwd

  // Resolve the path to get absolute path and normalize '..' sequences
  const resolved = isAbsolute(filePath)
    ? resolve(filePath)
    : resolve(base, filePath)

  // Ensure the resolved path is within the allowed directory
  if (!resolved.startsWith(resolve(base))) {
    throw new Error(`Path "${filePath}" is outside allowed directory`)
  }

  return resolved
}

export const runCommand = new Command('run')
  .description('Execute a workflow from a JSON file')
  .argument('<workflow>', 'Path to workflow JSON file')
  .option('-o, --output <file>', 'Save execution result to file')
  .option('-w, --watch', 'Watch workflow file for changes')
  .option('-v, --verbose', 'Verbose output')
  .action(async (workflowPath: string, options) => {
    const executeWorkflow = async () => {
      try {
        // Validate and resolve file path
        const resolvedWorkflowPath = validateFilePath(workflowPath)

        // Check if file exists and is readable
        try {
          await fs.access(resolvedWorkflowPath, fs.constants.R_OK)
        } catch (error) {
          console.error(`❌ Cannot read workflow file: ${workflowPath}`)
          if ((error as { code?: string }).code === 'ENOENT') {
            console.error('  File does not exist')
          } else if ((error as { code?: string }).code === 'EACCES') {
            console.error('  Permission denied')
          }
          return
        }

        // Read workflow file
        const workflowContent = await fs.readFile(resolvedWorkflowPath, 'utf-8')

        // Parse and validate workflow
        let workflowData: unknown
        try {
          workflowData = JSON.parse(workflowContent)
        } catch (error) {
          console.error(
            `❌ Failed to parse workflow JSON: ${(error as Error).message}`,
          )
          return
        }

        // Validate with schema
        const validator = new WorkflowValidator()
        const validation = validator.validate(workflowData)

        if (!validation.valid) {
          console.error('❌ Workflow validation failed:')
          validation.errors?.forEach((error) => {
            console.error(`  - ${error.path}: ${error.message}`)
          })
          return
        }

        // Transform the validated data to match the legacy Workflow interface
        const validatedWorkflow = validation.data!
        const workflow: Workflow = {
          id: validatedWorkflow.metadata.id,
          name: validatedWorkflow.metadata.name,
          version: validatedWorkflow.version,
          steps: validatedWorkflow.steps.map((step) => {
            if (step.type === 'agent') {
              // Transform new schema agent step to legacy format
              return {
                id: step.id,
                name: step.name,
                type: 'agent' as const,
                agentId: step.agent.id,
                config: step.agent.config,
                input: step.input,
                dependsOn: step.dependencies,
              }
            } else {
              // Pass through non-agent steps (sequential, parallel)
              return {
                id: step.id,
                name: step.name,
                type: step.type,
                dependsOn: step.dependencies,
              }
            }
          }),
        }

        console.log(`🚀 Executing workflow: ${workflow.name || workflow.id}`)
        if (options.verbose) {
          console.log(`  Steps: ${workflow.steps.length}`)
        }

        // Create execution model
        const executionModel = new JsonExecutionModel()
        const serializedWorkflow = executionModel.serializeWorkflow(workflow)

        // Create a simple agent registry
        const agentRegistry = {
          async getAgent(id: string) {
            // Simple mock agent
            return {
              id,
              name: `Agent ${id}`,
              execute: async (input: unknown) => ({ output: input }),
            }
          },
          async hasAgent(_id: string) {
            return true
          },
        }

        // Create a simple resilience adapter
        const resilienceAdapter = {
          async applyPolicy<T>(
            operation: (signal?: AbortSignal) => Promise<T>,
            policy: unknown,
            signal?: AbortSignal,
            _context?: unknown,
          ): Promise<T> {
            return operation(signal)
          },
        }

        // Execute workflow
        const engine = new OrchestrationEngine({
          agentRegistry,
          resilienceAdapter,
        })

        const startTime = Date.now()
        const result: WorkflowResult = await engine.execute(workflow)
        const duration = Date.now() - startTime

        console.log(`✅ Workflow completed in ${duration}ms`)
        console.log(`  Run ID: ${result.executionId}`)
        console.log(`  Status: ${result.status}`)

        if (options.verbose && Object.keys(result.steps).length > 0) {
          console.log(`  Results: ${JSON.stringify(result.steps, null, 2)}`)
        }

        // Save output if requested
        if (options.output) {
          try {
            // Validate output file path
            const resolvedOutputPath = validateFilePath(options.output)

            // Ensure output directory exists
            const outputDir = dirname(resolvedOutputPath)
            await fs.mkdir(outputDir, { recursive: true })

            const outputData = {
              runId: result.executionId,
              workflow: serializedWorkflow,
              status: result.status,
              steps: result.steps,
              variables: result.variables,
              errors: result.errors,
              duration: duration,
              timestamp: new Date().toISOString(),
            }

            await fs.writeFile(
              resolvedOutputPath,
              JSON.stringify(outputData, null, 2),
              'utf-8',
            )
            console.log(`📝 Result saved to: ${options.output}`)
          } catch (error) {
            console.error(
              `❌ Failed to save output: ${(error as Error).message}`,
            )
            if (options.verbose) {
              console.error((error as Error).stack)
            }
          }
        }

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        console.error(`❌ Execution failed: ${errorMessage}`)

        if (options.verbose && error instanceof Error) {
          console.error(error.stack)
        }

        // Exit with error code for programmatic usage
        process.exitCode = 1
      }
    }

    try {
      // Execute once
      await executeWorkflow()

      // Watch mode
      if (options.watch) {
        // Validate file path for watching
        const resolvedWatchPath = validateFilePath(workflowPath)

        console.log(`\n👁️  Watching for changes: ${workflowPath}`)
        console.log('Press Ctrl+C to stop')

        const watcher = watch(resolvedWatchPath, async (eventType) => {
          if (eventType === 'change') {
            console.log('\n🔄 Workflow file changed, re-executing...')
            await executeWorkflow()
          }
        })

        // Handle watcher errors
        watcher.on('error', (error) => {
          console.error(`❌ Watch error: ${error.message}`)
          watcher.close()
          process.exitCode = 1
        })

        // Handle graceful shutdown
        const cleanup = () => {
          try {
            watcher.close()
            console.log('\n👋 Stopping watch mode')
            process.exit(0)
          } catch (error) {
            console.error(
              `❌ Error during cleanup: ${(error as Error).message}`,
            )
            process.exit(1)
          }
        }

        process.on('SIGINT', cleanup)
        process.on('SIGTERM', cleanup)

        // Keep process alive
        await new Promise(() => {})
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(`❌ Command failed: ${errorMessage}`)

      if (options.verbose && error instanceof Error) {
        console.error(error.stack)
      }

      process.exitCode = 1
    }
  })
