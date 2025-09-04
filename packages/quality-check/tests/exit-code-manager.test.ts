/**
 * Tests for ExitCodeManager - Claude Code hook integration
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import type { Logger } from '@orchestr8/logger'
import { ExitCodeManager } from '../src/enforcement/exit-code-manager.js'
import type { EnforcementResult } from '../src/types/enforcement.js'

describe('ExitCodeManager', () => {
  let logger: Logger
  let exitCodeManager: ExitCodeManager

  beforeEach(() => {
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger

    exitCodeManager = new ExitCodeManager(logger)
  })

  describe('determineExitCode', () => {
    test('returns exit code 1 for hook errors', () => {
      const enforcementResult: EnforcementResult = {
        blocked: false,
        exitCode: 0,
        silent: true,
      }
      const hookError = new Error('Parse failed')

      const decision = exitCodeManager.determineExitCode(enforcementResult, hookError)

      expect(decision).toEqual({
        exitCode: 1,
        shouldOutput: true,
        useStderr: true,
        message: 'Hook error: Parse failed',
      })
    })

    test('returns exit code 0 for silent success', () => {
      const enforcementResult: EnforcementResult = {
        blocked: false,
        exitCode: 0,
        silent: true,
      }

      const decision = exitCodeManager.determineExitCode(enforcementResult)

      expect(decision).toEqual({
        exitCode: 0,
        shouldOutput: false,
        useStderr: false,
      })
    })

    test('returns exit code 2 for blocked quality issues', () => {
      const enforcementResult: EnforcementResult = {
        blocked: true,
        exitCode: 1,
        message: 'Quality issues found',
        classification: {
          hasUnfixableErrors: true,
          hasQuickFixable: false,
          totalErrors: 3,
          autoFixedErrors: [],
          unfixableErrors: [],
          quickFixableErrors: [],
          allAutoFixed: false,
        },
      }

      const decision = exitCodeManager.determineExitCode(enforcementResult)

      expect(decision).toEqual({
        exitCode: 2,
        shouldOutput: true,
        useStderr: true,
        message: 'Quality issues found',
      })
    })

    test('returns exit code 2 for quality issues with quick fixes', () => {
      const enforcementResult: EnforcementResult = {
        blocked: false,
        exitCode: 2,
        message: 'Quick fixes available',
        classification: {
          hasUnfixableErrors: false,
          hasQuickFixable: true,
          totalErrors: 2,
          autoFixedErrors: [],
          unfixableErrors: [],
          quickFixableErrors: [],
          allAutoFixed: false,
        },
      }

      const decision = exitCodeManager.determineExitCode(enforcementResult)

      expect(decision).toEqual({
        exitCode: 2,
        shouldOutput: true,
        useStderr: true,
        message: 'Quick fixes available',
      })
    })

    test('returns exit code 0 for successful result without issues', () => {
      const enforcementResult: EnforcementResult = {
        blocked: false,
        exitCode: 0,
        silent: false,
      }

      const decision = exitCodeManager.determineExitCode(enforcementResult)

      expect(decision).toEqual({
        exitCode: 0,
        shouldOutput: false,
        useStderr: false,
      })
    })

    test('fallback to exit code 2 for unknown scenarios', () => {
      const enforcementResult: EnforcementResult = {
        blocked: false,
        exitCode: 5, // Unknown exit code
        silent: false,
      }

      const decision = exitCodeManager.determineExitCode(enforcementResult)

      expect(decision).toEqual({
        exitCode: 2,
        shouldOutput: true,
        useStderr: true,
        message: 'Quality check issues found',
      })
    })
  })

  describe('determineParseErrorExitCode', () => {
    test('returns exit code 1 for parse errors', () => {
      const error = new Error('Invalid JSON')

      const decision = exitCodeManager.determineParseErrorExitCode(error)

      expect(decision).toEqual({
        exitCode: 1,
        shouldOutput: true,
        useStderr: true,
        message: 'Hook parse error: Invalid JSON',
      })
    })
  })
})
