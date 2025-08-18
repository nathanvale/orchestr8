/**
 * Core orchestration engine implementation
 */

import { randomUUID } from 'crypto'

import {
  createExecutionError,
  ExecutionErrorCode,
  type AgentStep,
  type ExecutionContext as SchemaExecutionContext,
  type ExecutionError,
  type StepResult,
  type Workflow,
  type WorkflowResult,
} from '@orchestr8/schema'

import type {
  AgentRegistry,
  ExecutionGraph,
  ExecutionNode,
  Logger,
  OrchestrationEngine as IOrchestrationEngine,
  OrchestrationOptions,
  ResilienceAdapter,
  ResiliencePolicy,
} from './types.js'

import { evaluateCondition, resolveMapping } from './expression-evaluator.js'
import { NoOpLogger } from './logger.js'

/**
 * Internal execution context for the engine
 */
interface InternalExecutionContext {
  correlationId: string
  abortSignal: AbortSignal
  results: Map<string, StepResult>
  metadata: Record<string, unknown>
  variables: Record<string, unknown>
  maxResultBytesPerStep: number
  maxMetadataBytes: number
  envWhitelist?: string[]
}

/**
 * Main orchestration engine implementation
 */
export class OrchestrationEngine implements IOrchestrationEngine {
  private readonly agentRegistry: AgentRegistry
  private readonly resilienceAdapter: ResilienceAdapter
  private readonly logger: Logger
  private readonly maxConcurrency: number
  private readonly maxResultBytesPerStep: number
  private readonly maxMetadataBytes: number
  private readonly maxExpansionDepth: number
  private readonly maxExpansionSize: number
  private readonly strictConditions: boolean

  constructor(options: OrchestrationOptions) {
    this.agentRegistry = options.agentRegistry
    this.resilienceAdapter = options.resilienceAdapter
    this.logger = options.logger ?? new NoOpLogger()
    this.maxConcurrency = options.maxConcurrency ?? 10
    this.maxResultBytesPerStep = options.maxResultBytesPerStep ?? 512 * 1024
    this.maxMetadataBytes = options.maxMetadataBytes ?? 128 * 1024
    this.maxExpansionDepth = options.maxExpansionDepth ?? 10
    this.maxExpansionSize = options.maxExpansionSize ?? 64 * 1024
    this.strictConditions = options.strictConditions ?? false
  }

  /**
   * Execute a workflow
   */
  async execute(
    workflow: Workflow,
    variables?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<WorkflowResult> {
    const executionId = randomUUID()
    const startTime = new Date().toISOString()
    const startTimestamp = Date.now()

    // Create workflow logger with execution context
    const workflowLogger = this.logger.child({
      executionId,
      workflowId: workflow.id,
      workflowVersion: workflow.version,
    })

    workflowLogger.info('workflow.start', {
      workflowName: workflow.name,
      stepCount: workflow.steps.length,
      variables: variables ?? {},
      startTime,
    })

    // Create internal execution context
    const context: InternalExecutionContext = {
      correlationId: executionId,
      abortSignal: signal ?? new AbortController().signal,
      results: new Map<string, StepResult>(),
      metadata: {},
      variables: variables ?? {},
      maxResultBytesPerStep: this.maxResultBytesPerStep,
      maxMetadataBytes: this.maxMetadataBytes,
      envWhitelist: undefined, // TODO: Get from workflow or options
    }

    // Initialize result
    const result: WorkflowResult = {
      executionId,
      status: 'completed',
      steps: {},
      variables: context.variables,
      startTime,
      endTime: '',
      duration: 0,
    }

    try {
      // Build execution graph
      const graph = this.buildExecutionGraph(workflow)

      // Execute workflow levels
      await this.executeGraph(graph, context, workflow, workflowLogger)

      // Collect results
      for (const [stepId, stepResult] of context.results) {
        result.steps[stepId] = stepResult
      }

      // Check for any failures (excluding those with successful fallbacks)
      const failedSteps = Array.from(context.results.values()).filter(
        (r) => r.status === 'failed',
      )

      // Check if failed steps have successful fallbacks or onError: continue
      const unrecoverableFailures = failedSteps.filter((failedStep) => {
        // Check if any other step is an alias for this failed step
        const hasSuccessfulFallback = Array.from(context.results.values()).some(
          (r) => r.aliasFor === failedStep.stepId && r.status === 'completed',
        )

        // Check if the failed step has onError: continue
        const workflowStep = workflow.steps.find(
          (s) => s.id === failedStep.stepId,
        )
        const hasContinueError = workflowStep?.onError === 'continue'

        // Only count as failure if no successful fallback and not configured to continue
        return !hasSuccessfulFallback && !hasContinueError
      })

      if (unrecoverableFailures.length > 0) {
        result.status = 'failed'
        result.errors = unrecoverableFailures
          .filter((r) => r.error)
          .map((r) => r.error!)
      }

      // Check if cancelled
      if (context.abortSignal.aborted) {
        result.status = 'cancelled'
      }
    } catch (error) {
      result.status = 'failed'
      result.errors = [this.normalizeError(error)]
    }

    // Set final timing
    result.endTime = new Date().toISOString()
    result.duration = Date.now() - startTimestamp

    // Log workflow completion
    workflowLogger.info('workflow.end', {
      status: result.status,
      stepCount: Object.keys(result.steps).length,
      duration: result.duration,
      endTime: result.endTime,
      errorCount: result.errors?.length ?? 0,
    })

    return result
  }

  /**
   * Build execution graph from workflow
   */
  private buildExecutionGraph(workflow: Workflow): ExecutionGraph {
    const nodes = new Map<string, ExecutionNode>()
    const roots: string[] = []

    // Create nodes for each step
    for (const step of workflow.steps) {
      // Type-safe access to agent-specific properties
      const agentStep = step.type === 'agent' ? (step as AgentStep) : null

      const node: ExecutionNode = {
        stepId: step.id,
        type: step.type,
        agentId: agentStep?.agentId,
        dependsOn: step.dependsOn ?? [],
        config: agentStep?.config,
        input: agentStep?.input,
        resilience: step.resilience
          ? this.normalizeResiliencePolicy(step.resilience)
          : workflow.resilience
            ? this.normalizeResiliencePolicy(workflow.resilience)
            : undefined,
        onError: step.onError ?? 'fail',
        fallbackStepId: step.fallbackStepId,
        conditions:
          step.if || step.unless
            ? { if: step.if, unless: step.unless }
            : undefined,
      }

      nodes.set(step.id, node)

      // Track root nodes (no dependencies)
      if (!step.dependsOn || step.dependsOn.length === 0) {
        roots.push(step.id)
      }
    }

    // Validate dependencies exist
    for (const node of nodes.values()) {
      for (const dep of node.dependsOn) {
        if (!nodes.has(dep)) {
          throw createExecutionError(
            ExecutionErrorCode.VALIDATION,
            `Step '${node.stepId}' depends on non-existent step '${dep}'`,
            { stepId: node.stepId },
          )
        }
      }
    }

    // Detect cycles
    this.detectCycles(nodes)

    // Build topological levels
    const levels = this.buildExecutionLevels(nodes, roots)

    return { nodes, roots, levels }
  }

  /**
   * Detect cycles in the execution graph
   */
  private detectCycles(nodes: Map<string, ExecutionNode>): void {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId)
      recursionStack.add(nodeId)

      const node = nodes.get(nodeId)
      if (!node) return false

      // Check dependencies
      for (const depId of node.dependsOn) {
        if (!visited.has(depId)) {
          if (hasCycle(depId)) return true
        } else if (recursionStack.has(depId)) {
          return true
        }
      }

      recursionStack.delete(nodeId)
      return false
    }

    for (const nodeId of nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (hasCycle(nodeId)) {
          throw createExecutionError(
            ExecutionErrorCode.VALIDATION,
            `Circular dependency detected in workflow`,
          )
        }
      }
    }
  }

  /**
   * Build execution levels using topological sort
   */
  private buildExecutionLevels(
    nodes: Map<string, ExecutionNode>,
    roots: string[],
  ): ExecutionNode[][] {
    const levels: ExecutionNode[][] = []
    const completed = new Set<string>()
    const remaining = new Set(nodes.keys())

    // Start with root nodes
    if (roots.length > 0) {
      levels.push(roots.map((id) => nodes.get(id)!))
      roots.forEach((id) => {
        completed.add(id)
        remaining.delete(id)
      })
    }

    // Build subsequent levels
    while (remaining.size > 0) {
      const currentLevel: ExecutionNode[] = []

      for (const nodeId of remaining) {
        const node = nodes.get(nodeId)!
        // Check if all dependencies are completed
        if (node.dependsOn.every((dep) => completed.has(dep))) {
          currentLevel.push(node)
        }
      }

      if (currentLevel.length === 0 && remaining.size > 0) {
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          'Unable to resolve execution order - possible missing dependencies',
        )
      }

      // Sort level deterministically
      const sortedLevel = this.scheduleSteps(currentLevel, nodes)
      levels.push(sortedLevel)

      // Mark as completed
      sortedLevel.forEach((node) => {
        completed.add(node.stepId)
        remaining.delete(node.stepId)
      })
    }

    return levels
  }

  /**
   * Schedule steps in deterministic order
   */
  private scheduleSteps(
    steps: ExecutionNode[],
    allNodes: Map<string, ExecutionNode>,
  ): ExecutionNode[] {
    // Get original order from the map
    const originalOrder = Array.from(allNodes.values())

    return steps.sort((a, b) => {
      // Primary: dependency count (ascending) - fewer dependencies first
      const depDiff = a.dependsOn.length - b.dependsOn.length
      if (depDiff !== 0) return depDiff

      // Tiebreaker: original array index (stable, deterministic)
      const aIndex = originalOrder.findIndex((n) => n.stepId === a.stepId)
      const bIndex = originalOrder.findIndex((n) => n.stepId === b.stepId)
      return aIndex - bIndex
    })
  }

  /**
   * Execute the workflow graph
   */
  private async executeGraph(
    graph: ExecutionGraph,
    context: InternalExecutionContext,
    workflow: Workflow,
    logger: Logger,
  ): Promise<void> {
    if (!graph.levels) return

    for (let levelIndex = 0; levelIndex < graph.levels.length; levelIndex++) {
      const level = graph.levels[levelIndex]
      if (!level) continue // TypeScript guard for noUncheckedIndexedAccess

      logger.debug('level.start', {
        levelIndex,
        stepCount: level.length,
        stepIds: level.map((node) => node.stepId),
      })

      // Check if workflow is cancelled
      if (context.abortSignal.aborted) {
        // For the current level, mark unfinished steps as cancelled
        for (const node of level) {
          if (!context.results.has(node.stepId)) {
            context.results.set(node.stepId, {
              stepId: node.stepId,
              status: 'cancelled',
              error: createExecutionError(
                ExecutionErrorCode.CANCELLED,
                'Workflow cancelled',
                { stepId: node.stepId },
              ),
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
            })
          }
        }

        // For future levels, mark steps as skipped (they never started)
        for (
          let futureIndex = levelIndex + 1;
          futureIndex < graph.levels.length;
          futureIndex++
        ) {
          const futureLevel = graph.levels[futureIndex]
          if (!futureLevel) continue
          for (const node of futureLevel) {
            if (!context.results.has(node.stepId)) {
              context.results.set(node.stepId, {
                stepId: node.stepId,
                status: 'skipped',
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
              })
            }
          }
        }
        break
      }

      // Execute level
      await this.executeLevel(level, context, workflow, logger)

      // Check if workflow was cancelled during level execution
      if (context.abortSignal.aborted) {
        // Skip remaining levels (they never started)
        for (
          let futureIndex = levelIndex + 1;
          futureIndex < graph.levels.length;
          futureIndex++
        ) {
          const futureLevel = graph.levels[futureIndex]
          if (!futureLevel) continue
          for (const node of futureLevel) {
            if (!context.results.has(node.stepId)) {
              context.results.set(node.stepId, {
                stepId: node.stepId,
                status: 'skipped',
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                skipReason: 'workflow-cancelled',
              })
            }
          }
        }
        break
      }

      // Check for failures with fail-fast semantics
      const levelFailures = level
        .map((node) => context.results.get(node.stepId))
        .filter(
          (r): r is StepResult => r !== undefined && r.status === 'failed',
        )

      if (levelFailures.length > 0) {
        // Check if any failed step has onError: 'fail' (default)
        const shouldFailFast = level.some((node) => {
          const result = context.results.get(node.stepId)
          return result?.status === 'failed' && node.onError === 'fail'
        })

        if (shouldFailFast) {
          logger.warn('level.fail-fast', {
            levelIndex,
            failedSteps: levelFailures.map((f) => ({
              stepId: f.stepId,
              error: f.error?.message ?? 'Unknown error',
            })),
          })

          // Cancel remaining steps in this level
          for (const node of level) {
            const result = context.results.get(node.stepId)
            if (result && result.status === 'completed') continue
            if (!result) {
              context.results.set(node.stepId, {
                stepId: node.stepId,
                status: 'cancelled',
                error: createExecutionError(
                  ExecutionErrorCode.CANCELLED,
                  'Cancelled due to failure in parallel step',
                  { stepId: node.stepId },
                ),
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
              })
            }
          }

          // Skip remaining levels
          const currentLevelIndex = graph.levels.indexOf(level)
          if (currentLevelIndex >= 0) {
            for (const futureLevel of graph.levels.slice(
              currentLevelIndex + 1,
            )) {
              for (const node of futureLevel) {
                context.results.set(node.stepId, {
                  stepId: node.stepId,
                  status: 'skipped',
                  startTime: new Date().toISOString(),
                  endTime: new Date().toISOString(),
                  skipReason: 'level-failure',
                })
              }
            }
          }
          break
        }
      }
    }
  }

  /**
   * Execute a level of steps in parallel
   */
  private async executeLevel(
    steps: ExecutionNode[],
    context: InternalExecutionContext,
    workflow: Workflow,
    logger: Logger,
  ): Promise<void> {
    // Create an abort controller for this level
    const levelAbortController = new AbortController()

    // Combine parent and level abort signals using AbortSignal.any
    // This ensures both parent cancellation and level fail-fast work properly
    const combinedSignal = AbortSignal.any([
      context.abortSignal,
      levelAbortController.signal,
    ])

    // Execute steps in parallel with concurrency limit
    const promises: Promise<void>[] = []
    const semaphore = new Semaphore(this.maxConcurrency)

    for (const node of steps) {
      const promise = semaphore.acquire().then(async (release) => {
        try {
          // Create a context with the combined abort signal
          const stepContext = {
            ...context,
            abortSignal: combinedSignal,
          }

          await this.executeStep(node, stepContext, workflow, logger)

          // Check if this step failed with onError: 'fail'
          const result = context.results.get(node.stepId)
          if (result?.status === 'failed' && node.onError === 'fail') {
            // Cancel other steps in this level
            levelAbortController.abort()
          }
        } finally {
          release()
        }
      })
      promises.push(promise)
    }

    // Wait for all steps to complete or fail
    await Promise.allSettled(promises)

    // Mark any steps that were aborted as cancelled
    for (const node of steps) {
      if (levelAbortController.signal.aborted) {
        const result = context.results.get(node.stepId)
        // If step hasn't completed and abort was triggered, mark as cancelled
        if (
          !result ||
          (result.status !== 'completed' && result.status !== 'failed')
        ) {
          context.results.set(node.stepId, {
            stepId: node.stepId,
            status: 'cancelled',
            error: createExecutionError(
              ExecutionErrorCode.CANCELLED,
              'Cancelled due to failure in parallel step',
              { stepId: node.stepId },
            ),
            startTime: result?.startTime ?? new Date().toISOString(),
            endTime: new Date().toISOString(),
          })
        }
      }
    }

    // After level completes, handle any fallbacks
    for (const node of steps) {
      const result = context.results.get(node.stepId)
      if (
        result?.status === 'failed' &&
        node.onError === 'fallback' &&
        node.fallbackStepId
      ) {
        // Try to execute fallback now that level is complete
        try {
          await this.executeFallback(
            node,
            context,
            workflow,
            result.error!,
            logger,
          )
        } catch {
          // Fallback failed, keep original failure
        }
      }
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    node: ExecutionNode,
    context: InternalExecutionContext,
    workflow: Workflow,
    logger: Logger,
  ): Promise<void> {
    const startTime = new Date().toISOString()

    // Create step logger with context
    const stepLogger = logger.child({
      stepId: node.stepId,
      agentId: node.agentId,
    })

    stepLogger.debug('step.start', {
      startTime,
      dependencies: node.dependsOn,
      onError: node.onError,
    })

    // Check if this step has already been executed (e.g., as a fallback)
    const existingResult = context.results.get(node.stepId)
    if (existingResult && existingResult.status === 'completed') {
      // Step already executed successfully, skip
      stepLogger.debug('step.skip', {
        reason: 'already-executed',
      })
      return
    }

    try {
      // Check if dependencies were completed (not skipped, failed, or cancelled)
      for (const dep of node.dependsOn) {
        const depResult = context.results.get(dep)
        if (!depResult || depResult.status !== 'completed') {
          // Check if there's a successful fallback that aliases for this dependency
          const hasSuccessfulFallback = Array.from(
            context.results.values(),
          ).some((r) => r.aliasFor === dep && r.status === 'completed')

          if (!hasSuccessfulFallback) {
            // Skip this step if dependency not completed and no successful fallback
            stepLogger.debug('step.skip', {
              reason: 'dependency-not-completed',
              dependency: dep,
              dependencyStatus: depResult?.status,
            })

            context.results.set(node.stepId, {
              stepId: node.stepId,
              status: 'skipped',
              startTime,
              endTime: new Date().toISOString(),
              skipReason: 'dependency-not-completed',
            })
            return
          }
        }
      }

      // Check conditions
      if (node.conditions) {
        const shouldExecute = await this.evaluateConditions(
          node.conditions,
          context,
          workflow,
        )
        if (!shouldExecute) {
          stepLogger.debug('step.skip', {
            reason: 'condition-not-met',
            conditions: node.conditions,
          })

          context.results.set(node.stepId, {
            stepId: node.stepId,
            status: 'skipped',
            startTime,
            endTime: new Date().toISOString(),
            skipReason: 'condition-not-met',
          })
          return
        }
      }

      // Get the agent
      if (!node.agentId) {
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `No agent ID specified for step '${node.stepId}'`,
          { stepId: node.stepId },
        )
      }

      const agent = await this.agentRegistry.getAgent(node.agentId)

      // Resolve input mappings
      const resolvedInput = node.input
        ? await this.resolveStepInput(node.input, context, workflow)
        : {}

      // Create execution context for agent
      const stepsContext: Record<string, StepResult> = {}
      for (const [stepId, result] of context.results) {
        stepsContext[stepId] = result
      }

      const agentContext: SchemaExecutionContext = {
        executionId: context.correlationId,
        workflow: workflow,
        variables: context.variables,
        steps: stepsContext,
        signal: context.abortSignal,
      }

      // Create step execution function
      const executeAgent = async () => {
        return await agent.execute(
          resolvedInput,
          agentContext,
          context.abortSignal,
        )
      }

      // Apply resilience policies
      let output: unknown
      if (node.resilience || node.onError === 'retry') {
        // If retry is requested but no policy defined, create a default one
        const policy =
          node.resilience ||
          (node.onError === 'retry'
            ? {
                retry: {
                  maxAttempts: 3,
                  backoffStrategy: 'exponential' as const,
                  jitterStrategy: 'full-jitter' as const,
                  initialDelay: 1000,
                  maxDelay: 10000,
                },
              }
            : undefined)

        if (policy) {
          output = await this.resilienceAdapter.applyPolicy(
            executeAgent,
            policy,
            context.abortSignal,
          )
        } else {
          output = await executeAgent()
        }
      } else {
        output = await executeAgent()
      }

      // Truncate output if needed
      const result = this.truncateResult(output)

      const endTime = new Date().toISOString()
      const duration = Date.now() - new Date(startTime).getTime()

      // Store result
      context.results.set(node.stepId, {
        stepId: node.stepId,
        status: 'completed',
        output: result.truncated ? undefined : output,
        startTime,
        endTime,
        ...result,
      })

      // Log successful completion
      stepLogger.info('step.success', {
        duration,
        endTime,
        truncated: result.truncated,
        outputSize: result.originalSize,
      })
    } catch (error) {
      const executionError = this.normalizeError(error, node.stepId)
      const endTime = new Date().toISOString()
      const duration = Date.now() - new Date(startTime).getTime()

      // Check if this is a cancellation error
      const isCancelled = executionError.code === ExecutionErrorCode.CANCELLED

      // Log step error
      stepLogger.error('step.error', {
        error: executionError.message,
        errorCode: executionError.code,
        duration,
        endTime,
        cancelled: isCancelled,
      })

      // Handle error based on policy
      if (node.onError === 'fallback' && node.fallbackStepId && !isCancelled) {
        // Store the failure, fallback will be handled after level completes
        context.results.set(node.stepId, {
          stepId: node.stepId,
          status: 'failed',
          error: executionError,
          startTime,
          endTime: new Date().toISOString(),
        })
      } else if (node.onError === 'continue' && !isCancelled) {
        // Mark as failed but continue (but not for cancellations)
        context.results.set(node.stepId, {
          stepId: node.stepId,
          status: 'failed',
          error: executionError,
          startTime,
          endTime: new Date().toISOString(),
        })
      } else {
        // Default: fail or cancelled
        context.results.set(node.stepId, {
          stepId: node.stepId,
          status: isCancelled ? 'cancelled' : 'failed',
          error: executionError,
          startTime,
          endTime: new Date().toISOString(),
        })
      }
    }
  }

  /**
   * Execute fallback step
   */
  private async executeFallback(
    originalNode: ExecutionNode,
    context: InternalExecutionContext,
    workflow: Workflow,
    originalError: ExecutionError,
    logger: Logger,
  ): Promise<void> {
    if (!originalNode.fallbackStepId) return

    // Store original failure
    context.results.set(originalNode.stepId, {
      stepId: originalNode.stepId,
      status: 'failed',
      error: originalError,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
    })

    // Check if fallback has already been executed
    const existingFallbackResult = context.results.get(
      originalNode.fallbackStepId,
    )
    if (existingFallbackResult) {
      if (existingFallbackResult.status === 'completed') {
        // Log fallback execution (fallback already succeeded)
        logger.info('step.fallback', {
          originalStepId: originalNode.stepId,
          fallbackStepId: originalNode.fallbackStepId,
          originalError: originalError.message,
        })

        // Fallback already succeeded, mark it as alias
        context.results.set(originalNode.fallbackStepId, {
          ...existingFallbackResult,
          aliasFor: originalNode.stepId,
        })

        // Make fallback output available as original step output
        const originalResult = context.results.get(originalNode.stepId)!
        context.results.set(originalNode.stepId, {
          ...originalResult,
          output: existingFallbackResult.output,
        })
      }
      // If fallback already failed or was skipped, leave it as is
      return
    }

    // Find fallback step
    const fallbackStep = workflow.steps.find(
      (s) => s.id === originalNode.fallbackStepId,
    )
    if (!fallbackStep) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        `Fallback step '${originalNode.fallbackStepId}' not found`,
        { stepId: originalNode.stepId },
      )
    }

    // Type-safe access to agent-specific properties
    const agentStep =
      fallbackStep.type === 'agent' ? (fallbackStep as AgentStep) : null

    // Check if fallback dependencies are satisfied
    const fallbackDependencies = fallbackStep.dependsOn ?? []
    for (const dep of fallbackDependencies) {
      const depResult = context.results.get(dep)
      if (!depResult || depResult.status !== 'completed') {
        // Fallback dependencies not met - throw validation error
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Fallback step '${fallbackStep.id}' has unmet dependency: '${dep}'`,
          { stepId: originalNode.stepId },
        )
      }
    }

    // Create fallback node
    const fallbackNode: ExecutionNode = {
      stepId: fallbackStep.id,
      type: fallbackStep.type,
      agentId: agentStep?.agentId,
      dependsOn: fallbackDependencies,
      config: agentStep?.config,
      input: originalNode.input, // Use same input as original
      resilience: undefined, // TODO: Get from step options
      onError: 'fail',
      conditions: undefined, // TODO: Get from step options
    }

    // Log fallback execution
    logger.info('step.fallback', {
      originalStepId: originalNode.stepId,
      fallbackStepId: fallbackStep.id,
      originalError: originalError.message,
    })

    // Execute fallback
    await this.executeStep(fallbackNode, context, workflow, logger)

    // If fallback succeeded, alias its output for the original step
    const fallbackResult = context.results.get(fallbackStep.id)
    if (fallbackResult && fallbackResult.status === 'completed') {
      // Mark fallback as alias
      context.results.set(fallbackStep.id, {
        ...fallbackResult,
        aliasFor: originalNode.stepId,
      })

      // Make fallback output available as original step output for dependencies
      const originalResult = context.results.get(originalNode.stepId)!
      context.results.set(originalNode.stepId, {
        ...originalResult,
        output: fallbackResult.output,
      })
    }
  }

  /**
   * Evaluate step conditions
   */
  private async evaluateConditions(
    conditions: { if?: string; unless?: string },
    context: InternalExecutionContext,
    workflow: Workflow,
  ): Promise<boolean> {
    try {
      // Build a context compatible with the expression evaluator
      const stepsContext: Record<string, StepResult> = {}
      for (const [stepId, result] of context.results) {
        stepsContext[stepId] = result
      }

      const evalContext: SchemaExecutionContext = {
        executionId: context.correlationId,
        workflow: workflow,
        variables: context.variables,
        steps: stepsContext,
        signal: context.abortSignal,
      }

      // Evaluate 'if' condition
      if (conditions.if) {
        const result = evaluateCondition(
          conditions.if,
          evalContext,
          this.strictConditions,
        )
        if (!result) return false
      }

      // Evaluate 'unless' condition
      if (conditions.unless) {
        const result = evaluateCondition(
          conditions.unless,
          evalContext,
          this.strictConditions,
        )
        if (result) return false
      }

      return true
    } catch (error) {
      // Condition evaluation errors should result in VALIDATION error
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        `Condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error as Error },
      )
    }
  }

  /**
   * Resolve step input mappings
   */
  private async resolveStepInput(
    input: Record<string, unknown>,
    context: InternalExecutionContext,
    workflow: Workflow,
  ): Promise<Record<string, unknown>> {
    // Build a context compatible with the expression evaluator
    const stepsContext: Record<string, StepResult> = {}
    for (const [stepId, result] of context.results) {
      stepsContext[stepId] = result
    }

    const evalContext: SchemaExecutionContext = {
      executionId: context.correlationId,
      workflow: workflow,
      variables: context.variables,
      steps: stepsContext,
      signal: context.abortSignal,
    }

    const resolvedInput: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        resolvedInput[key] = resolveMapping(value, evalContext)
      } else if (value && typeof value === 'object') {
        // Recursively resolve nested objects
        resolvedInput[key] = await this.resolveStepInput(
          value as Record<string, unknown>,
          context,
          workflow,
        )
      } else {
        resolvedInput[key] = value
      }
    }

    return resolvedInput
  }

  /**
   * Truncate result to fit within memory limits
   */
  private truncateResult(output: unknown): {
    truncated: boolean
    originalSize?: number
    retainedBytes?: number
  } {
    try {
      const serialized = JSON.stringify(output)
      const byteSize = Buffer.byteLength(serialized, 'utf8')

      if (byteSize <= this.maxResultBytesPerStep) {
        return { truncated: false }
      }

      // Truncate to ~90% of the limit to leave room for metadata
      const targetBytes = Math.floor(this.maxResultBytesPerStep * 0.9)

      // Use binary search to find the right character count that fits within byte limit
      let low = 0
      let high = serialized.length
      let bestFit = 0

      while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        const testStr = serialized.substring(0, mid)
        const testBytes = Buffer.byteLength(testStr, 'utf8')

        if (testBytes <= targetBytes) {
          bestFit = mid
          low = mid + 1
        } else {
          high = mid - 1
        }
      }

      const truncatedStr = serialized.substring(0, bestFit)

      return {
        truncated: true,
        originalSize: byteSize,
        retainedBytes: Buffer.byteLength(truncatedStr, 'utf8'),
      }
    } catch {
      // If serialization fails, mark as truncated
      return {
        truncated: true,
        originalSize: undefined,
        retainedBytes: 0,
      }
    }
  }

  /**
   * Normalize resilience policy to ensure all required fields are present
   */
  private normalizeResiliencePolicy(
    policy: unknown,
  ): ResiliencePolicy | undefined {
    if (!policy || typeof policy !== 'object') return undefined

    const policyObj = policy as Record<string, unknown>
    const normalized: ResiliencePolicy = {}

    if (policyObj.retry && typeof policyObj.retry === 'object') {
      const retry = policyObj.retry as Record<string, unknown>
      normalized.retry = {
        maxAttempts: (retry.maxAttempts as number) ?? 3,
        backoffStrategy:
          (retry.backoffStrategy as 'fixed' | 'exponential') ?? 'exponential',
        jitterStrategy:
          (retry.jitterStrategy as 'none' | 'full-jitter') ?? 'full-jitter',
        initialDelay: (retry.initialDelay as number) ?? 1000,
        maxDelay: (retry.maxDelay as number) ?? 10000,
      }
    }

    if (policyObj.timeout && typeof policyObj.timeout === 'number') {
      normalized.timeout = policyObj.timeout
    }

    if (
      policyObj.circuitBreaker &&
      typeof policyObj.circuitBreaker === 'object'
    ) {
      const cb = policyObj.circuitBreaker as Record<string, unknown>
      normalized.circuitBreaker = {
        failureThreshold: (cb.failureThreshold as number) ?? 5,
        recoveryTime: (cb.recoveryTime as number) ?? 30000,
        sampleSize: (cb.sampleSize as number) ?? 10,
        halfOpenPolicy:
          (cb.halfOpenPolicy as 'single-probe' | 'gradual') ?? 'single-probe',
      }
    }

    return normalized
  }

  /**
   * Normalize errors to ExecutionError
   */
  private normalizeError(error: unknown, stepId?: string): ExecutionError {
    // Check if it's already an ExecutionError
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error &&
      typeof (error as ExecutionError).code === 'string'
    ) {
      // It's already an ExecutionError, just add stepId if missing
      const executionError = error as ExecutionError
      if (stepId && !executionError.stepId) {
        return { ...executionError, stepId }
      }
      return executionError
    }

    return createExecutionError(
      ExecutionErrorCode.UNKNOWN,
      error instanceof Error ? error.message : String(error),
      { stepId, cause: error as Error },
    )
  }
}

/**
 * Simple semaphore for concurrency control
 */
class Semaphore {
  private permits: number
  private waiting: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<() => void> {
    if (this.permits > 0) {
      this.permits--
      return () => this.release()
    }

    return new Promise<() => void>((resolve) => {
      this.waiting.push(() => {
        this.permits--
        resolve(() => this.release())
      })
    })
  }

  private release(): void {
    this.permits++
    if (this.waiting.length > 0 && this.permits > 0) {
      const next = this.waiting.shift()
      if (next) next()
    }
  }
}
