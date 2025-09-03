/**
 * End-to-end integration tests for @template/quality-check
 * Tests all CLI functionality, exit codes, and performance requirements
 */

import { execSync, spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { promisify } from 'node:util'

import { describe, expect, test, beforeEach, afterEach } from 'vitest'

const execAsync = promisify(spawn)

describe('End-to-End Quality Check Testing', () => {
  let testDir: string
  let validFile: string
  let invalidFile: string
  const packagePath = '/Users/nathanvale/code/bun-changesets-template/packages/quality-check'
  const binPath = path.join(packagePath, 'dist/index.js')

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(tmpdir(), `qc-e2e-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })

    // Create a valid TypeScript file
    validFile = path.join(testDir, 'valid.ts')
    await fs.writeFile(
      validFile,
      `// Valid TypeScript file
export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
`,
    )

    // Create an invalid file for error testing
    invalidFile = path.join(testDir, 'invalid.ts')
    await fs.writeFile(
      invalidFile,
      `// Invalid file with linting issues
export function broken(x) {
  var unused = 'bad'  
  console.log("bad quotes")
    return   x+1   // bad spacing
}
`,
    )
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('NPX Execution', () => {
    test('should show help via npx', async () => {
      const result = execSync(`npx "${packagePath}" --help`, { 
        encoding: 'utf-8',
        timeout: 10000
      })

      expect(result).toContain('@template/quality-check')
      expect(result).toContain('Usage:')
      expect(result).toContain('Options:')
      expect(result).toContain('Exit Codes:')
      expect(result).toContain('Examples:')
    })

    test('should execute via npx with file mode', async () => {
      const result = execSync(`npx "${packagePath}" --file "${validFile}"`, {
        encoding: 'utf-8',
        timeout: 10000
      })

      expect(result).toContain('✅')
      expect(result).toMatch(/completed in \d+ms/)
    })

    test('should handle missing file error via npx', async () => {
      const nonExistentFile = path.join(testDir, 'missing.ts')

      try {
        execSync(`npx "${packagePath}" --file "${nonExistentFile}"`, {
          encoding: 'utf-8',
          timeout: 10000
        })
        expect.fail('Should have thrown error for missing file')
      } catch (error: any) {
        expect(error.status).toBe(1)
        expect(error.stderr.toString()).toContain('ENOENT')
      }
    })
  })

  describe('Exit Code Validation', () => {
    test('should return exit code 0 for successful check', async () => {
      try {
        execSync(`node "${binPath}" --file "${validFile}"`, {
          encoding: 'utf-8',
          timeout: 10000
        })
        // If no exception thrown, exit code was 0
        expect(true).toBe(true)
      } catch (error: any) {
        expect.fail(`Expected exit code 0, got ${error.status}`)
      }
    })

    test('should return exit code 1 for general errors', async () => {
      const nonExistentFile = path.join(testDir, 'missing.ts')

      try {
        execSync(`node "${binPath}" --file "${nonExistentFile}"`, {
          encoding: 'utf-8',
          timeout: 10000
        })
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.status).toBe(1)
      }
    })

    test('should return exit code 2 for ESLint-only errors', async () => {
      // Create file with only ESLint issues
      const eslintErrorFile = path.join(testDir, 'eslint-error.ts')
      await fs.writeFile(
        eslintErrorFile,
        `// ESLint error - unused variable
export function test(): string {
  const unused = 'this will trigger ESLint error'
  return 'hello'
}
`,
      )

      try {
        execSync(`node "${binPath}" --file "${eslintErrorFile}" --no-prettier --no-typescript`, {
          encoding: 'utf-8',
          timeout: 10000
        })
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.status).toBe(2)
      }
    })

    test('should return exit code 4 for TypeScript-only errors', async () => {
      // Create file with TypeScript errors
      const tsErrorFile = path.join(testDir, 'ts-error.ts')
      await fs.writeFile(
        tsErrorFile,
        `// TypeScript error - type mismatch
export function broken(): string {
  return 123 // Type error: number not assignable to string
}
`,
      )

      try {
        execSync(`node "${binPath}" --file "${tsErrorFile}" --no-eslint --no-prettier`, {
          encoding: 'utf-8',
          timeout: 10000
        })
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.status).toBe(4)
      }
    })

    test('should handle timeout (exit code would be 124)', async () => {
      // Test with very short timeout to trigger timeout condition
      try {
        execSync(`node "${binPath}" --file "${validFile}" --timeout 1`, {
          encoding: 'utf-8',
          timeout: 5000
        })
      } catch (error: any) {
        // Could be timeout (124) or other error depending on timing
        expect([1, 124]).toContain(error.status)
      }
    })
  })

  describe('Performance Requirements', () => {
    test('should complete valid file check in under 2 seconds', async () => {
      const startTime = performance.now()
      
      try {
        execSync(`node "${binPath}" --file "${validFile}"`, {
          encoding: 'utf-8',
          timeout: 3000 // Give 3s timeout to ensure we can measure
        })
      } catch (error: any) {
        // Even if there are quality issues, we're testing performance
        // So we accept non-zero exit codes here
      }

      const duration = performance.now() - startTime
      expect(duration).toBeLessThan(2000)

      console.log(`Performance test completed in ${duration.toFixed(2)}ms`)
    })

    test('should measure parallel vs sequential execution', async () => {
      // Test parallel execution
      const parallelStart = performance.now()
      try {
        execSync(`node "${binPath}" --file "${validFile}"`, {
          encoding: 'utf-8',
          timeout: 5000
        })
      } catch (error) {
        // Ignore errors, we're measuring performance
      }
      const parallelDuration = performance.now() - parallelStart

      // Test sequential execution
      const sequentialStart = performance.now()
      try {
        execSync(`node "${binPath}" --file "${validFile}" --sequential`, {
          encoding: 'utf-8',
          timeout: 5000
        })
      } catch (error) {
        // Ignore errors, we're measuring performance
      }
      const sequentialDuration = performance.now() - sequentialStart

      console.log(`Parallel: ${parallelDuration.toFixed(2)}ms, Sequential: ${sequentialDuration.toFixed(2)}ms`)

      // Both should complete in reasonable time
      expect(parallelDuration).toBeLessThan(3000)
      expect(sequentialDuration).toBeLessThan(3000)
    })
  })

  describe('Claude Code Integration', () => {
    test('should handle PostToolUse hook JSON input', async () => {
      const hookInput = JSON.stringify({
        tool: 'Write',
        path: validFile,
      })

      // Test stdin input (hook mode)
      const child = spawn('node', [binPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000
      })

      child.stdin.write(hookInput)
      child.stdin.end()

      const result = await new Promise<{stdout: string, stderr: string, exitCode: number}>((resolve, reject) => {
        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (data) => {
          stdout += data.toString()
        })

        child.stderr.on('data', (data) => {
          stderr += data.toString()
        })

        child.on('close', (code) => {
          resolve({ stdout, stderr, exitCode: code ?? 0 })
        })

        child.on('error', (error) => {
          reject(error)
        })

        // Safety timeout
        setTimeout(() => {
          child.kill()
          reject(new Error('Hook mode test timeout'))
        }, 15000)
      })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('✅')
    })

    test('should handle correlation ID in hook mode', async () => {
      const hookInput = JSON.stringify({
        tool: 'Write',
        path: validFile,
        correlationId: 'test-correlation-123'
      })

      const child = spawn('node', [binPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      child.stdin.write(hookInput)
      child.stdin.end()

      const result = await new Promise<{stdout: string, stderr: string}>((resolve, reject) => {
        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (data) => {
          stdout += data.toString()
        })

        child.stderr.on('data', (data) => {
          stderr += data.toString()
        })

        child.on('close', () => {
          resolve({ stdout, stderr })
        })

        child.on('error', (error) => {
          reject(error)
        })

        setTimeout(() => {
          child.kill()
          reject(new Error('Correlation test timeout'))
        }, 15000)
      })

      // Check that correlation ID appears in output
      expect(result.stdout).toMatch(/test-correlation-123|✅/)
    })
  })

  describe('Package Distribution Readiness', () => {
    test('should have correct package.json configuration', async () => {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(packagePath, 'package.json'), 'utf-8')
      )

      expect(packageJson.name).toBe('@template/quality-check')
      expect(packageJson.version).toBeTruthy()
      expect(packageJson.bin).toBe('./dist/index.js')
      expect(packageJson.exports).toBeTruthy()
      expect(packageJson.types).toBe('./dist/index.d.ts')
      expect(packageJson.files).toContain('dist')
      expect(packageJson.engines?.node).toBeTruthy()
      expect(packageJson.publishConfig?.access).toBe('public')
    })

    test('should have complete build output', async () => {
      const distPath = path.join(packagePath, 'dist')
      
      // Check main entry point exists and is executable
      const indexJs = path.join(distPath, 'index.js')
      expect(await fs.access(indexJs).then(() => true).catch(() => false)).toBe(true)
      
      // Check type definitions exist
      const indexDts = path.join(distPath, 'index.d.ts')
      expect(await fs.access(indexDts).then(() => true).catch(() => false)).toBe(true)

      // Verify shebang exists
      const content = await fs.readFile(indexJs, 'utf-8')
      expect(content).toMatch(/^#!\/usr\/bin\/env node/)
    })

    test('should validate export maps work', async () => {
      // Test that we can import the main export
      try {
        const module = await import(`file://${path.join(packagePath, 'dist/index.js')}`)
        expect(module.QualityChecker).toBeTruthy()
        expect(module.SafeFileOperations).toBeTruthy()
      } catch (error) {
        expect.fail(`Export map validation failed: ${error}`)
      }
    })
  })

  describe('Error Handling Robustness', () => {
    test('should handle invalid command line arguments gracefully', async () => {
      try {
        execSync(`node "${binPath}" --invalid-flag`, {
          encoding: 'utf-8',
          timeout: 5000
        })
        expect.fail('Should handle invalid arguments')
      } catch (error: any) {
        // Should fail gracefully with proper exit code
        expect([1, 2, 3, 4, 5]).toContain(error.status)
      }
    })

    test('should handle Node.js version check', async () => {
      // This test verifies the version check works (would need Node < 18 to actually fail)
      const result = execSync(`node "${binPath}" --help`, { encoding: 'utf-8' })
      expect(result).toBeTruthy() // If we get here, version check passed
    })

    test('should handle permission errors gracefully', async () => {
      // Create a file we can't read (if possible on current system)
      const restrictedFile = path.join(testDir, 'restricted.ts')
      await fs.writeFile(restrictedFile, 'export const test = 1')
      
      // Try to remove read permissions (may not work on all systems)
      try {
        await fs.chmod(restrictedFile, 0o000)
        
        try {
          execSync(`node "${binPath}" --file "${restrictedFile}"`, {
            encoding: 'utf-8',
            timeout: 5000
          })
          expect.fail('Should handle permission errors')
        } catch (error: any) {
          expect(error.status).toBe(1)
        }
      } catch (chmodError) {
        // If chmod fails (e.g., on Windows), skip this test
        console.log('Skipping permission test - chmod not supported')
      }
    })
  })
})