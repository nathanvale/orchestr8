import { Command } from 'commander'
import fs from 'fs/promises'
import { JournalManager } from '@orchestr8/core'

export const inspectCommand = new Command('inspect')
  .description('Inspect workflow execution details')
  .argument('[runId]', 'Execution run ID to inspect')
  .option('-v, --verbose', 'Show detailed step information')
  .option('-t, --timeline', 'Show execution timeline')
  .option('-e, --export <file>', 'Export execution data to file')
  .option('--json', 'Output in JSON format')
  .action(async (runId: string | undefined, options) => {
    const journal = JournalManager.getGlobalJournal()

    if (!runId) {
      // List all executions
      const executionIds = journal.getExecutionIds()

      if (options.json) {
        console.log(JSON.stringify({ executionIds }, null, 2))
        return
      }

      console.log('Recent Executions:')
      console.log('=================\n')

      if (executionIds.length === 0) {
        console.log('No executions found.')
        return
      }

      executionIds.forEach((id) => {
        const exportData = journal.exportExecution(id) as any
        if (exportData) {
          const duration = exportData.duration
            ? `${exportData.duration}ms`
            : 'In progress'
          console.log(`  ${id}`)
          console.log(`    Workflow: ${exportData.workflowId || 'Unknown'}`)
          console.log(`    Status: ${exportData.summary.status || 'unknown'}`)
          if (exportData.startTime) {
            console.log(
              `    Started: ${new Date(exportData.startTime).toLocaleString()}`,
            )
          }
          console.log(`    Duration: ${duration}`)
          console.log()
        }
      })

      console.log('Run `o8 inspect <runId>` to see details')
      return
    }

    // Get specific execution
    const execution = journal.exportExecution(runId) as any

    if (!execution) {
      console.error(`❌ Execution not found: ${runId}`)
      console.log('\nTip: Run `o8 inspect` to list all executions')
      return
    }

    if (options.json) {
      console.log(JSON.stringify(execution, null, 2))
      return
    }

    // Display execution details
    console.log('Execution Details')
    console.log('=================\n')
    console.log(`Run ID: ${execution.executionId}`)
    console.log(`Workflow: ${execution.workflowId || 'Unknown'}`)
    console.log(
      `Status: ${getStatusEmoji(execution.summary.status || 'unknown')} ${execution.summary.status || 'unknown'}`,
    )
    if (execution.startTime) {
      console.log(`Started: ${new Date(execution.startTime).toLocaleString()}`)
    }

    if (execution.endTime) {
      const duration = execution.duration || 0
      console.log(`Ended: ${new Date(execution.endTime).toLocaleString()}`)
      console.log(`Duration: ${formatDuration(duration)}`)
    }

    // Timeline view
    if (options.timeline) {
      console.log('\nExecution Timeline:')
      console.log('==================\n')

      const baseTime = execution.startTime || 0

      console.log(`00:00:00 - Workflow started`)

      // Extract step information from entries
      const stepEntries = execution.entries.filter((e: any) => e.stepId)
      const uniqueSteps = Array.from(
        new Set(stepEntries.map((e: any) => e.stepId)),
      )

      uniqueSteps.forEach((stepId, index) => {
        const stepEvents = stepEntries.filter((e: any) => e.stepId === stepId)
        const startEvent = stepEvents.find(
          (e: any) => e.type === 'step.started',
        )
        const endEvent = stepEvents.find(
          (e: any) => e.type === 'step.completed' || e.type === 'step.failed',
        )

        if (startEvent) {
          const stepStart = startEvent.timestamp - baseTime
          console.log(
            `${formatTime(stepStart)} - Step ${index + 1}: ${stepId} started`,
          )
        }
        if (endEvent) {
          const stepEnd = endEvent.timestamp - baseTime
          const status =
            endEvent.type === 'step.completed' ? 'completed' : 'failed'
          console.log(`${formatTime(stepEnd)} - Step ${index + 1} ${status}`)
        }
      })

      if (execution.endTime) {
        const totalTime = execution.endTime - baseTime
        console.log(
          `${formatTime(totalTime)} - Workflow ${execution.summary.status || 'completed'}`,
        )
      }
    }

    // Step details
    if (options.verbose) {
      console.log('\nStep Details:')
      console.log('=============\n')

      const stepEntries = execution.entries.filter((e: any) => e.stepId)
      const uniqueSteps = Array.from(
        new Set(stepEntries.map((e: any) => e.stepId)),
      )

      uniqueSteps.forEach((stepId, index) => {
        const stepEvents = stepEntries.filter((e: any) => e.stepId === stepId)
        const startEvent = stepEvents.find(
          (e: any) => e.type === 'step.started',
        )
        const endEvent = stepEvents.find(
          (e: any) => e.type === 'step.completed' || e.type === 'step.failed',
        )

        console.log(`Step ${index + 1}: ${stepId}`)

        if (endEvent) {
          const status =
            endEvent.type === 'step.completed' ? 'completed' : 'failed'
          console.log(`  Status: ${getStatusEmoji(status)} ${status}`)
        }

        if (startEvent && endEvent) {
          const duration = endEvent.timestamp - startEvent.timestamp
          console.log(`  Duration: ${formatDuration(duration)}`)
        }

        if (options.verbose) {
          stepEvents.forEach((event: any) => {
            console.log(`  Event: ${event.type}`)
            if (event.data) {
              console.log(
                `    Data: ${JSON.stringify(event.data, null, 2).split('\n').join('\n    ')}`,
              )
            }
          })
        }

        console.log()
      })
    }

    // Export to file
    if (options.export) {
      await fs.writeFile(
        options.export,
        JSON.stringify(execution, null, 2),
        'utf-8',
      )
      console.log(`\n📝 Exported to: ${options.export}`)
    }
  })

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'completed':
    case 'success':
      return '✅'
    case 'failed':
    case 'error':
      return '❌'
    case 'running':
    case 'in-progress':
      return '🔄'
    case 'pending':
      return '⏳'
    case 'cancelled':
      return '🚫'
    default:
      return '❓'
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  } else {
    const minutes = Math.floor(ms / 60000)
    const seconds = ((ms % 60000) / 1000).toFixed(0)
    return `${minutes}m ${seconds}s`
  }
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const milliseconds = ms % 1000

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}
