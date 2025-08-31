#!/usr/bin/env tsx
/**
 * Quality Analysis Tool - P2.1 Rule Calibration
 *
 * Analyzes actual codebase complexity metrics to calibrate ESLint thresholds
 * intelligently based on data rather than arbitrary limits.
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import {
  createResult,
  formatOutput,
  parseOutputArgs,
  ProgressIndicator,
  type OutputResult,
} from './lib/output-formatter'
import { isCI } from './lib/workspace-utils'

interface ComplexityMetrics {
  file: string
  lineCount: number
  functionCount: number
  avgFunctionLines: number
  maxFunctionLines: number
  cyclomaticComplexity: number
  cognitiveComplexity: number
  parameterCounts: number[]
  nestingDepths: number[]
}

interface QualityBaseline {
  timestamp: string
  files: {
    analyzed: number
    sourceFiles: number
    testFiles: number
    declarationFiles: {
      total: number
      handwritten: number
      generated: number
    }
  }
  complexity: {
    averageLines: number
    maxLines: number
    p90Lines: number
    p95Lines: number
    averageCyclomaticComplexity: number
    maxCyclomaticComplexity: number
    p90CyclomaticComplexity: number
    p95CyclomaticComplexity: number
  }
  recommendations: {
    maxLinesPerFunction: number
    cyclomaticComplexityThreshold: number
    cognitiveComplexityThreshold: number
    rationale: string
  }
}

/**
 * Analyze TypeScript/JavaScript files for complexity metrics
 */
async function analyzeComplexity(progress?: ProgressIndicator): Promise<ComplexityMetrics[]> {
  const files = getSourceFiles()
  const metrics: ComplexityMetrics[] = []

  progress?.update({
    message: `Analyzing ${files.length} files...`,
    total: files.length,
    current: 0,
  })

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    progress?.update({ current: i + 1 })

    try {
      const content = readFileSync(file, 'utf-8')
      const fileMetrics = analyzeFileComplexity(file, content)
      metrics.push(fileMetrics)
    } catch (error) {
      console.warn(`Failed to analyze ${file}: ${error}`)
    }
  }

  return metrics
}

/**
 * Get project source files (excluding node_modules, dist, etc.)
 */
function getSourceFiles(): string[] {
  try {
    const output = execSync(
      'find {apps,packages,scripts,tests} -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v dist | grep -v .next',
      { encoding: 'utf-8' },
    )
    return output.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Analyze complexity metrics for a single file
 */
function analyzeFileComplexity(file: string, content: string): ComplexityMetrics {
  const lines = content.split('\n')
  const lineCount = lines.length

  // Simple regex-based function detection (good enough for calibration)
  const functionRegex =
    /(?:function\s+\w+|const\s+\w+\s*=\s*(?:\([^)]*\)\s*=>|\([^)]*\)\s*:\s*[^=]*=>|async\s*\([^)]*\)\s*=>)|\w+\s*\([^)]*\)\s*:\s*[^{]*\{)/g
  const functions = content.match(functionRegex) || []

  // Calculate rough metrics
  const functionCount = functions.length
  const avgFunctionLines = functionCount > 0 ? Math.round(lineCount / functionCount) : 0

  // Estimate max function size by finding longest block between function keywords
  const functionStarts = []
  let match
  const regex = new RegExp(functionRegex.source, 'g')
  while ((match = regex.exec(content)) !== null) {
    functionStarts.push(content.substring(0, match.index).split('\n').length)
  }

  let maxFunctionLines = 0
  for (let i = 0; i < functionStarts.length - 1; i++) {
    const functionLength = functionStarts[i + 1] - functionStarts[i]
    if (functionLength > maxFunctionLines) {
      maxFunctionLines = functionLength
    }
  }

  // Simple complexity estimates
  const cyclomaticComplexity = (content.match(/if|else|while|for|switch|catch|\?/g) || []).length
  const cognitiveComplexity =
    cyclomaticComplexity + (content.match(/&&|\|\||break|continue/g) || []).length

  // Parameter counts (rough estimate)
  const parameterCounts = functions.map((fn) => {
    const paramMatch = fn.match(/\(([^)]*)\)/)
    if (!paramMatch) return 0
    const params = paramMatch[1].split(',').filter((p) => p.trim())
    return params.length
  })

  // Nesting depth (rough estimate by counting braces)
  const nestingDepths = lines.map((line) => {
    const opens = (line.match(/\{/g) || []).length
    const closes = (line.match(/\}/g) || []).length
    return opens - closes
  })

  return {
    file,
    lineCount,
    functionCount,
    avgFunctionLines,
    maxFunctionLines,
    cyclomaticComplexity,
    cognitiveComplexity,
    parameterCounts,
    nestingDepths,
  }
}

/**
 * Calculate percentiles from array of numbers
 */
function calculatePercentile(values: number[], percentile: number): number {
  const sorted = values.sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)] || 0
}

/**
 * Generate quality baseline and recommendations
 */
function generateBaseline(metrics: ComplexityMetrics[]): QualityBaseline {
  const sourceFiles = metrics.filter(
    (m) => !m.file.includes('.test.') && !m.file.includes('.spec.'),
  )
  const testFiles = metrics.filter((m) => m.file.includes('.test.') || m.file.includes('.spec.'))

  // Declaration file analysis
  const declarationFiles = getDeclarationFileInfo()

  // Calculate function line distributions
  const functionLines = sourceFiles
    .flatMap((m) => Array.from({ length: m.functionCount }, () => m.avgFunctionLines))
    .filter((l) => l > 0)

  const cyclomaticValues = sourceFiles.map((m) => m.cyclomaticComplexity).filter((c) => c > 0)

  const averageLines =
    functionLines.length > 0
      ? Math.round(functionLines.reduce((a, b) => a + b, 0) / functionLines.length)
      : 0

  const maxLines = Math.max(...sourceFiles.map((m) => m.maxFunctionLines), 0)
  const p90Lines = calculatePercentile(functionLines, 90)
  const p95Lines = calculatePercentile(functionLines, 95)

  const averageCyclomatic =
    cyclomaticValues.length > 0
      ? Math.round(cyclomaticValues.reduce((a, b) => a + b, 0) / cyclomaticValues.length)
      : 0

  const maxCyclomatic = Math.max(...cyclomaticValues, 0)
  const p90Cyclomatic = calculatePercentile(cyclomaticValues, 90)
  const p95Cyclomatic = calculatePercentile(cyclomaticValues, 95)

  // Generate intelligent recommendations
  const recommendedMaxLines = Math.max(75, p95Lines + 10) // Allow P95 + buffer, minimum 75
  const recommendedCyclomaticThreshold = Math.max(10, p90Cyclomatic + 2) // P90 + buffer, minimum 10
  const recommendedCognitiveThreshold = Math.max(15, recommendedCyclomaticThreshold + 5)

  const rationale =
    `Based on analysis of ${sourceFiles.length} source files: ` +
    `P95 function length is ${p95Lines} lines, P90 cyclomatic complexity is ${p90Cyclomatic}. ` +
    `Recommendations set to allow current patterns while preventing outliers.`

  return {
    timestamp: new Date().toISOString(),
    files: {
      analyzed: metrics.length,
      sourceFiles: sourceFiles.length,
      testFiles: testFiles.length,
      declarationFiles,
    },
    complexity: {
      averageLines,
      maxLines,
      p90Lines,
      p95Lines,
      averageCyclomaticComplexity: averageCyclomatic,
      maxCyclomaticComplexity: maxCyclomatic,
      p90CyclomaticComplexity: p90Cyclomatic,
      p95CyclomaticComplexity: p95Cyclomatic,
    },
    recommendations: {
      maxLinesPerFunction: recommendedMaxLines,
      cyclomaticComplexityThreshold: recommendedCyclomaticThreshold,
      cognitiveComplexityThreshold: recommendedCognitiveThreshold,
      rationale,
    },
  }
}

/**
 * Analyze declaration files to distinguish handwritten from generated
 */
function getDeclarationFileInfo(): { total: number; handwritten: number; generated: number } {
  try {
    const output = execSync(
      'find {apps,packages,scripts,tests} -name "*.d.ts" | grep -v node_modules',
      { encoding: 'utf-8' },
    )
    const files = output.trim().split('\n').filter(Boolean)

    let handwritten = 0
    let generated = 0

    for (const file of files) {
      if (file.includes('/dist/') || file.includes('/dist-types/') || file.includes('/.next/')) {
        generated++
      } else {
        handwritten++
      }
    }

    return {
      total: files.length,
      handwritten,
      generated,
    }
  } catch {
    return { total: 0, handwritten: 0, generated: 0 }
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const startTime = Date.now()
  const options = parseOutputArgs()

  const progress = !options.quiet && !isCI() ? new ProgressIndicator(options) : undefined

  try {
    progress?.start('Analyzing codebase complexity')

    const metrics = await analyzeComplexity(progress)
    const baseline = generateBaseline(metrics)

    progress?.update({ message: 'Generating recommendations...' })

    // Save baseline for future reference
    const baselinePath = '.quality-baseline.json'
    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2))

    progress?.stop('Quality analysis complete')

    const result: OutputResult = createResult(true, 'Quality analysis complete', baseline)
    result.metadata!.duration = Date.now() - startTime

    console.log(formatOutput(result, options))

    // Show recommendations in text mode
    if (options.format !== 'json') {
      console.log('\n📋 Calibration Recommendations:')
      console.log(
        `• max-lines-per-function: ${baseline.recommendations.maxLinesPerFunction} (current: 75)`,
      )
      console.log(
        `• complexity: ${baseline.recommendations.cyclomaticComplexityThreshold} (current: 15)`,
      )
      console.log(
        `• cognitive-complexity: ${baseline.recommendations.cognitiveComplexityThreshold} (current: 20)`,
      )
      console.log(`\n💡 ${baseline.recommendations.rationale}`)
    }
  } catch (error) {
    progress?.error('Quality analysis failed')

    const result = createResult(false, 'Quality analysis failed')
    result.errors = [
      {
        code: 'ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
    ]

    console.error(formatOutput(result, options))
    process.exit(1)
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
