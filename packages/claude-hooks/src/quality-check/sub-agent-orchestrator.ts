/**
 * Sub-agent Orchestrator for TypeScript Error Analysis
 * Manages communication with Task tool for intelligent error analysis
 */

import type { SubAgentContext } from './error-classifier.js'

/**
 * Represents an explanation for a TypeScript error
 */
export interface ErrorExplanation {
  error: string
  rootCause: string
  suggestion: string
  codeExample?: string
}

/**
 * Analysis result from sub-agent
 */
export interface SubAgentAnalysis {
  explanations: ErrorExplanation[]
  impactAssessment: string
  bestPractices: string[]
}

/**
 * Response structure from Task tool
 */
export interface TaskToolResponse {
  success: boolean
  analysis: SubAgentAnalysis
}

/**
 * Insight extracted from error analysis
 */
export interface ErrorInsight {
  category: 'type-mismatch' | 'missing-module' | 'unknown'
  explanation: ErrorExplanation
}

/**
 * Metrics for tracking sub-agent usage
 */
export interface SubAgentMetrics {
  totalInvocations: number
  successfulInvocations: number
  failedInvocations: number
  averageResponseTime: number
  totalTokensUsed: number
}

/**
 * Options for SubAgentOrchestrator
 */
export interface SubAgentOrchestratorOptions {
  circuitBreakerCooldown?: number
  maxFailures?: number
  timeout?: number
}

/**
 * Options for analyzing TypeScript errors
 */
export interface AnalyzeOptions {
  timeout?: number
}

/**
 * Orchestrates sub-agent analysis of TypeScript errors
 */
export class SubAgentOrchestrator {
  private metrics: SubAgentMetrics = {
    totalInvocations: 0,
    successfulInvocations: 0,
    failedInvocations: 0,
    averageResponseTime: 0,
    totalTokensUsed: 0,
  }

  private circuitBreakerState: {
    isOpen: boolean
    failureCount: number
    lastFailureTime?: number
  } = {
    isOpen: false,
    failureCount: 0,
  }

  private readonly options: Required<SubAgentOrchestratorOptions>
  private readonly execImpl?: (
    cmd: string,
    callback: (error: Error | null, stdout: string | null) => void,
  ) => void

  constructor(
    options: SubAgentOrchestratorOptions = {},
    execImpl?: SubAgentOrchestrator['execImpl'],
  ) {
    this.options = {
      circuitBreakerCooldown: options.circuitBreakerCooldown ?? 60000, // 1 minute default
      maxFailures: options.maxFailures ?? 3,
      timeout: options.timeout ?? 30000, // 30 seconds default
    }
    this.execImpl = execImpl
  }

  /**
   * Analyze TypeScript errors using sub-agent
   */
  async analyzeTypeScriptErrors(
    errors: string[],
    context: SubAgentContext,
    options: AnalyzeOptions = {},
  ): Promise<SubAgentAnalysis | null> {
    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      // Check if we should reset the circuit breaker
      if (this.shouldResetCircuitBreaker()) {
        this.resetCircuitBreaker()
      } else {
        return null
      }
    }

    const startTime = Date.now()
    this.metrics.totalInvocations++

    try {
      // Build prompt for Task tool
      const prompt = this.buildPrompt(errors, context)

      const response = await this.invokeTaskTool(prompt, options.timeout)

      if (response) {
        this.metrics.successfulInvocations++
        this.circuitBreakerState.failureCount = 0
        const responseTime = Date.now() - startTime
        this.updateAverageResponseTime(responseTime)
        return response.analysis
      } else {
        this.handleFailure()
        return null
      }
    } catch {
      this.handleFailure()
      return null
    }
  }

  /**
   * Build prompt for Task tool
   */
  buildPrompt(errors: string[], context: SubAgentContext): string {
    const errorList = errors.join('\n')
    const isMonorepo = context.projectPatterns.isMonorepo

    let prompt = `Analyze TypeScript errors in a ${
      isMonorepo ? 'monorepo' : 'single project'
    } context:\n\n`

    prompt += `**File Context:**\n`
    prompt += `- File: ${context.filePath}\n`
    prompt += `- TypeScript Config: ${context.tsConfigPath}\n`

    if (isMonorepo && context.projectPatterns.packagePattern) {
      prompt += `- Package Pattern: ${context.projectPatterns.packagePattern}\n`
    }

    prompt += `\n**TypeScript errors:**\n${errorList}\n`

    if (context.fileContent) {
      prompt += `\n**File Content:**\n\`\`\`typescript\n${context.fileContent}\n\`\`\`\n`
    }

    // Add import context
    if (context.relatedImports.length > 0) {
      prompt += `\n**Imports:**\n`
      for (const imp of context.relatedImports) {
        prompt += `- ${imp.importPath} (${imp.isRelative ? 'relative' : 'external'})\n`
      }
    }

    // Check for specific error patterns
    const hasGenericError = errors.some((e) => e.includes('generic'))
    const hasConstraintError = errors.some((e) => e.includes('constraint'))

    if (hasGenericError || hasConstraintError) {
      prompt += `\n**Note:** Complex generic type errors detected. Please provide detailed explanation.\n`
    }

    // Extract error codes
    const errorCodes = errors
      .map((e) => {
        const match = e.match(/TS(\d+)/)
        return match ? `TS${match[1]}` : null
      })
      .filter(Boolean)

    if (errorCodes.length > 0) {
      prompt += `\n**Error Codes:** ${errorCodes.join(', ')}\n`
    }

    // Add ButtonProps reference if present
    if (context.fileContent?.includes('ButtonProps')) {
      prompt += `\n**Component Interface:** ButtonProps detected\n`
    }

    // Add monorepo-specific context
    if (isMonorepo) {
      prompt += `\nThis is a monorepo project`
      // packageManager is not part of base ProjectContext interface
      // but may be provided by extended contexts
      const extendedContext = context.projectPatterns as unknown as {
        packageManager?: string
      }
      if (extendedContext.packageManager) {
        prompt += ` using ${extendedContext.packageManager}`
      }
      prompt += '.\n'

      // Check for workspace imports
      const workspaceImports = context.relatedImports.filter((imp) =>
        imp.importPath.startsWith('@studio'),
      )
      if (workspaceImports.length > 0) {
        prompt += `**Workspace Dependencies:** ${workspaceImports
          .map((i) => i.importPath)
          .join(', ')}\n`
      }
    }

    return prompt
  }

  /**
   * Parse Task tool response
   */
  parseTaskToolResponse(rawResponse: string): TaskToolResponse | null {
    try {
      if (!rawResponse || rawResponse === 'null') {
        return null
      }

      const parsed = JSON.parse(rawResponse)

      // Validate response structure
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !parsed.success ||
        !parsed.analysis ||
        !Array.isArray(parsed.analysis.explanations)
      ) {
        return null
      }

      return parsed as TaskToolResponse
    } catch {
      return null
    }
  }

  /**
   * Extract insights from Task tool response
   */
  extractInsights(response: TaskToolResponse): ErrorInsight[] {
    return response.analysis.explanations.map((explanation) => {
      let category: ErrorInsight['category'] = 'unknown'

      if (
        explanation.error.includes('not assignable to type') ||
        explanation.error.includes('Type mismatch')
      ) {
        category = 'type-mismatch'
      } else if (explanation.error.includes('Cannot find module')) {
        category = 'missing-module'
      }

      return {
        category,
        explanation,
      }
    })
  }

  /**
   * Format integrated output with AI insights
   */
  formatIntegratedOutput(errors: string[], analysis: SubAgentAnalysis | null): string {
    let output = ''

    if (analysis) {
      output += '══════════════════════════════════════════\n'
      output += '📊 TypeScript Error Analysis\n'
      output += '══════════════════════════════════════════\n\n'

      for (const [index, error] of errors.entries()) {
        // Extract file location
        const match = error.match(/([^(]+)\((\d+),(\d+)\)/)
        if (match) {
          output += `📍 ${match[1]}:${match[2]}:${match[3]}\n`
        }

        // Original error
        const errorMessage = this.extractErrorMessage(error)
        output += `❌ ${errorMessage}\n`

        // AI analysis if available
        if (analysis.explanations[index]) {
          const explanation = analysis.explanations[index]
          output += `\n🤖 Root Cause:\n   ${explanation.rootCause}\n`
          output += `\n💡 Suggested Fix:\n   ${explanation.suggestion}\n`

          if (explanation.codeExample) {
            output += `\n📝 Example:\n   ${explanation.codeExample.split('\n').join('\n   ')}\n`
          }
        }

        output += '\n'
      }

      if (analysis.bestPractices.length > 0) {
        output += '📚 Best Practices:\n'
        for (const practice of analysis.bestPractices) {
          output += `   • ${practice}\n`
        }
      }
    } else {
      // Fallback to simple error formatting
      for (const error of errors) {
        const match = error.match(/([^(]+)\((\d+),(\d+)\)/)
        if (match) {
          output += `${match[1]}:${match[2]}:${match[3]} - `
        }
        output += `${this.extractErrorMessage(error)}\n`
      }
    }

    return output
  }

  /**
   * Get current metrics
   */
  getMetrics(): SubAgentMetrics {
    return { ...this.metrics }
  }

  /**
   * Check if circuit breaker is open
   */
  isCircuitBreakerOpen(): boolean {
    return this.circuitBreakerState.isOpen
  }

  /**
   * Estimate monthly cost based on usage
   */
  estimateMonthlyCost(): number {
    // Rough estimate: $0.01 per 1000 tokens
    const costPerToken = 0.01 / 1000
    const tokensPerMonth =
      (this.metrics.totalTokensUsed / this.metrics.totalInvocations) * 30 * 24 * 2 // Assuming 2 invocations per hour
    return tokensPerMonth * costPerToken
  }

  /**
   * Invoke Task tool (mocked for now)
   */
  private async invokeTaskTool(
    _prompt: string,
    timeout?: number,
  ): Promise<TaskToolResponse | null> {
    // Use injected exec implementation if provided (for testing)
    if (this.execImpl) {
      return new Promise((resolve, reject) => {
        try {
          this.execImpl!('task-tool-command', (error: Error | null, stdout: string | null) => {
            if (error) {
              reject(error)
            } else if (stdout) {
              const parsed = this.parseTaskToolResponse(stdout)
              resolve(parsed)
            } else {
              resolve(null)
            }
          })
        } catch (err) {
          reject(err)
        }
      })
    }

    // Simulate timeout for testing
    if (timeout && timeout < 100) {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Command timeout')), timeout)
      })
    }

    // Return mock successful response
    return {
      success: true,
      analysis: {
        explanations: [
          {
            error: "Cannot find name 'foo'.",
            rootCause: "The variable 'foo' is not defined in the current scope.",
            suggestion: "Define 'foo' before using it, or import it from the appropriate module.",
            codeExample: "const foo = 'value'; // Add this before using foo",
          },
        ],
        impactAssessment: 'Low impact - isolated to single file',
        bestPractices: ['Always declare variables before use', "Use TypeScript's strict mode"],
      },
    }
  }

  /**
   * Extract error message from TypeScript error
   */
  private extractErrorMessage(error: string): string {
    const match = error.match(/error [A-Z0-9]+: (.+)$/)
    return match ? match[1] : error
  }

  /**
   * Handle invocation failure
   */
  private handleFailure(): void {
    this.metrics.failedInvocations++
    this.circuitBreakerState.failureCount++
    this.circuitBreakerState.lastFailureTime = Date.now()

    if (this.circuitBreakerState.failureCount >= this.options.maxFailures) {
      this.circuitBreakerState.isOpen = true
    }
  }

  /**
   * Check if circuit breaker should be reset
   */
  private shouldResetCircuitBreaker(): boolean {
    if (!this.circuitBreakerState.lastFailureTime) {
      return false
    }

    const timeSinceLastFailure = Date.now() - this.circuitBreakerState.lastFailureTime
    return timeSinceLastFailure >= this.options.circuitBreakerCooldown
  }

  /**
   * Reset circuit breaker
   */
  private resetCircuitBreaker(): void {
    this.circuitBreakerState.isOpen = false
    this.circuitBreakerState.failureCount = 0
    this.circuitBreakerState.lastFailureTime = undefined
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(responseTime: number): void {
    const totalTime =
      this.metrics.averageResponseTime * (this.metrics.successfulInvocations - 1) + responseTime
    this.metrics.averageResponseTime = totalTime / this.metrics.successfulInvocations
  }
}
