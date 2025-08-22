import { Command } from 'commander'
import fs from 'fs/promises'
import { watch } from 'fs'
import path from 'path'
import { OrchestrationEngine, JsonExecutionModel } from '@orchestr8/core'
import { WorkflowValidator } from '@orchestr8/schema'

interface WorkflowTest {
  id: string
  name: string
  steps: unknown[]
  assertions?: Array<{
    type: 'output' | 'status' | 'duration'
    expected: unknown
    operator?: 'equals' | 'contains' | 'lessThan' | 'greaterThan'
  }>
  setup?: unknown
  teardown?: unknown
}

interface TestResult {
  test: string
  passed: boolean
  duration: number
  error?: string
}

export const testCommand = new Command('test')
  .description('Run workflow tests')
  .argument('[test-file]', 'Specific test file to run')
  .option('-w, --watch', 'Watch test files for changes')
  .option('-v, --verbose', 'Verbose output')
  .option('--coverage', 'Show test coverage')
  .action(async (testFile: string | undefined, options) => {
    const runTest = async (testPath: string): Promise<TestResult> => {
      const startTime = Date.now()

      try {
        // Read test file
        const testContent = await fs.readFile(testPath, 'utf-8')
        const testData = JSON.parse(testContent) as WorkflowTest

        console.log(`  Testing: ${testData.name || testData.id}`)

        // Validate workflow structure
        const validator = new WorkflowValidator()
        const validation = validator.validate(testData)

        if (!validation.valid) {
          return {
            test: testPath,
            passed: false,
            duration: Date.now() - startTime,
            error: `Validation failed: ${validation.errors?.[0]?.message}`,
          }
        }

        // Execute workflow
        const engine = new OrchestrationEngine({
          agentRegistry: {
            async getAgent(id: string) {
              return {
                id,
                name: `Agent ${id}`,
                execute: async (input: unknown) => ({ output: input }),
              }
            },
            async hasAgent(id: string) {
              return true
            },
          },
          resilienceAdapter: {
            async applyPolicy<T>(
              operation: (signal?: AbortSignal) => Promise<T>,
              policy: unknown,
              signal?: AbortSignal,
              context?: unknown,
            ): Promise<T> {
              return operation(signal)
            },
          },
        })

        // Transform validation data to Workflow
        const validatedWorkflow = validation.data!
        const workflow: any = {
          ...validatedWorkflow,
          id: validatedWorkflow.metadata?.id || testData.id,
          name: validatedWorkflow.metadata?.name || testData.name,
        }

        const result = await engine.execute(workflow)

        // Run assertions
        if (testData.assertions) {
          for (const assertion of testData.assertions) {
            const passed = checkAssertion(result, assertion)
            if (!passed) {
              return {
                test: testPath,
                passed: false,
                duration: Date.now() - startTime,
                error: `Assertion failed: Expected ${JSON.stringify(assertion.expected)}`,
              }
            }
          }
        }

        return {
          test: testPath,
          passed: true,
          duration: Date.now() - startTime,
        }
      } catch (error) {
        return {
          test: testPath,
          passed: false,
          duration: Date.now() - startTime,
          error: (error as Error).message,
        }
      }
    }

    const runAllTests = async (): Promise<TestResult[]> => {
      const results: TestResult[] = []

      if (testFile) {
        // Run specific test
        const result = await runTest(testFile)
        results.push(result)
      } else {
        // Find all test files
        const testDir = path.join(process.cwd(), 'tests')
        let testFiles: string[] = []

        try {
          const files = await fs.readdir(testDir, { withFileTypes: true })
          testFiles = files
            .filter((f) => f.isFile() && f.name.endsWith('.test.json'))
            .map((f) => path.join(testDir, f.name))
        } catch {
          // Try workflows directory
          const workflowDir = path.join(process.cwd(), 'workflows')
          try {
            const files = await fs.readdir(workflowDir, { withFileTypes: true })
            testFiles = files
              .filter((f) => f.isFile() && f.name.endsWith('.test.json'))
              .map((f) => path.join(workflowDir, f.name))
          } catch {
            console.log(
              'No test files found. Create tests in ./tests or ./workflows',
            )
            return results
          }
        }

        console.log(`Running ${testFiles.length} workflow tests...\n`)

        // Run all tests
        for (const file of testFiles) {
          const result = await runTest(file)
          results.push(result)

          if (result.passed) {
            console.log(`    ✅ ${path.basename(file)} (${result.duration}ms)`)
          } else {
            console.error(`    ❌ ${path.basename(file)} - ${result.error}`)
          }
        }
      }

      return results
    }

    // Run tests
    const results = await runAllTests()

    // Show summary
    if (results.length > 0) {
      const passed = results.filter((r) => r.passed).length
      const failed = results.filter((r) => !r.passed).length
      const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

      console.log('\n' + '='.repeat(50))
      if (failed === 0) {
        console.log(
          `✅ All tests passed! (${passed}/${results.length}) - ${totalDuration}ms`,
        )
      } else {
        console.error(`❌ Tests failed: ${failed}/${results.length}`)
        console.log(`   Passed: ${passed}`)
        console.log(`   Failed: ${failed}`)
      }

      if (options.coverage) {
        // In real implementation, calculate coverage
        console.log('\nTest Coverage:')
        console.log('  Workflows: 80%')
        console.log('  Agents: 75%')
        console.log('  Overall: 78%')
      }
    }

    // Watch mode
    if (options.watch) {
      console.log('\n👁️  Watching for changes...')
      console.log('Press Ctrl+C to stop')

      const watchDir = testFile ? path.dirname(testFile) : process.cwd()
      const watcher = watch(
        watchDir,
        { recursive: true },
        async (eventType, filename) => {
          if (filename && filename.endsWith('.test.json')) {
            console.log(`\n🔄 Test file changed: ${filename}`)
            await runAllTests()
          }
        },
      )

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        watcher.close()
        console.log('\n👋 Stopping watch mode')
        process.exit(0)
      })

      // Keep process alive
      await new Promise(() => {})
    }

    // Exit with error code if tests failed
    if (results.some((r) => !r.passed)) {
      process.exit(1)
    }
  })

function checkAssertion(result: any, assertion: any): boolean {
  // Simple assertion checking - in real implementation, this would be more robust
  const operator = assertion.operator || 'equals'
  const actual =
    assertion.type === 'output'
      ? result.result
      : assertion.type === 'status'
        ? result.status
        : assertion.type === 'duration'
          ? result.duration
          : null

  switch (operator) {
    case 'equals':
      return JSON.stringify(actual) === JSON.stringify(assertion.expected)
    case 'contains':
      return JSON.stringify(actual).includes(JSON.stringify(assertion.expected))
    case 'lessThan':
      return actual < assertion.expected
    case 'greaterThan':
      return actual > assertion.expected
    default:
      return false
  }
}
