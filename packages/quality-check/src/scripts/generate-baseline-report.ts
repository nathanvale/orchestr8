#!/usr/bin/env node
import { MemoryBaseline } from '../utils/memory-baseline'
import { MemoryProfiler } from '../utils/memory-profiler'
import { QualityChecker } from '../core/quality-checker'
import type { QualityCheckOptions } from '../types'
import { writeFileSync } from 'fs'
import { join } from 'path'

interface BaselineResult {
  operation: string
  averageHeapUsed: number
  peakHeapUsed: number
  potentialLeak: boolean
}

interface ComparisonResult {
  comparison: {
    memoryDifferencePercent: number
    memoryDifference: number
    summary: string
  }
}

const TEST_FILES = {
  small: ['src/utils/logger.ts'],
  medium: ['src/core/quality-checker.ts', 'src/engines/typescript-engine.ts'],
  large: [
    'src/core/quality-checker.ts',
    'src/engines/typescript-engine.ts',
    'src/engines/eslint-engine.ts',
    'src/engines/prettier-engine.ts',
    'src/core/file-batch-processor.ts',
  ],
}

async function runFileProcessingBaselines(
  baseline: MemoryBaseline,
  profiler: MemoryProfiler,
): Promise<BaselineResult[]> {
  const results: BaselineResult[] = []

  // Single file processing
  console.log('📝 Testing single file processing...')
  profiler.snapshot('single-file-start')
  const singleFileResult = await baseline.measure('Single File Check', async () => {
    const checker = new QualityChecker()
    await checker.check(TEST_FILES.small, {})
    checker.clearCaches()
  })
  profiler.snapshot('single-file-end')
  results.push(singleFileResult)
  console.log(baseline.formatResult(singleFileResult))
  console.log()

  // Medium batch processing
  console.log('📦 Testing medium batch processing...')
  profiler.snapshot('medium-batch-start')
  const mediumBatchResult = await baseline.measure('Medium Batch (2 files)', async () => {
    const checker = new QualityChecker()
    await checker.check(TEST_FILES.medium, {})
    checker.clearCaches()
  })
  profiler.snapshot('medium-batch-end')
  results.push(mediumBatchResult)
  console.log(baseline.formatResult(mediumBatchResult))
  console.log()

  // Large batch processing
  console.log('📚 Testing large batch processing...')
  profiler.snapshot('large-batch-start')
  const largeBatchResult = await baseline.measure('Large Batch (5 files)', async () => {
    const checker = new QualityChecker()
    await checker.check(TEST_FILES.large, {})
    checker.clearCaches()
  })
  profiler.snapshot('large-batch-end')
  results.push(largeBatchResult)
  console.log(baseline.formatResult(largeBatchResult))
  console.log()

  return results
}

async function runCacheComparison(baseline: MemoryBaseline): Promise<ComparisonResult> {
  console.log('🔄 Comparing cache strategies...')
  return await baseline.compare(
    {
      name: 'With Cache Clearing',
      fn: async () => {
        const checker = new QualityChecker()
        for (let i = 0; i < 3; i++) {
          await checker.check(TEST_FILES.small, {})
          checker.clearCaches()
        }
      },
    },
    {
      name: 'Without Cache Clearing',
      fn: async () => {
        const checker = new QualityChecker()
        for (let i = 0; i < 3; i++) {
          await checker.check(TEST_FILES.small, {})
        }
      },
    },
  )
}

async function runEngineComparison(baseline: MemoryBaseline): Promise<ComparisonResult> {
  console.log('⚙️ Comparing engine memory usage...')
  return await baseline.compare(
    {
      name: 'TypeScript Engine Only',
      fn: async () => {
        const checker = new QualityChecker()
        const options: QualityCheckOptions = {
          typescript: true,
          eslint: false,
          prettier: false,
        }
        await checker.check(TEST_FILES.medium, options)
        checker.clearCaches()
      },
    },
    {
      name: 'ESLint Engine Only',
      fn: async () => {
        const checker = new QualityChecker()
        const options: QualityCheckOptions = {
          typescript: false,
          eslint: true,
          prettier: false,
        }
        await checker.check(TEST_FILES.medium, options)
        checker.clearCaches()
      },
    },
  )
}

/**
 * Generate comprehensive memory baseline report for quality-check operations
 */
async function generateBaselineReport() {
  console.log('🔬 Generating Memory Baseline Report...\n')

  const baseline = new MemoryBaseline({
    iterations: 5,
    warmupIterations: 2,
    forceGc: true,
    delayBetweenRuns: 200,
  })

  const profiler = new MemoryProfiler()

  // Run all baseline tests
  const results = await runFileProcessingBaselines(baseline, profiler)
  const cacheComparison = await runCacheComparison(baseline)
  const engineComparison = await runEngineComparison(baseline)

  console.log(cacheComparison.comparison.summary)
  console.log()
  console.log(engineComparison.comparison.summary)
  console.log()

  // Generate comprehensive report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: results.length,
      averageMemoryUsage: results.reduce((sum, r) => sum + r.averageHeapUsed, 0) / results.length,
      peakMemoryUsage: Math.max(...results.map((r) => r.peakHeapUsed)),
      potentialLeaks: results.filter((r) => r.potentialLeak).length,
    },
    baselines: results,
    comparisons: {
      cacheStrategy: cacheComparison.comparison,
      engineMemory: engineComparison.comparison,
    },
    memoryProfile: profiler.getReport(),
    recommendations: generateRecommendations(results, cacheComparison, engineComparison),
  }

  // Save report to file
  const reportPath = join(process.cwd(), 'memory-baseline-report.json')
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n✅ Report saved to: ${reportPath}`)

  // Print final memory profile
  console.log('\n' + profiler.formatReport())

  // Check for memory leaks
  const leaks = profiler.detectLeaks()
  if (leaks.potentialLeak) {
    console.log(`\n⚠️ Warning: ${leaks.reason}`)
    console.log(`Growth rate: ${leaks.growthRate}%`)
  }

  return report
}

function generateRecommendations(
  results: BaselineResult[],
  cacheComparison: ComparisonResult,
  engineComparison: ComparisonResult,
): string[] {
  const recommendations: string[] = []

  // Check if memory grows with file count
  const singleFile = results.find((r) => r.operation.includes('Single'))
  const largeFile = results.find((r) => r.operation.includes('Large'))

  if (singleFile && largeFile) {
    const growthRatio = largeFile.averageHeapUsed / singleFile.averageHeapUsed
    if (growthRatio > 3) {
      recommendations.push(
        `Memory usage grows ${growthRatio.toFixed(1)}x with file count. Consider batch size optimization.`,
      )
    }
  }

  // Check cache clearing impact
  if (cacheComparison.comparison.memoryDifferencePercent > 20) {
    recommendations.push(
      `Cache clearing reduces memory by ${Math.abs(cacheComparison.comparison.memoryDifferencePercent).toFixed(0)}%. Implement automatic cache management.`,
    )
  }

  // Check engine memory differences
  if (Math.abs(engineComparison.comparison.memoryDifferencePercent) > 30) {
    const heavierEngine = engineComparison.comparison.memoryDifference > 0 ? 'ESLint' : 'TypeScript'
    recommendations.push(
      `${heavierEngine} engine uses ${Math.abs(engineComparison.comparison.memoryDifferencePercent).toFixed(0)}% more memory. Consider optimization.`,
    )
  }

  // Check for potential leaks
  const leakyOperations = results.filter((r) => r.potentialLeak)
  if (leakyOperations.length > 0) {
    recommendations.push(
      `${leakyOperations.length} operations show potential memory leaks. Investigate: ${leakyOperations.map((o) => o.operation).join(', ')}`,
    )
  }

  // General recommendations based on peak memory
  const peakMemory = Math.max(...results.map((r) => r.peakHeapUsed))
  if (peakMemory > 500) {
    recommendations.push('Peak memory exceeds 500MB. Consider implementing memory limits.')
  }

  if (recommendations.length === 0) {
    recommendations.push('Memory usage is within acceptable limits. No immediate action required.')
  }

  return recommendations
}

// Run if executed directly
if (require.main === module) {
  generateBaselineReport()
    .then(() => {
      console.log('\n✨ Baseline report generation complete!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Error generating baseline report:', error)
      process.exit(1)
    })
}

export { generateBaselineReport }
