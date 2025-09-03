/**
 * Enhanced printSummary with sub-agent integration
 * Extends the existing quality check summary with AI-powered TypeScript error analysis
 */

import type { SubAgentContext } from './error-classifier.js'
import type { SubAgentAnalysis } from './sub-agent-orchestrator.js'
import type { TypeScriptConfigCache } from './typescript-cache.js'

import { createQualityLogger } from '../utils/logger.js'
import { SubAgentContextBuilder } from './context-builder.js'
import { createErrorClassifier } from './error-classifier.js'
import { SubAgentOrchestrator } from './sub-agent-orchestrator.js'

// Define colors inline to avoid import issues
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

/**
 * Enhanced printSummary that integrates sub-agent analysis for unfixable errors
 * Maintains backward compatibility while adding intelligent insights
 */
export async function printSummaryWithSubAgent(
  errors: string[],
  autofixes: string[],
  filePath: string,
  tsConfigCache: TypeScriptConfigCache,
): Promise<void> {
  // Show auto-fixes if any (preserve existing behavior)
  if (autofixes.length > 0) {
    console.error(`\n${colors.blue}═══ Auto-fixes Applied ═══${colors.reset}`)
    for (const fix of autofixes) {
      console.error(`${colors.green}✨${colors.reset} ${fix}`)
    }
    console.error(
      `${colors.green}Automatically fixed ${autofixes.length} issue(s) for you!${colors.reset}`,
    )
  }

  // Show errors if any (preserve existing behavior)
  if (errors.length > 0) {
    console.error(`\n${colors.blue}═══ Quality Check Summary ═══${colors.reset}`)
    for (const error of errors) {
      console.error(`${colors.red}❌${colors.reset} ${String(error)}`)
    }

    // Try to enhance with sub-agent analysis
    try {
      const { logger } = createQualityLogger('print-summary-enhanced')
      const contextLogger = logger.child({
        filePath,
        errorCount: errors.length,
        operation: 'sub-agent-enhancement',
      })

      contextLogger.debug('Starting sub-agent enhancement')
      await enhanceWithSubAgentAnalysis(errors, filePath, tsConfigCache, contextLogger)
    } catch (error) {
      // Silently fail - don't break existing functionality
      const { logger } = createQualityLogger('print-summary-enhanced')
      logger.error('Sub-agent enhancement failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filePath,
        errorCount: errors.length,
      })
    }
  }

  // Final summary messages (preserve existing behavior)
  if (errors.length > 0) {
    console.error(
      `\n${colors.red}Found ${errors.length} issue(s) that MUST be fixed!${colors.reset}`,
    )
    console.error(`${colors.red}════════════════════════════════════════════${colors.reset}`)
    console.error(`${colors.red}❌ ALL ISSUES ARE BLOCKING ❌${colors.reset}`)
    console.error(`${colors.red}════════════════════════════════════════════${colors.reset}`)
    console.error(`${colors.red}Fix EVERYTHING above until all checks are ✅ GREEN${colors.reset}`)
  }
}

/**
 * Enhance error output with sub-agent analysis
 */
async function enhanceWithSubAgentAnalysis(
  errors: string[],
  filePath: string,
  tsConfigCache: TypeScriptConfigCache,
  logger: ReturnType<typeof createQualityLogger>['logger'],
): Promise<void> {
  try {
    // Initialize components
    const classifier = createErrorClassifier()
    const contextBuilder = new SubAgentContextBuilder(tsConfigCache)
    const orchestrator = new SubAgentOrchestrator()

    // Check if sub-agent is available (circuit breaker, etc.)
    if (orchestrator.isCircuitBreakerOpen()) {
      logger.warn('Sub-agent analysis skipped: Circuit breaker is open', {
        operation: 'circuit-breaker-check',
      })
      return // Circuit breaker is open, skip analysis
    }

    // Filter TypeScript errors that need reasoning
    const typeScriptErrors = errors.filter((error) => {
      const isTypeScriptError = error.includes('TypeScript:')
      const isWorthy = classifier.isEscalationWorthy(error, {
        filePath,
        fileType: filePath.endsWith('.tsx') ? 'component' : 'module',
        hasAutoFixes: false,
      })

      logger.debug('Error classification analysis', {
        operation: 'error-classification',
        errorPreview: error.substring(0, 100),
        isTypeScriptError,
        isWorthy,
        errorLength: error.length,
      })

      return isTypeScriptError && isWorthy
    })

    logger.info('TypeScript error escalation analysis completed', {
      operation: 'escalation-analysis',
      typeScriptErrorsFound: typeScriptErrors.length,
      totalErrors: errors.length,
      escalationRate: typeScriptErrors.length / errors.length,
    })

    if (typeScriptErrors.length === 0) {
      logger.debug('No errors worth escalating - skipping sub-agent analysis', {
        operation: 'escalation-skip',
      })
      return // No errors worth escalating
    }

    // Build context for sub-agent
    const context = await buildSubAgentContext(
      typeScriptErrors,
      filePath,
      tsConfigCache,
      contextBuilder,
      classifier,
    )

    // Analyze with sub-agent
    const analysis = await orchestrator.analyzeTypeScriptErrors(typeScriptErrors, context)

    // Display AI insights if available
    if (analysis && hasActionableInsights(analysis)) {
      displayAIInsights(analysis, typeScriptErrors)
    }

    // Track metrics
    orchestrator.getMetrics() // This updates internal metrics
  } catch (error) {
    // Fail silently to maintain backward compatibility
    logger.error('Sub-agent analysis error', {
      operation: 'sub-agent-analysis-error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
  }
}

/**
 * Build comprehensive context for sub-agent analysis
 */
async function buildSubAgentContext(
  errors: string[],
  filePath: string,
  tsConfigCache: TypeScriptConfigCache,
  _contextBuilder: SubAgentContextBuilder,
  classifier: ReturnType<typeof createErrorClassifier>,
): Promise<SubAgentContext> {
  // Get base context from classifier
  const baseContext = classifier.extractContextForSubAgent(
    errors[0], // Use first error as representative
    filePath,
    tsConfigCache,
  )

  // Return the base context - the contextBuilder.buildContext method
  // would need the full errors array, which we can enhance later
  return baseContext
}

/**
 * Check if analysis has actionable insights
 */
function hasActionableInsights(analysis: SubAgentAnalysis): boolean {
  return analysis.explanations.length > 0 || analysis.bestPractices.length > 0
}

/**
 * Display AI-generated insights in a user-friendly format
 */
function displayAIInsights(analysis: SubAgentAnalysis, errors: string[]): void {
  console.error(`\n${colors.blue}═══ AI Analysis ═══${colors.reset}`)

  // Display explanations for each error
  for (const [index, explanation] of analysis.explanations.entries()) {
    const error = errors[index]
    if (error && explanation) {
      console.error(`\n${colors.yellow}📍 Error:${colors.reset} ${extractErrorCore(error)}`)
      console.error(`${colors.cyan}💡 Explanation:${colors.reset} ${explanation.rootCause}`)
      console.error(`${colors.green}✅ Suggestion:${colors.reset} ${explanation.suggestion}`)

      if (explanation.codeExample) {
        console.error(`${colors.blue}📝 Example:${colors.reset}`)
        console.error(formatCodeExample(explanation.codeExample))
      }
    }
  }

  // Display best practices if any
  if (analysis.bestPractices.length > 0) {
    console.error(`\n${colors.yellow}📚 Best Practices:${colors.reset}`)
    for (const practice of analysis.bestPractices) {
      console.error(`  • ${practice}`)
    }
  }

  // Display impact assessment
  if (analysis.impactAssessment) {
    console.error(`\n${colors.yellow}⚠️  Impact:${colors.reset} ${analysis.impactAssessment}`)
  }
}

/**
 * Extract core error message without file path and line numbers
 */
function extractErrorCore(error: string): string {
  // Remove file path and line numbers
  return error.replace(/^.*:\d+:\d+\s*-\s*/, '').trim()
}

/**
 * Format code example with proper indentation
 */
function formatCodeExample(code: string): string {
  return code
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n')
}

/**
 * Original printSummary function for backward compatibility
 */
export function printSummary(errors: string[], autofixes: string[]): void {
  // Show auto-fixes if any
  if (autofixes.length > 0) {
    console.error(`\n${colors.blue}═══ Auto-fixes Applied ═══${colors.reset}`)
    for (const fix of autofixes) {
      console.error(`${colors.green}✨${colors.reset} ${fix}`)
    }
    console.error(
      `${colors.green}Automatically fixed ${autofixes.length} issue(s) for you!${colors.reset}`,
    )
  }

  // Show errors if any
  if (errors.length > 0) {
    console.error(`\n${colors.blue}═══ Quality Check Summary ═══${colors.reset}`)
    for (const error of errors) {
      console.error(`${colors.red}❌${colors.reset} ${String(error)}`)
    }
  }
}
