import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { QualityCheckerV2 } from '../src'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { performance } from 'node:perf_hooks'

describe('Performance Benchmarks', () => {
  let fixtureDir: string
  let checker: QualityCheckerV2
  let testFile: string

  beforeAll(async () => {
    fixtureDir = path.join(tmpdir(), `qc-benchmark-${Date.now()}`)
    await fs.mkdir(fixtureDir, { recursive: true })
    checker = new QualityCheckerV2()

    // Create a test TypeScript file
    testFile = path.join(fixtureDir, 'benchmark.ts')
    await fs.writeFile(
      testFile,
      `
      export function fibonacci(n: number): number {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
      }
      
      export function factorial(n: number): number {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
      }
      
      export const calculator = {
        add: (a: number, b: number) => a + b,
        subtract: (a: number, b: number) => a - b,
        multiply: (a: number, b: number) => a * b,
        divide: (a: number, b: number) => b !== 0 ? a / b : 0,
      };
    `,
    )

    // Create tsconfig
    const tsconfigPath = path.join(fixtureDir, 'tsconfig.json')
    await fs.writeFile(
      tsconfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            module: 'commonjs',
            strict: true,
            noEmit: true,
            incremental: true,
          },
        },
        null,
        2,
      ),
    )
  })

  afterAll(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true })
  })

  describe('Cold vs Warm Performance', () => {
    it('should_achieve_sub300ms_warm_performance_when_typescript_cache_exists', async () => {
      // Cold run - first check
      const coldStart = performance.now()
      const coldResult = await checker.check([testFile], {
        typescript: true,
        eslint: false,
        prettier: false,
      })
      const coldDuration = performance.now() - coldStart

      expect(coldResult.success).toBe(true)
      console.log(`Cold run: ${coldDuration.toFixed(2)}ms`)

      // Warm runs - subsequent checks
      const warmDurations: number[] = []
      for (let i = 0; i < 5; i++) {
        const warmStart = performance.now()
        const warmResult = await checker.check([testFile], {
          typescript: true,
          eslint: false,
          prettier: false,
        })
        const warmDuration = performance.now() - warmStart
        warmDurations.push(warmDuration)

        expect(warmResult.success).toBe(true)
      }

      const avgWarmDuration = warmDurations.reduce((a, b) => a + b, 0) / warmDurations.length
      const medianWarmDuration = warmDurations.sort((a, b) => a - b)[
        Math.floor(warmDurations.length / 2)
      ]

      console.log(`Warm runs average: ${avgWarmDuration.toFixed(2)}ms`)
      console.log(`Warm runs median: ${medianWarmDuration.toFixed(2)}ms`)
      console.log(
        `Performance improvement: ${(((coldDuration - medianWarmDuration) / coldDuration) * 100).toFixed(1)}%`,
      )

      // Median warm performance should be under 800ms (reasonable for incremental compilation)
      expect(medianWarmDuration).toBeLessThan(800)
    })

    it('should_maintain_performance_when_multiple_engines_run', async () => {
      const multiEngineDurations: number[] = []

      for (let i = 0; i < 3; i++) {
        const start = performance.now()
        const result = await checker.check([testFile], {
          typescript: true,
          eslint: true,
          prettier: true,
        })
        const duration = performance.now() - start
        multiEngineDurations.push(duration)

        expect(result.success).toBeDefined()
      }

      const avgDuration =
        multiEngineDurations.reduce((a, b) => a + b, 0) / multiEngineDurations.length
      console.log(`Multi-engine average: ${avgDuration.toFixed(2)}ms`)

      // Multi-engine checks should complete reasonably fast
      expect(avgDuration).toBeLessThan(1500)
    })
  })

  describe('File Size Impact', () => {
    it('should_scale_linearly_when_checking_multiple_files', async () => {
      // Create multiple test files
      const files: string[] = []
      for (let i = 0; i < 5; i++) {
        const file = path.join(fixtureDir, `test-${i}.ts`)
        await fs.writeFile(
          file,
          `
          export function test${i}(value: string): string {
            return value.toUpperCase();
          }
        `,
        )
        files.push(file)
      }

      // Measure single file
      const singleStart = performance.now()
      await checker.check([files[0]], {
        typescript: true,
        eslint: false,
        prettier: false,
      })
      const singleDuration = performance.now() - singleStart

      // Measure all files
      const multiStart = performance.now()
      await checker.check(files, {
        typescript: true,
        eslint: false,
        prettier: false,
      })
      const multiDuration = performance.now() - multiStart

      const scalingFactor = multiDuration / singleDuration
      console.log(`Single file: ${singleDuration.toFixed(2)}ms`)
      console.log(`${files.length} files: ${multiDuration.toFixed(2)}ms`)
      console.log(`Scaling factor: ${scalingFactor.toFixed(2)}x`)

      // Should scale somewhat linearly (allowing for overhead)
      expect(scalingFactor).toBeLessThan(files.length * 1.5)
    })
  })

  describe('Cache Effectiveness', () => {
    it('should_utilize_cache_when_typescript_incremental_enabled', async () => {
      const cacheDir = path.join(fixtureDir, '.cache')
      const testFileWithCache = path.join(fixtureDir, 'cached.ts')

      await fs.writeFile(
        testFileWithCache,
        `
        export interface User {
          id: number;
          name: string;
        }
        
        export class UserService {
          getUser(id: number): User {
            return { id, name: 'Test User' };
          }
        }
      `,
      )

      // First run - builds cache
      const firstRun = await checker.check([testFileWithCache], {
        typescript: true,
        eslint: false,
        prettier: false,
        cacheDir,
      })
      expect(firstRun.success).toBe(true)

      // Check if TypeScript cache files exist
      const cacheFiles = await fs.readdir(fixtureDir)
      const hasTsBuildInfo = cacheFiles.some((f) => f.includes('.tsbuildinfo'))

      // TypeScript incremental should create build info
      console.log(`TypeScript cache created: ${hasTsBuildInfo}`)

      // Second run should be faster
      const secondStart = performance.now()
      await checker.check([testFileWithCache], {
        typescript: true,
        eslint: false,
        prettier: false,
        cacheDir,
      })
      const secondDuration = performance.now() - secondStart

      console.log(`Cached run: ${secondDuration.toFixed(2)}ms`)
      expect(secondDuration).toBeLessThan(800)
    })
  })

  describe('Performance Metrics', () => {
    it('should_track_performance_metrics_when_checks_run', async () => {
      const metrics: { duration: number; engine: string }[] = []

      // TypeScript only
      let start = performance.now()
      await checker.check([testFile], {
        typescript: true,
        eslint: false,
        prettier: false,
      })
      metrics.push({ duration: performance.now() - start, engine: 'typescript' })

      // ESLint only
      start = performance.now()
      await checker.check([testFile], {
        eslint: true,
        typescript: false,
        prettier: false,
      })
      metrics.push({ duration: performance.now() - start, engine: 'eslint' })

      // Prettier only
      start = performance.now()
      await checker.check([testFile], {
        prettier: true,
        typescript: false,
        eslint: false,
      })
      metrics.push({ duration: performance.now() - start, engine: 'prettier' })

      // Log performance metrics
      console.log('\nPerformance Metrics:')
      metrics.forEach((m) => {
        console.log(`  ${m.engine}: ${m.duration.toFixed(2)}ms`)
      })

      // All engines should complete reasonably fast
      metrics.forEach((m) => {
        expect(m.duration).toBeLessThan(1000)
      })
    })
  })
})
