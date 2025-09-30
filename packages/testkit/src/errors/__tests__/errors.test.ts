/**
 * Comprehensive tests for the unified error handling system
 */

import { describe, it, expect } from 'vitest'
import {
  TestkitError,
  FileSystemError,
  ProcessError,
  ResourceError,
  ConfigurationError,
  DatabaseError,
  SecurityError,
  ValidationError,
  ErrorCategory,
  ErrorCode,
  ErrorFormatter,
  isTestkitError,
  isTestkitErrorOfCategory,
  isTestkitErrorOfCode,
  createTestkitError,
  wrapError,
  type ErrorMetadata,
} from '../index.js'

describe('Error System', () => {
  describe('TestkitError Base Class', () => {
    it('should be an instance of Error', () => {
      const error = new FileSystemError(ErrorCode.FILE_NOT_FOUND, 'Test error', {
        path: '/test/path',
      })
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(TestkitError)
    })

    it('should maintain proper inheritance chain', () => {
      const error = new ProcessError(ErrorCode.PROCESS_SPAWN_FAILED, 'Test error')
      expect(error.name).toBe('ProcessError')
      expect(error.message).toBe('Test error')
      expect(error.category).toBe(ErrorCategory.PROCESS)
    })

    it('should capture stack trace', () => {
      const error = new SecurityError(ErrorCode.COMMAND_INJECTION, 'Test error')
      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('SecurityError')
    })

    it('should include metadata with timestamp', () => {
      const error = new ValidationError(ErrorCode.INVALID_PARAMETER, 'Test error')
      expect(error.metadata.timestamp).toBeDefined()
      expect(typeof error.metadata.timestamp).toBe('number')
      expect(error.metadata.timestamp).toBeCloseTo(Date.now(), -2) // Within ~100ms
    })

    it('should support cause chaining', () => {
      const originalError = new Error('Original error')
      const wrappedError = new ResourceError(
        ErrorCode.CLEANUP_FAILED,
        'Wrapped error',
        { resourceId: 'test-resource' },
        {},
        originalError,
      )

      expect(wrappedError.cause).toBe(originalError)
    })
  })

  describe('Specific Error Types', () => {
    describe('FileSystemError', () => {
      it('should have correct category and properties', () => {
        const error = new FileSystemError(ErrorCode.PATH_TRAVERSAL, 'Path traversal detected', {
          path: '../../../etc/passwd',
          operation: 'read_file',
        })

        expect(error.category).toBe(ErrorCategory.FILE_SYSTEM)
        expect(error.code).toBe(ErrorCode.PATH_TRAVERSAL)
        expect(error.path).toBe('../../../etc/passwd')
        expect(error.operation).toBe('read_file')
      })

      it('should work without context', () => {
        const error = new FileSystemError(ErrorCode.FILE_NOT_FOUND, 'File not found')
        expect(error.path).toBeUndefined()
        expect(error.operation).toBeUndefined()
      })
    })

    describe('ProcessError', () => {
      it('should have correct category and properties', () => {
        const error = new ProcessError(
          ErrorCode.PROCESS_EXIT_NONZERO,
          'Process exited with non-zero code',
          { command: 'npm test', exitCode: 1, signal: 'SIGTERM' },
        )

        expect(error.category).toBe(ErrorCategory.PROCESS)
        expect(error.code).toBe(ErrorCode.PROCESS_EXIT_NONZERO)
        expect(error.command).toBe('npm test')
        expect(error.exitCode).toBe(1)
        expect(error.signal).toBe('SIGTERM')
      })
    })

    describe('ResourceError', () => {
      it('should have correct category and properties', () => {
        const error = new ResourceError(ErrorCode.RESOURCE_LEAK, 'Resource leak detected', {
          resourceId: 'db-connection-1',
          resourceType: 'database',
        })

        expect(error.category).toBe(ErrorCategory.RESOURCE)
        expect(error.code).toBe(ErrorCode.RESOURCE_LEAK)
        expect(error.resourceId).toBe('db-connection-1')
        expect(error.resourceType).toBe('database')
      })
    })

    describe('ConfigurationError', () => {
      it('should have correct category and properties', () => {
        const error = new ConfigurationError(
          ErrorCode.INVALID_CONFIG,
          'Invalid configuration value',
          { configKey: 'database.timeout', expectedType: 'number' },
        )

        expect(error.category).toBe(ErrorCategory.CONFIGURATION)
        expect(error.code).toBe(ErrorCode.INVALID_CONFIG)
        expect(error.configKey).toBe('database.timeout')
        expect(error.expectedType).toBe('number')
      })
    })

    describe('DatabaseError', () => {
      it('should have correct category and properties', () => {
        const error = new DatabaseError(ErrorCode.CONNECTION_FAILED, 'Database connection failed', {
          database: 'test_db',
          query: 'SELECT * FROM users',
        })

        expect(error.category).toBe(ErrorCategory.DATABASE)
        expect(error.code).toBe(ErrorCode.CONNECTION_FAILED)
        expect(error.database).toBe('test_db')
        expect(error.query).toBe('SELECT * FROM users')
      })
    })

    describe('SecurityError', () => {
      it('should have correct category and properties', () => {
        const error = new SecurityError(
          ErrorCode.COMMAND_INJECTION,
          'Command injection attempt detected',
          { input: 'ls; rm -rf /', violationType: 'command_injection' },
        )

        expect(error.category).toBe(ErrorCategory.SECURITY)
        expect(error.code).toBe(ErrorCode.COMMAND_INJECTION)
        expect(error.input).toBe('ls; rm -rf /')
        expect(error.violationType).toBe('command_injection')
      })
    })

    describe('ValidationError', () => {
      it('should have correct category and properties', () => {
        const error = new ValidationError(ErrorCode.TYPE_MISMATCH, 'Type validation failed', {
          field: 'age',
          value: 'not a number',
          expectedType: 'number',
        })

        expect(error.category).toBe(ErrorCategory.VALIDATION)
        expect(error.code).toBe(ErrorCode.TYPE_MISMATCH)
        expect(error.field).toBe('age')
        expect(error.value).toBe('not a number')
        expect(error.expectedType).toBe('number')
      })
    })
  })

  describe('Type Guards', () => {
    it('should correctly identify testkit errors', () => {
      const testkitError = new FileSystemError(ErrorCode.FILE_NOT_FOUND, 'Test error')
      const regularError = new Error('Regular error')

      expect(isTestkitError(testkitError)).toBe(true)
      expect(isTestkitError(regularError)).toBe(false)
      expect(isTestkitError(null)).toBe(false)
      expect(isTestkitError(undefined)).toBe(false)
      expect(isTestkitError('string')).toBe(false)
    })

    it('should correctly identify errors by category', () => {
      const fsError = new FileSystemError(ErrorCode.FILE_NOT_FOUND, 'Test error')
      const processError = new ProcessError(ErrorCode.PROCESS_SPAWN_FAILED, 'Test error')

      expect(isTestkitErrorOfCategory(fsError, ErrorCategory.FILE_SYSTEM)).toBe(true)
      expect(isTestkitErrorOfCategory(fsError, ErrorCategory.PROCESS)).toBe(false)
      expect(isTestkitErrorOfCategory(processError, ErrorCategory.PROCESS)).toBe(true)
      expect(isTestkitErrorOfCategory(new Error('regular'), ErrorCategory.FILE_SYSTEM)).toBe(false)
    })

    it('should correctly identify errors by code', () => {
      const error1 = new FileSystemError(ErrorCode.FILE_NOT_FOUND, 'Test error')
      const error2 = new ProcessError(ErrorCode.PROCESS_SPAWN_FAILED, 'Test error')

      expect(isTestkitErrorOfCode(error1, ErrorCode.FILE_NOT_FOUND)).toBe(true)
      expect(isTestkitErrorOfCode(error1, ErrorCode.PROCESS_SPAWN_FAILED)).toBe(false)
      expect(isTestkitErrorOfCode(error2, ErrorCode.PROCESS_SPAWN_FAILED)).toBe(true)
      expect(isTestkitErrorOfCode(new Error('regular'), ErrorCode.FILE_NOT_FOUND)).toBe(false)
    })
  })

  describe('Factory Functions', () => {
    it('should create appropriate error instances', () => {
      const fsError = createTestkitError(
        ErrorCategory.FILE_SYSTEM,
        ErrorCode.PERMISSION_DENIED,
        'Permission denied',
        { path: '/root/secret' },
      )

      expect(fsError).toBeInstanceOf(FileSystemError)
      expect(fsError.category).toBe(ErrorCategory.FILE_SYSTEM)
      expect(fsError.code).toBe(ErrorCode.PERMISSION_DENIED)
      expect((fsError as FileSystemError).path).toBe('/root/secret')
    })

    it('should create all error types correctly', () => {
      const categories = [
        ErrorCategory.FILE_SYSTEM,
        ErrorCategory.PROCESS,
        ErrorCategory.RESOURCE,
        ErrorCategory.CONFIGURATION,
        ErrorCategory.DATABASE,
        ErrorCategory.SECURITY,
        ErrorCategory.VALIDATION,
      ]

      categories.forEach((category) => {
        const error = createTestkitError(category, ErrorCode.INVALID_PARAMETER, 'Test message')
        expect(error.category).toBe(category)
        expect(error).toBeInstanceOf(TestkitError)
      })
    })

    it('should throw for unsupported categories', () => {
      expect(() => {
        createTestkitError('INVALID_CATEGORY' as any, ErrorCode.INVALID_PARAMETER, 'Test')
      }).toThrow('Unsupported error category')
    })

    it('should wrap existing errors correctly', () => {
      const originalError = new Error('Original error message')
      const wrappedError = wrapError(
        originalError,
        ErrorCategory.PROCESS,
        ErrorCode.PROCESS_SPAWN_FAILED,
        'Failed to spawn process',
        { command: 'node script.js' },
      )

      expect(wrappedError).toBeInstanceOf(ProcessError)
      expect(wrappedError.message).toBe('Failed to spawn process: Original error message')
      expect(wrappedError.cause).toBe(originalError)
      expect((wrappedError as ProcessError).command).toBe('node script.js')
    })

    it('should wrap errors without additional message', () => {
      const originalError = new Error('Original error message')
      const wrappedError = wrapError(
        originalError,
        ErrorCategory.RESOURCE,
        ErrorCode.CLEANUP_FAILED,
      )

      expect(wrappedError.message).toBe('Original error message')
      expect(wrappedError.cause).toBe(originalError)
    })
  })

  describe('Error Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const error = new FileSystemError(
        ErrorCode.PATH_TRAVERSAL,
        'Path traversal detected',
        { path: '../../../etc/passwd', operation: 'read_file' },
        { operation: 'validate_path', suggestions: ['Use absolute paths'] },
      )

      const json = error.toJSON()

      expect(json).toEqual({
        name: 'FileSystemError',
        message: 'Path traversal detected',
        category: ErrorCategory.FILE_SYSTEM,
        code: ErrorCode.PATH_TRAVERSAL,
        metadata: expect.objectContaining({
          operation: 'validate_path',
          suggestions: ['Use absolute paths'],
          timestamp: expect.any(Number),
          stack: expect.any(String),
        }),
        cause: undefined,
        stack: expect.any(String),
      })
    })

    it('should include cause in serialization', () => {
      const originalError = new Error('Original error')
      const wrappedError = new ResourceError(
        ErrorCode.CLEANUP_FAILED,
        'Cleanup failed',
        { resourceId: 'test' },
        {},
        originalError,
      )

      const json = wrappedError.toJSON()
      expect(json.cause).toBe('Original error')
    })
  })

  describe('Error Formatting', () => {
    it('should format errors for users', () => {
      const error = new FileSystemError(
        ErrorCode.FILE_NOT_FOUND,
        'File not found',
        { path: '/missing/file.txt' },
        { suggestions: ['Check if the file exists', 'Verify the path is correct'] },
      )

      const formatted = ErrorFormatter.formatForUser(error)
      expect(formatted).toContain('File not found')
      expect(formatted).toContain('Suggestions:')
      expect(formatted).toContain('- Check if the file exists')
      expect(formatted).toContain('- Verify the path is correct')
    })

    it('should format errors for logging', () => {
      const error = new ProcessError(ErrorCode.PROCESS_EXIT_NONZERO, 'Process failed', {
        command: 'npm test',
        exitCode: 1,
      })

      const formatted = ErrorFormatter.formatForLogging(error)
      const parsed = JSON.parse(formatted)

      expect(parsed.name).toBe('ProcessError')
      expect(parsed.category).toBe(ErrorCategory.PROCESS)
      expect(parsed.code).toBe(ErrorCode.PROCESS_EXIT_NONZERO)
    })

    it('should create error summaries', () => {
      const error = new SecurityError(ErrorCode.COMMAND_INJECTION, 'Injection detected', {
        input: 'malicious input',
      })

      const summary = ErrorFormatter.createSummary(error)
      expect(summary).toBe('[security:COMMAND_INJECTION] Injection detected')
    })
  })

  describe('toString Override', () => {
    it('should provide detailed string representation', () => {
      const error = new ProcessError(
        ErrorCode.PROCESS_TIMEOUT,
        'Process timed out',
        { command: 'long-running-script' },
        { operation: 'execute_script' },
      )

      const stringRep = error.toString()
      expect(stringRep).toContain('ProcessError: Process timed out')
      expect(stringRep).toContain('Category: process')
      expect(stringRep).toContain('Code: PROCESS_TIMEOUT')
      expect(stringRep).toContain('Operation: execute_script')
    })

    it('should include cause in string representation', () => {
      const originalError = new Error('Network timeout')
      const wrappedError = new DatabaseError(
        ErrorCode.CONNECTION_FAILED,
        'Database connection failed',
        { database: 'test_db' },
        {},
        originalError,
      )

      const stringRep = wrappedError.toString()
      expect(stringRep).toContain('Caused by: Network timeout')
    })
  })

  describe('Backwards Compatibility', () => {
    it('should work with standard Error handling', () => {
      const error = new FileSystemError(ErrorCode.FILE_NOT_FOUND, 'File not found')

      // Should work with standard Error methods
      expect(error.message).toBe('File not found')
      expect(error.name).toBe('FileSystemError')
      expect(error.stack).toBeDefined()

      // Should work with instanceof checks
      expect(error instanceof Error).toBe(true)
      expect(error instanceof TestkitError).toBe(true)
      expect(error instanceof FileSystemError).toBe(true)
    })

    it('should work in try-catch blocks', () => {
      const throwTestkitError = () => {
        throw new ProcessError(ErrorCode.PROCESS_SPAWN_FAILED, 'Process failed')
      }

      expect(() => throwTestkitError()).toThrow('Process failed')
      expect(() => throwTestkitError()).toThrow(ProcessError)
      expect(() => throwTestkitError()).toThrow(TestkitError)
      expect(() => throwTestkitError()).toThrow(Error)
    })

    it('should preserve error semantics in Promise rejections', async () => {
      const rejectWithTestkitError = () => {
        return Promise.reject(
          new ResourceError(ErrorCode.CLEANUP_FAILED, 'Cleanup failed', { resourceId: 'test' }),
        )
      }

      await expect(rejectWithTestkitError()).rejects.toThrow('Cleanup failed')
      await expect(rejectWithTestkitError()).rejects.toThrow(ResourceError)
      await expect(rejectWithTestkitError()).rejects.toThrow(TestkitError)
    })
  })

  describe('Error Context and Metadata', () => {
    it('should support rich metadata', () => {
      const metadata: ErrorMetadata = {
        operation: 'database_migration',
        source: 'migration-script.ts',
        suggestions: ['Check database permissions', 'Verify migration script'],
        context: {
          migrationVersion: '2023.01.15',
          targetTable: 'users',
          affectedRows: 1500,
        },
      }

      const error = new DatabaseError(
        ErrorCode.MIGRATION_FAILED,
        'Migration failed',
        { database: 'production', query: 'ALTER TABLE users ADD COLUMN email VARCHAR(255)' },
        metadata,
      )

      expect(error.metadata.operation).toBe('database_migration')
      expect(error.metadata.source).toBe('migration-script.ts')
      expect(error.metadata.suggestions).toEqual([
        'Check database permissions',
        'Verify migration script',
      ])
      expect(error.metadata.context).toEqual({
        migrationVersion: '2023.01.15',
        targetTable: 'users',
        affectedRows: 1500,
      })
    })

    it('should handle empty metadata gracefully', () => {
      const error = new ValidationError(ErrorCode.REQUIRED_FIELD_MISSING, 'Field is required')
      expect(error.metadata).toBeDefined()
      expect(error.metadata.timestamp).toBeDefined()
    })
  })
})
