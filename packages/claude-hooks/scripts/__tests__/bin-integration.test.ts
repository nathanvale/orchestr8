/**
 * Integration tests for bin command execution
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(__dirname, '../..')
const distDir = path.join(packageRoot, 'dist')

describe('Bin Command Integration', () => {
  it('should execute claude-hooks-stop command successfully', () => {
    // Skip in Wallaby as dist may not exist
    if (process.env.WALLABY_WORKER) {
      return
    }

    const binPath = path.join(distDir, 'bin', 'claude-hooks-stop.js')

    // Test that the compiled bin file can be executed
    // Note: This will fail without proper input, but should not fail due to module loading
    expect(() => {
      try {
        execSync(`node ${binPath} --help`, {
          timeout: 5000,
          stdio: 'pipe',
        })
      } catch (error: unknown) {
        // Command should load successfully but may exit with error code due to missing input
        // Check that the error is not a module loading error
        const errorMessage = error instanceof Error ? error.message : String(error)
        expect(errorMessage).not.toContain('Cannot find module')
        expect(errorMessage).not.toContain('SyntaxError')
        expect(errorMessage).not.toContain('MODULE_NOT_FOUND')
      }
    }).not.toThrow(/Cannot find module|SyntaxError|MODULE_NOT_FOUND/)
  })

  it('should execute claude-hooks-notification command successfully', () => {
    // Skip in Wallaby as dist may not exist
    if (process.env.WALLABY_WORKER) {
      return
    }

    const binPath = path.join(distDir, 'bin', 'claude-hooks-notification.js')

    expect(() => {
      try {
        execSync(`node ${binPath} --help`, {
          timeout: 5000,
          stdio: 'pipe',
        })
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        expect(errorMessage).not.toContain('Cannot find module')
        expect(errorMessage).not.toContain('SyntaxError')
        expect(errorMessage).not.toContain('MODULE_NOT_FOUND')
      }
    }).not.toThrow(/Cannot find module|SyntaxError|MODULE_NOT_FOUND/)
  })

  it('should execute claude-hooks-quality command successfully', () => {
    // Skip in Wallaby as dist may not exist
    if (process.env.WALLABY_WORKER) {
      return
    }

    const binPath = path.join(distDir, 'bin', 'claude-hooks-quality.js')

    expect(() => {
      try {
        execSync(`node ${binPath}`, {
          timeout: 5000,
          stdio: 'pipe',
          input: '{}', // Provide empty JSON input
        })
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        expect(errorMessage).not.toContain('Cannot find module')
        expect(errorMessage).not.toContain('SyntaxError')
        expect(errorMessage).not.toContain('MODULE_NOT_FOUND')
      }
    }).not.toThrow(/Cannot find module|SyntaxError|MODULE_NOT_FOUND/)
  })

  it('should execute claude-hooks-subagent command successfully', () => {
    // Skip in Wallaby as dist may not exist
    if (process.env.WALLABY_WORKER) {
      return
    }

    const binPath = path.join(distDir, 'bin', 'claude-hooks-subagent.js')

    expect(() => {
      try {
        execSync(`node ${binPath} --help`, {
          timeout: 5000,
          stdio: 'pipe',
        })
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        expect(errorMessage).not.toContain('Cannot find module')
        expect(errorMessage).not.toContain('SyntaxError')
        expect(errorMessage).not.toContain('MODULE_NOT_FOUND')
      }
    }).not.toThrow(/Cannot find module|SyntaxError|MODULE_NOT_FOUND/)
  })
})

describe('Package Structure Verification', () => {
  it('should have correct bin file permissions', () => {
    // Skip in Wallaby as dist may not exist
    if (process.env.WALLABY_WORKER) {
      return
    }

    const binFiles = [
      path.join(distDir, 'bin', 'claude-hooks-stop.js'),
      path.join(distDir, 'bin', 'claude-hooks-notification.js'),
      path.join(distDir, 'bin', 'claude-hooks-quality.js'),
      path.join(distDir, 'bin', 'claude-hooks-subagent.js'),
    ]

    binFiles.forEach((binFile) => {
      expect(fs.existsSync(binFile)).toBe(true)

      // Check file is executable
      const stats = fs.statSync(binFile)
      const isExecutable = (stats.mode & 0o111) !== 0
      expect(isExecutable).toBe(true)
    })
  })

  it('should have correct shebang in compiled bin files', () => {
    // Skip in Wallaby as dist may not exist
    if (process.env.WALLABY_WORKER) {
      return
    }

    const binFiles = [
      path.join(distDir, 'bin', 'claude-hooks-stop.js'),
      path.join(distDir, 'bin', 'claude-hooks-notification.js'),
      path.join(distDir, 'bin', 'claude-hooks-quality.js'),
      path.join(distDir, 'bin', 'claude-hooks-subagent.js'),
    ]

    binFiles.forEach((binFile) => {
      const content = fs.readFileSync(binFile, 'utf-8')
      expect(content.startsWith('#!/usr/bin/env node')).toBe(true)
      expect(content).not.toContain('#!/usr/bin/env tsx')
    })
  })
})
