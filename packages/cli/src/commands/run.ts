import { Command } from 'commander'
import fs from 'fs/promises'
import { watch } from 'fs'
import path from 'path'
import { OrchestrationEngine, JsonExecutionModel } from '@orchestr8/core'
import { WorkflowValidator, type Workflow } from '@orchestr8/schema'

export const runCommand = new Command('run')
  .description('Execute a workflow from a JSON file')
  .argument('<workflow>', 'Path to workflow JSON file')
  .option('-o, --output <file>', 'Save execution result to file')
  .option('-w, --watch', 'Watch workflow file for changes')
  .option('-v, --verbose', 'Verbose output')
  .action(async (workflowPath: string, options) => {
    const executeWorkflow = async () => {
      try {
        // Read workflow file
        const workflowContent = await fs.readFile(workflowPath, 'utf-8')

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

        // Transform the validated data to match the old Workflow interface if needed
        const validatedWorkflow = validation.data!
        const workflow: Workflow = {
          ...validatedWorkflow,
          id: validatedWorkflow.metadata.id,
          name: validatedWorkflow.metadata.name,
          steps: validatedWorkflow.steps.map((step: any) => ({
            ...step,
            agentId: step.agent?.id || step.agentId,
          })),
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
          async hasAgent(id: string) {
            return true
          },
        }

        // Create a simple resilience adapter
        const resilienceAdapter = {
          async applyPolicy<T>(
            operation: (signal?: AbortSignal) => Promise<T>,
            policy: unknown,
            signal?: AbortSignal,
            context?: unknown,
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
        const result = await engine.execute(workflow)
        const duration = Date.now() - startTime

        console.log(`✅ Workflow completed in ${duration}ms`)
        console.log(`  Run ID: ${result.executionId}`)
        console.log(`  Status: ${result.status}`)

        if (options.verbose && (result as any).output) {
          console.log(
            `  Result: ${JSON.stringify((result as any).output, null, 2)}`,
          )
        }

        // Save output if requested
        if (options.output) {
          const outputData = {
            runId: result.executionId,
            workflow: serializedWorkflow,
            status: result.status,
            result: (result as any).output,
            duration: duration,
            timestamp: new Date().toISOString(),
          }

          await fs.writeFile(
            options.output,
            JSON.stringify(outputData, null, 2),
            'utf-8',
          )
          console.log(`📝 Result saved to: ${options.output}`)
        }

        return result
      } catch (error) {
        console.error(`❌ Execution failed: ${(error as Error).message}`)
        if (options.verbose) {
          console.error((error as Error).stack)
        }
      }
    }

    // Execute once
    await executeWorkflow()

    // Watch mode
    if (options.watch) {
      console.log(`\n👁️  Watching for changes: ${workflowPath}`)
      console.log('Press Ctrl+C to stop')

      const watcher = watch(workflowPath, async (eventType) => {
        if (eventType === 'change') {
          console.log('\n🔄 Workflow file changed, re-executing...')
          await executeWorkflow()
        }
      })

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        watcher.close()
        console.log('\n👋 Stopping watch mode')
        process.exit(0)
      })

      // Keep process alive
      await new Promise(() => {})
    }
  })
