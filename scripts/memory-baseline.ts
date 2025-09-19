#!/usr/bin/env node

/**
 * Memory Baseline Capture Script
 * Captures comprehensive memory metrics for test suite optimization
 */

import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

interface MemoryBaseline {
  timestamp: string
  summary: {
    peak_memory_mb: number
    avg_memory_mb: number
    total_tests: number
    duration_ms: number
    test_files: number
  }
  detailed_metrics: {
    heap_used: number[]
    heap_total: number[]
    external: number[]
    rss: number[]
    timestamps: string[]
  }
  test_file_metrics: Array<{
    file: string
    memory_before_mb: number
    memory_after_mb: number
    memory_delta_mb: number
  }>
  analysis: {
    memory_growth_trend: 'increasing' | 'stable' | 'decreasing'
    potential_leaks: string[]
    high_memory_tests: string[]
    recommendations: string[]
  }
}

class MemoryBaselineCapture {
  private metrics: MemoryBaseline
  private startTime: number = Date.now()

  constructor() {
    this.metrics = {
      timestamp: new Date().toISOString(),
      summary: {
        peak_memory_mb: 0,
        avg_memory_mb: 0,
        total_tests: 0,
        duration_ms: 0,
        test_files: 0,
      },
      detailed_metrics: {
        heap_used: [],
        heap_total: [],
        external: [],
        rss: [],
        timestamps: [],
      },
      test_file_metrics: [],
      analysis: {
        memory_growth_trend: 'stable',
        potential_leaks: [],
        high_memory_tests: [],
        recommendations: [],
      },
    }
  }

  async captureBaseline(): Promise<void> {
    console.log('🔍 Starting memory baseline capture...')

    // Ensure metrics directory exists
    const metricsDir = path.join(process.cwd(), '.claude/metrics')
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true })
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }

    try {
      await this.runTestsWithMemoryTracking()
      await this.analyzeResults()
      await this.generateReport()

      console.log('✅ Memory baseline capture completed successfully')
    } catch (error) {
      console.error('❌ Memory baseline capture failed:', error)
      throw error
    }
  }

  private async runTestsWithMemoryTracking(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🧪 Running test suite with memory tracking...')

      const testProcess = spawn('pnpm', ['test'], {
        stdio: 'pipe',
        env: {
          ...process.env,
          MEMORY_DEBUG: 'true',
          MEMORY_TREND_REPORT: 'true',
          NODE_OPTIONS: '--expose-gc --max-old-space-size=4096',
        },
      })

      let output = ''
      let errorOutput = ''

      // Track memory every 1 second during test execution
      const memoryInterval = setInterval(() => {
        this.captureMemorySnapshot()
      }, 1000)

      testProcess.stdout.on('data', (data) => {
        output += data.toString()
      })

      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      testProcess.on('close', (code) => {
        clearInterval(memoryInterval)

        this.metrics.summary.duration_ms = Date.now() - this.startTime

        if (code === 0) {
          this.parseTestOutput(output)
          resolve()
        } else {
          console.error('Test execution failed:', errorOutput)
          reject(new Error(`Test process exited with code ${code}`))
        }
      })

      testProcess.on('error', (error) => {
        clearInterval(memoryInterval)
        reject(error)
      })
    })
  }

  private captureMemorySnapshot(): void {
    const memUsage = process.memoryUsage()

    this.metrics.detailed_metrics.heap_used.push(Math.round(memUsage.heapUsed / 1024 / 1024))
    this.metrics.detailed_metrics.heap_total.push(Math.round(memUsage.heapTotal / 1024 / 1024))
    this.metrics.detailed_metrics.external.push(Math.round(memUsage.external / 1024 / 1024))
    this.metrics.detailed_metrics.rss.push(Math.round(memUsage.rss / 1024 / 1024))
    this.metrics.detailed_metrics.timestamps.push(new Date().toISOString())

    // Update peak memory
    const currentMemoryMB = Math.round(memUsage.rss / 1024 / 1024)
    if (currentMemoryMB > this.metrics.summary.peak_memory_mb) {
      this.metrics.summary.peak_memory_mb = currentMemoryMB
    }
  }

  private parseTestOutput(output: string): void {
    // Parse test results to extract test counts and file information
    const testFilePattern = /✓\s+\|[^|]+\|\s+([^(]+)\s+\((\d+)\s+tests?\)/g
    const matches = [...output.matchAll(testFilePattern)]

    this.metrics.summary.test_files = matches.length
    this.metrics.summary.total_tests = matches.reduce((sum, match) => {
      return sum + parseInt(match[2] || '0')
    }, 0)

    // Extract memory information for each test file (if available)
    matches.forEach((match) => {
      const fileName = match[1]?.trim() || 'unknown'
      this.metrics.test_file_metrics.push({
        file: fileName,
        memory_before_mb: 0, // Would be filled by actual memory tracking
        memory_after_mb: 0, // Would be filled by actual memory tracking
        memory_delta_mb: 0, // Would be calculated
      })
    })
  }

  private async analyzeResults(): Promise<void> {
    const memoryValues = this.metrics.detailed_metrics.rss

    if (memoryValues.length > 0) {
      // Calculate average memory
      const sum = memoryValues.reduce((a, b) => a + b, 0)
      this.metrics.summary.avg_memory_mb = Math.round(sum / memoryValues.length)

      // Analyze memory growth trend
      if (memoryValues.length > 2) {
        const firstHalf = memoryValues.slice(0, Math.floor(memoryValues.length / 2))
        const secondHalf = memoryValues.slice(Math.floor(memoryValues.length / 2))

        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

        const growthPercentage = ((secondAvg - firstAvg) / firstAvg) * 100

        if (growthPercentage > 10) {
          this.metrics.analysis.memory_growth_trend = 'increasing'
          this.metrics.analysis.potential_leaks.push(
            'Memory usage increased by ' + growthPercentage.toFixed(1) + '% during test execution',
          )
        } else if (growthPercentage < -5) {
          this.metrics.analysis.memory_growth_trend = 'decreasing'
        }
      }

      // Identify high memory periods
      const highMemoryThreshold = this.metrics.summary.avg_memory_mb * 1.5
      memoryValues.forEach((mem, index) => {
        if (mem > highMemoryThreshold) {
          const timestamp = this.metrics.detailed_metrics.timestamps[index]
          this.metrics.analysis.high_memory_tests.push(
            `High memory usage (${mem}MB) at ${timestamp}`,
          )
        }
      })

      // Generate recommendations
      this.generateRecommendations()
    }
  }

  private generateRecommendations(): void {
    const recommendations = []

    if (this.metrics.summary.peak_memory_mb > 2048) {
      recommendations.push('Peak memory usage exceeds 2GB - consider memory optimization')
    }

    if (this.metrics.analysis.memory_growth_trend === 'increasing') {
      recommendations.push('Memory usage shows increasing trend - investigate potential leaks')
    }

    if (this.metrics.analysis.high_memory_tests.length > 5) {
      recommendations.push(
        'Multiple high memory periods detected - review test resource management',
      )
    }

    if (this.metrics.summary.duration_ms > 60000) {
      recommendations.push(
        'Test suite execution time over 1 minute - consider performance optimization',
      )
    }

    this.metrics.analysis.recommendations = recommendations
  }

  private async generateReport(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const reportPath = path.join('.claude/metrics', `baseline-memory-${timestamp}.json`)

    fs.writeFileSync(reportPath, JSON.stringify(this.metrics, null, 2))

    console.log(`📊 Memory baseline report generated: ${reportPath}`)
    console.log(`📈 Peak memory: ${this.metrics.summary.peak_memory_mb}MB`)
    console.log(`📊 Average memory: ${this.metrics.summary.avg_memory_mb}MB`)
    console.log(`🧪 Total tests: ${this.metrics.summary.total_tests}`)
    console.log(`⏱️  Duration: ${this.metrics.summary.duration_ms}ms`)

    if (this.metrics.analysis.recommendations.length > 0) {
      console.log('\n🔍 Recommendations:')
      this.metrics.analysis.recommendations.forEach((rec) => {
        console.log(`  • ${rec}`)
      })
    }
  }
}

// CLI interface
if (require.main === module) {
  const capture = new MemoryBaselineCapture()
  capture.captureBaseline().catch((error) => {
    console.error('Failed to capture memory baseline:', error)
    process.exit(1)
  })
}

export default MemoryBaselineCapture
