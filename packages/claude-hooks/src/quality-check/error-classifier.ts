/**
 * Error Classification System for TypeScript Quality Checking
 * Determines which errors should be escalated to sub-agent analysis
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import type { TypeScriptConfigCache } from './typescript-cache.js'

export interface QualityCheckContext {
  filePath: string
  fileType: string
  hasAutoFixes: boolean
}

export interface TypeScriptErrorDetail {
  message: string
  lineNumber?: number
  category: 'auto-fixable' | 'needs-reasoning' | 'dependency-warning'
}

export interface ProjectContext {
  isMonorepo: boolean
  packagePattern?: string
  relativePath: string
}

export interface ImportAnalysis {
  importPath: string
  isRelative: boolean
  exports?: string[]
}

export interface SubAgentContext {
  filePath: string
  fileContent?: string
  tsConfigPath: string
  errorDetails: TypeScriptErrorDetail[]
  projectPatterns: ProjectContext
  relatedImports: ImportAnalysis[]
}

export interface ErrorClassifier {
  isEscalationWorthy(error: string, context: QualityCheckContext): boolean
  getErrorCategory(error: string): 'auto-fixable' | 'needs-reasoning' | 'dependency-warning'
  extractContextForSubAgent(
    error: string,
    filePath: string,
    tsCache: TypeScriptConfigCache,
  ): SubAgentContext
}

export interface SubAgentMetrics {
  totalInvocations: number
  successfulAnalyses: number
  failedAnalyses: number
  averageResponseTime: number
  costTracking: {
    estimatedTokens: number
    escalationRate: number
  }
}

/**
 * Implementation of ErrorClassifier interface
 */
export class ErrorClassifierImpl implements ErrorClassifier {
  private metrics: SubAgentMetrics = {
    totalInvocations: 0,
    successfulAnalyses: 0,
    failedAnalyses: 0,
    averageResponseTime: 0,
    costTracking: {
      estimatedTokens: 0,
      escalationRate: 0,
    },
  }

  /**
   * Determine if an error is worthy of sub-agent escalation
   */
  isEscalationWorthy(error: string, context: QualityCheckContext): boolean {
    if (!error || typeof error !== 'string') {
      return false
    }

    const category = this.getErrorCategory(error)

    // Only escalate errors that need reasoning and aren't in files with auto-fixes
    return category === 'needs-reasoning' && !context.hasAutoFixes
  }

  /**
   * Categorize error type for handling strategy
   */
  getErrorCategory(error: string): 'auto-fixable' | 'needs-reasoning' | 'dependency-warning' {
    if (!error || typeof error !== 'string') {
      return 'dependency-warning'
    }

    const errorLower = error.toLowerCase()

    // Auto-fixable patterns (formatting, linting)
    if (
      errorLower.includes('prettier') ||
      errorLower.includes('eslint') ||
      errorLower.includes('formatting') ||
      errorLower.includes('auto-fixed') ||
      errorLower.includes('semicolon') ||
      errorLower.includes('quotes') ||
      errorLower.includes('indentation') ||
      errorLower.includes('whitespace')
    ) {
      return 'auto-fixable'
    }

    // Dependency warnings (errors in imported files)
    if (
      errorLower.includes('dependency') ||
      errorLower.includes('imported') ||
      errorLower.includes('node_modules')
    ) {
      return 'dependency-warning'
    }

    // Complex TypeScript errors that need reasoning
    if (
      errorLower.includes('not assignable to type') ||
      errorLower.includes('does not exist on type') ||
      errorLower.includes('cannot find module') ||
      errorLower.includes('does not satisfy the constraint') ||
      errorLower.includes('incorrectly extends') ||
      errorLower.includes('no properties in common') ||
      errorLower.includes('promise<') ||
      errorLower.includes('generic') ||
      errorLower.includes('interface')
    ) {
      return 'needs-reasoning'
    }

    // Default to dependency warning for unknown patterns
    return 'dependency-warning'
  }

  /**
   * Extract rich context for sub-agent analysis
   */
  extractContextForSubAgent(
    error: string,
    filePath: string,
    tsCache: TypeScriptConfigCache,
  ): SubAgentContext {
    const tsConfigPath = tsCache.getTsConfigForFile(filePath) || ''

    // Build project context
    const projectPatterns = this.analyzeProjectPatterns(filePath)

    // Extract file content if available
    let fileContent: string | undefined
    try {
      if (existsSync(filePath)) {
        fileContent = readFileSync(filePath, 'utf8')
      }
    } catch {
      // File reading failed, continue without content
    }

    // Analyze imports from file content
    const relatedImports = this.extractImportAnalysis(fileContent || '')

    // Build error details
    const errorDetails: TypeScriptErrorDetail[] = [
      {
        message: error,
        category: this.getErrorCategory(error),
      },
    ]

    return {
      filePath,
      fileContent,
      tsConfigPath,
      errorDetails,
      projectPatterns,
      relatedImports,
    }
  }

  /**
   * Analyze project structure patterns
   */
  private analyzeProjectPatterns(filePath: string): ProjectContext {
    const isMonorepo = filePath.includes('/packages/') || filePath.includes('/apps/')
    const packagePattern = isMonorepo ? '@template/*' : undefined

    // Extract relative path from project root
    const pathParts = filePath.split('/')
    const projectRootIndex = Math.max(
      pathParts.lastIndexOf('packages'),
      pathParts.lastIndexOf('apps'),
      pathParts.lastIndexOf('src') - 1,
    )

    const relativePath =
      projectRootIndex > 0 ? pathParts.slice(projectRootIndex).join('/') : path.basename(filePath)

    return {
      isMonorepo,
      packagePattern,
      relativePath,
    }
  }

  /**
   * Extract import statements for context
   */
  private extractImportAnalysis(fileContent: string): ImportAnalysis[] {
    if (!fileContent) {
      return []
    }

    const imports: ImportAnalysis[] = []
    const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g
    let match

    while ((match = importRegex.exec(fileContent)) !== null) {
      const importPath = match[1]
      const isRelative = importPath.startsWith('./')

      imports.push({
        importPath,
        isRelative,
      })
    }

    return imports
  }

  /**
   * Get usage metrics for cost tracking
   */
  getMetrics(): SubAgentMetrics {
    return { ...this.metrics }
  }

  /**
   * Track a sub-agent invocation
   */
  trackInvocation(success: boolean, responseTime: number): void {
    this.metrics.totalInvocations++
    if (success) {
      this.metrics.successfulAnalyses++
    } else {
      this.metrics.failedAnalyses++
    }

    // Update average response time
    const totalTime =
      this.metrics.averageResponseTime * (this.metrics.totalInvocations - 1) + responseTime
    this.metrics.averageResponseTime = totalTime / this.metrics.totalInvocations
  }
}

/**
 * Create a new ErrorClassifier instance
 */
export function createErrorClassifier(): ErrorClassifier {
  return new ErrorClassifierImpl()
}
