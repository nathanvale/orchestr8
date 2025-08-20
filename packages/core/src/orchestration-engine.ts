/**
 * Core orchestration engine implementation
 */

import { randomUUID } from 'crypto'

import { NoopLogger } from '@orchestr8/logger'
import {
  createExecutionError,
  ExecutionErrorCode,
  isExecutionError,
  type AgentStep,
  type ExecutionContext as SchemaExecutionContext,
  type ExecutionError,
  type StepResult,
  type Workflow,
  type WorkflowResult,
  type CompositionOrder,
  type ResilienceAdapter,
  type ResilienceInvocationContext,
  type ResiliencePolicy,
} from '@orchestr8/schema'

import type {
  AgentRegistry,
  ExecutionGraph,
  ExecutionNode,
  Logger,
  OrchestrationEngine as IOrchestrationEngine,
  OrchestrationOptions,
} from './types.js'

import { BoundedEventBus } from './event-bus.js'
import {
  evaluateCondition,
  resolveMapping,
  type SecurityLimits,
} from './expression-evaluator.js'

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
}

/**
 * Main orchestration engine implementation
 */
export class OrchestrationEngine implements IOrchestrationEngine {
  private readonly agentRegistry: AgentRegistry
  private readonly resilienceAdapter: ResilienceAdapter
  private readonly logger: Logger
  private readonly defaultCompositionOrder: CompositionOrder
  private readonly maxConcurrency: number
  private readonly maxResultBytesPerStep: number
  private readonly maxExpansionDepth: number
  private readonly maxExpansionSize: number
  private readonly strictConditions: boolean
  private readonly eventBus: BoundedEventBus

  constructor(options: OrchestrationOptions) {
    this.agentRegistry = options.agentRegistry
    this.resilienceAdapter = options.resilienceAdapter
    this.logger = options.logger ?? new NoopLogger()
    this.defaultCompositionOrder =
      options.defaultCompositionOrder ?? 'retry-cb-timeout'
    this.maxConcurrency = options.maxConcurrency ?? 10
    this.maxResultBytesPerStep = options.maxResultBytesPerStep ?? 512 * 1024
    this.maxExpansionDepth = options.maxExpansionDepth ?? 10
    this.maxExpansionSize = options.maxExpansionSize ?? 64 * 1024
    this.strictConditions = options.strictConditions ?? true

    // Initialize event bus
    this.eventBus =
      options.eventBus instanceof BoundedEventBus
        ? options.eventBus
        : new BoundedEventBus(options.eventBus || {}, this.logger)
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

    // Emit execution queued event
    this.eventBus.emitEvent({
      type: 'execution.queued',
      executionId,
      workflowId: workflow.id,
    })

    // Emit workflow started event
    this.eventBus.emitEvent({
      type: 'workflow.started',
      workflowId: workflow.id,
      timestamp: startTimestamp,
    })

    // Emit execution started event
    this.eventBus.emitEvent({
      type: 'execution.started',
      executionId,
    })

    // Create internal execution context
    const context: InternalExecutionContext = {
      correlationId: executionId,
      abortSignal: signal ?? new AbortController().signal,
      results: new Map<string, StepResult>(),
      metadata: {},
      variables: variables ?? {},
      maxResultBytesPerStep: this.maxResultBytesPerStep,
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

        // Emit execution cancelled event
        this.eventBus.emitEvent({
          type: 'execution.cancelled',
          executionId,
          reason: 'User requested cancellation',
        })
      }
    } catch (error) {
      result.status = 'failed'
      result.errors = [this.normalizeError(error)]
    }

    // Set final timing
    result.endTime = new Date().toISOString()
    result.duration = Date.now() - startTimestamp

    // Emit workflow completion event
    if (result.status === 'completed') {
      this.eventBus.emitEvent({
        type: 'workflow.completed',
        workflowId: workflow.id,
        duration: result.duration,
      })
    } else if (result.status === 'failed' && result.errors?.length) {
      // Emit workflow failed event with the first error
      // Convert ExecutionError to Error for event bus
      const executionError = result.errors[0]!
      const error = new Error(executionError.message)
      error.name = executionError.code

      this.eventBus.emitEvent({
        type: 'workflow.failed',
        workflowId: workflow.id,
        error,
      })
    }

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
   *
   * Note: JavaScript Map maintains insertion order, which is critical for
   * deterministic step scheduling. Steps are inserted in workflow definition
   * order, and this ordering is used as a tiebreaker in scheduleSteps()
   * when steps have equal dependency counts.
   */
  private buildExecutionGraph(workflow: Workflow): ExecutionGraph {
    const nodes = new Map<string, ExecutionNode>()
    const roots: string[] = []

    // Create nodes for each step
    for (const step of workflow.steps) {
      // Skip Sequential/Parallel steps - they are organizational only in MVP
      if (step.type === 'sequential' || step.type === 'parallel') {
        this.logger.debug('graph.organizational_step', {
          stepId: step.id,
          type: step.type,
          name: step.name,
          description:
            'Organizational step (pass-through) - execution order determined by dependsOn',
        })
        // Skip adding to execution graph - these are documentation/organization only
        continue
      }

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
        } catch (error) {
          // Fallback failed, keep original failure
          logger.error('step.fallback_failed', {
            originalStepId: node.stepId,
            fallbackStepId: node.fallbackStepId,
            originalError: result.error?.message,
            fallbackError:
              error instanceof Error ? error.message : String(error),
            message: 'Fallback execution failed, keeping original step failure',
          })
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

    // Emit step started event
    this.eventBus.emitEvent({
      type: 'step.started',
      stepId: node.stepId,
      executionId: context.correlationId,
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
        let shouldExecute = false
        try {
          shouldExecute = await this.evaluateConditions(
            node.conditions,
            context,
            workflow,
          )
        } catch (error) {
          // In strict mode, invalid conditions throw VALIDATION errors
          // Treat these as condition-not-met and skip the step
          const isValidationError =
            (error as ExecutionError).code === ExecutionErrorCode.VALIDATION ||
            (error instanceof Error &&
              error.message.includes('Condition evaluation failed'))

          if (isValidationError) {
            stepLogger.debug('step.skip', {
              reason: 'invalid-condition',
              conditions: node.conditions,
              error: error instanceof Error ? error.message : String(error),
            })

            context.results.set(node.stepId, {
              stepId: node.stepId,
              status: 'skipped',
              startTime,
              endTime: new Date().toISOString(),
              skipReason: 'invalid-condition',
            })
            return
          }
          // Re-throw other errors
          throw error
        }

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

      // Create step execution function that accepts signal
      const executeAgent = async (signal?: AbortSignal) => {
        // Use provided signal or fall back to context signal
        const effectiveSignal = signal || context.abortSignal
        return await agent.execute(resolvedInput, agentContext, effectiveSignal)
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
          // Create resilience invocation context with event emitter
          const resilienceContext: ResilienceInvocationContext = {
            workflowId: workflow.id,
            stepId: node.stepId,
            correlationId: context.correlationId,
            metadata: {
              agentId: node.agentId,
              dependencies: node.dependsOn,
            },
            eventEmitter: {
              emit: (event: unknown) => {
                // Type-safe event emission for resilience events
                if (
                  event &&
                  typeof event === 'object' &&
                  'type' in event &&
                  typeof (event as { type: string }).type === 'string'
                ) {
                  const resilienceEvent = event as {
                    type: string
                    stepId?: string
                    [key: string]: unknown
                  }

                  // Map to our typed resilience events
                  if (resilienceEvent.type === 'retry.attempted') {
                    this.eventBus.emitEvent({
                      type: 'retry.attempted',
                      stepId: node.stepId,
                      attempt: (resilienceEvent.attempt as number) ?? 0,
                      delay: (resilienceEvent.delay as number) ?? 0,
                    })
                  } else if (resilienceEvent.type === 'circuitBreaker.opened') {
                    this.eventBus.emitEvent({
                      type: 'circuitBreaker.opened',
                      key: (resilienceEvent.key as string) ?? '',
                      failures: (resilienceEvent.failures as number) ?? 0,
                    })
                  } else if (resilienceEvent.type === 'timeout.exceeded') {
                    this.eventBus.emitEvent({
                      type: 'timeout.exceeded',
                      stepId: node.stepId,
                      duration: (resilienceEvent.duration as number) ?? 0,
                    })
                  }
                }
              },
            },
          }

          // Check if adapter supports new interface with composition order
          if (
            'applyNormalizedPolicy' in this.resilienceAdapter &&
            typeof this.resilienceAdapter.applyNormalizedPolicy === 'function'
          ) {
            // Use new interface with normalized policy and explicit composition order
            const normalizedPolicy = this.normalizeResiliencePolicy(policy)
            if (normalizedPolicy) {
              output = await this.resilienceAdapter.applyNormalizedPolicy(
                executeAgent,
                normalizedPolicy,
                this.defaultCompositionOrder,
                context.abortSignal,
                resilienceContext,
              )
            } else {
              output = await executeAgent(context.abortSignal)
            }
          } else {
            // Fall back to legacy interface
            output = await this.resilienceAdapter.applyPolicy(
              executeAgent,
              policy,
              context.abortSignal,
              resilienceContext,
            )
          }
        } else {
          output = await executeAgent(context.abortSignal)
        }
      } else {
        output = await executeAgent(context.abortSignal)
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

      // Emit step completed event
      this.eventBus.emitEvent({
        type: 'step.completed',
        stepId: node.stepId,
        output: result.truncated ? undefined : output,
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

      // Emit step failed event (unless cancelled)
      if (!isCancelled) {
        // Convert ExecutionError to Error for event bus
        const error = new Error(executionError.message)
        error.name = executionError.code

        this.eventBus.emitEvent({
          type: 'step.failed',
          stepId: node.stepId,
          error,
          retryable: node.onError === 'retry' || !!node.resilience?.retry,
        })
      }

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
        // The fallback step was already executed as a regular step
        // If it had no input and should have inherited from original, we need to re-execute it with correct input
        const fallbackStep = workflow.steps.find(
          (s) => s.id === originalNode.fallbackStepId,
        )
        const fallbackAgentStep =
          fallbackStep?.type === 'agent' ? (fallbackStep as AgentStep) : null

        // Check if the fallback step had no explicit input but the original step did
        const originalStep = workflow.steps.find(
          (s) => s.id === originalNode.stepId,
        )
        const originalAgentStep =
          originalStep?.type === 'agent' ? (originalStep as AgentStep) : null

        const fallbackShouldInheritInput =
          !fallbackAgentStep?.input && originalAgentStep?.input

        if (fallbackShouldInheritInput) {
          // Don't return early - proceed to re-execute the fallback with correct input
        } else {
          // Log fallback execution (fallback already succeeded with correct input)
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
          return
        }
      } else {
        // If fallback already failed or was skipped, leave it as is
        return
      }
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

    // Find original step to get its input
    const originalStep = workflow.steps.find(
      (s) => s.id === originalNode.stepId,
    )
    const originalAgentStep =
      originalStep?.type === 'agent' ? (originalStep as AgentStep) : null

    // Determine input: fallback step's own input takes precedence over original step input
    const fallbackInput = agentStep?.input ?? originalAgentStep?.input

    // Create fallback node
    const fallbackNode: ExecutionNode = {
      stepId: fallbackStep.id,
      type: fallbackStep.type,
      agentId: agentStep?.agentId,
      dependsOn: fallbackDependencies,
      config: agentStep?.config,
      input: fallbackInput, // Use fallback input with proper precedence
      resilience: fallbackStep.resilience
        ? this.normalizeResiliencePolicy(fallbackStep.resilience)
        : undefined,
      onError: fallbackStep.onError || 'fail',
      conditions:
        fallbackStep.if || fallbackStep.unless
          ? { if: fallbackStep.if, unless: fallbackStep.unless }
          : undefined,
    }

    // Log fallback execution
    logger.info('step.fallback', {
      originalStepId: originalNode.stepId,
      fallbackStepId: fallbackStep.id,
      originalError: originalError.message,
    })

    // Clear any existing result for the fallback step to force re-execution with correct input
    context.results.delete(fallbackStep.id)

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
        const limits: SecurityLimits = {
          maxDepth: this.maxExpansionDepth,
          maxSize: this.maxExpansionSize,
          timeout: 500, // Using default timeout for now
        }
        const result = evaluateCondition(
          conditions.if,
          evalContext,
          this.strictConditions,
          limits,
        )
        if (!result) return false
      }

      // Evaluate 'unless' condition
      if (conditions.unless) {
        const limits: SecurityLimits = {
          maxDepth: this.maxExpansionDepth,
          maxSize: this.maxExpansionSize,
          timeout: 500, // Using default timeout for now
        }
        const result = evaluateCondition(
          conditions.unless,
          evalContext,
          this.strictConditions,
          limits,
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
        const limits: SecurityLimits = {
          maxDepth: this.maxExpansionDepth,
          maxSize: this.maxExpansionSize,
        }
        resolvedInput[key] = resolveMapping(value, evalContext, limits)
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
   *
   * Currently performs simple byte-based truncation to 90% of the limit.
   * Future enhancement: Consider adding safe JSON preview that shows
   * truncation point with ellipsis or partial data structure preservation.
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
    // Check if it's already an ExecutionError using proper type guard
    if (isExecutionError(error)) {
      // It's already an ExecutionError, just add stepId if missing
      if (stepId && !error.stepId) {
        return { ...error, stepId }
      }
      return error
    }

    // Map resilience errors to appropriate ExecutionError codes
    // Use inline type guards to avoid import dependencies
    if (
      error instanceof Error &&
      error.name === 'TimeoutError' &&
      'timeoutMs' in error
    ) {
      const timeoutError = error as Error & {
        timeoutMs: number
        operationName?: string
      }
      return createExecutionError(ExecutionErrorCode.TIMEOUT, error.message, {
        stepId,
        cause: error,
        context: {
          timeoutMs: timeoutError.timeoutMs,
          operationName: timeoutError.operationName,
        },
      })
    }

    if (
      error instanceof Error &&
      error.name === 'CircuitBreakerOpenError' &&
      'circuitKey' in error &&
      'nextRetryTime' in error
    ) {
      const circuitError = error as Error & {
        circuitKey: string
        nextRetryTime: number
        consecutiveFailures: number
      }
      return createExecutionError(
        ExecutionErrorCode.CIRCUIT_BREAKER_OPEN,
        error.message,
        {
          stepId,
          cause: error,
          context: {
            circuitKey: circuitError.circuitKey,
            nextRetryTime: circuitError.nextRetryTime,
            consecutiveFailures: circuitError.consecutiveFailures,
          },
        },
      )
    }

    if (
      error instanceof Error &&
      error.name === 'RetryExhaustedError' &&
      'attempts' in error
    ) {
      const retryError = error as Error & {
        attempts: number
        lastError?: unknown
      }
      return createExecutionError(ExecutionErrorCode.RETRYABLE, error.message, {
        stepId,
        cause: error,
        context: {
          attempts: retryError.attempts,
          lastError: retryError.lastError,
        },
      })
    }

    // Fall back to UNKNOWN for unrecognized errors
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
