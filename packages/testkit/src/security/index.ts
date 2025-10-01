/**
 * Security validation module for @orchestr8/testkit
 *
 * This module provides comprehensive security validation functions to prevent
 * common vulnerabilities like command injection, path traversal, and SQL injection.
 */

import { resolve, relative, isAbsolute, normalize } from 'path'

/**
 * Error thrown when a security validation fails
 */
export class SecurityValidationError extends Error {
  constructor(
    message: string,
    public readonly type: 'command' | 'path' | 'sql' | 'shell',
    public readonly input: string,
  ) {
    super(message)
    this.name = 'SecurityValidationError'
  }
}

/**
 * Dangerous shell metacharacters that can be used for command injection
 */
const DANGEROUS_SHELL_CHARS = [
  ';', // Command separator
  '|', // Pipe
  '&', // Background/conditional execution
  '$', // Variable expansion
  '`', // Command substitution
  '>', // Redirect output
  '<', // Redirect input
  '(', // Subshell
  ')', // Subshell
  '{', // Brace expansion
  '}', // Brace expansion
  '[', // Glob pattern
  ']', // Glob pattern
  '*', // Glob wildcard
  '?', // Glob single char
  '!', // History expansion (bash)
  '#', // Comment (can terminate commands)
  '\n', // Newline
  '\r', // Carriage return
  '\t', // Tab
]

/**
 * Commands that are considered dangerous and should be blocked
 */
const DANGEROUS_COMMANDS = [
  // System modification
  'rm',
  'rmdir',
  'del',
  'deltree',
  'rd',
  'format',
  'fdisk',
  'mkfs',

  // Network/download
  'wget',
  'curl',
  'nc',
  'netcat',
  'telnet',
  'ssh',
  'scp',
  'rsync',

  // Process/system control
  'kill',
  'killall',
  'pkill',
  'taskkill',
  'shutdown',
  'reboot',
  'halt',
  'poweroff',
  'su',
  'sudo',
  'runas',

  // Shell/execution
  'sh',
  'bash',
  'zsh',
  'fish',
  'csh',
  'tcsh',
  'ksh',
  'cmd',
  'powershell',
  'pwsh',
  'eval',
  'exec',
  'source',

  // File system
  'chmod',
  'chown',
  'chgrp',
  'attrib',
  'icacls',
  'mount',
  'umount',
  'unmount',

  // Archive/compression (can be used to extract malicious files)
  'tar',
  'unzip',
  'gunzip',
  'bunzip2',
  'unrar',

  // Development/compilation (can execute arbitrary code)
  'gcc',
  'g++',
  'clang',
  'javac',
  'python',
  'node',
  'ruby',
  'perl',
  'php',
  'make',
  'cmake',
  'ninja',
]

/**
 * Path traversal patterns to detect and block
 */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\./, // Parent directory
  /\.\.[\\/]/, // Parent directory with separator
  /[\\/]\.\./, // Separator followed by parent directory
  /[\\/]\.\.[\\/]/, // Parent directory surrounded by separators
  /~[\\/]/, // Home directory reference
  /^\//, // Absolute path (Unix)
  /^[A-Za-z]:[\\//]/, // Absolute path (Windows)
  /\0/, // Null byte injection
]

/**
 * Sanitize a command string by escaping dangerous shell metacharacters
 *
 * @param cmd - The command string to sanitize
 * @returns The sanitized command string
 *
 * @example
 * ```typescript
 * const safe = sanitizeCommand('echo "hello; rm -rf /"')
 * // Returns: 'echo "hello\\; rm -rf /"'
 * ```
 */
export function sanitizeCommand(cmd: string): string {
  if (typeof cmd !== 'string') {
    throw new SecurityValidationError('Command must be a string', 'command', String(cmd))
  }

  let sanitized = cmd

  // Handle special characters that need specific escaping
  sanitized = sanitized.replace(/\n/g, '\\n')
  sanitized = sanitized.replace(/\r/g, '\\r')
  sanitized = sanitized.replace(/\t/g, '\\t')

  // Escape other dangerous shell metacharacters
  sanitized = sanitized.replace(/;/g, '\\;')
  sanitized = sanitized.replace(/\|/g, '\\|')
  sanitized = sanitized.replace(/&/g, '\\&')
  sanitized = sanitized.replace(/\$/g, '\\$')
  sanitized = sanitized.replace(/`/g, '\\`')
  sanitized = sanitized.replace(/>/g, '\\>')
  sanitized = sanitized.replace(/</g, '\\<')
  sanitized = sanitized.replace(/\(/g, '\\(')
  sanitized = sanitized.replace(/\)/g, '\\)')
  sanitized = sanitized.replace(/\{/g, '\\{')
  sanitized = sanitized.replace(/\}/g, '\\}')
  sanitized = sanitized.replace(/\[/g, '\\[')
  sanitized = sanitized.replace(/\]/g, '\\]')
  sanitized = sanitized.replace(/\*/g, '\\*')
  sanitized = sanitized.replace(/\?/g, '\\?')
  sanitized = sanitized.replace(/!/g, '\\!')
  sanitized = sanitized.replace(/#/g, '\\#')

  return sanitized
}
/**
 * Validate a command and throw if it contains dangerous patterns
 *
 * @param cmd - The command string to validate
 * @throws {SecurityValidationError} If the command is dangerous
 *
 * @example
 * ```typescript
 * validateCommand('echo hello') // OK
 * validateCommand('rm -rf /') // Throws SecurityValidationError
 * ```
 */
export function validateCommand(cmd: string): void {
  if (typeof cmd !== 'string') {
    throw new SecurityValidationError('Command must be a string', 'command', String(cmd))
  }

  // Check for empty or whitespace-only commands
  if (!cmd.trim()) {
    throw new SecurityValidationError('Command cannot be empty or whitespace-only', 'command', cmd)
  }

  // Check for null bytes first
  if (cmd.includes('\0')) {
    throw new SecurityValidationError('Command contains null byte', 'command', cmd)
  }

  // Extract the base command (first word)
  const baseCommand = cmd.trim().split(/\s+/)[0].toLowerCase()

  // Check against dangerous commands
  if (DANGEROUS_COMMANDS.includes(baseCommand)) {
    throw new SecurityValidationError(`Dangerous command detected: ${baseCommand}`, 'command', cmd)
  }

  // Check for dangerous shell metacharacters
  for (const char of DANGEROUS_SHELL_CHARS) {
    if (cmd.includes(char)) {
      throw new SecurityValidationError(
        `Dangerous shell character detected: ${char}`,
        'command',
        cmd,
      )
    }
  }

  // Check for encoded/obfuscated patterns
  const decoded = decodeURIComponent(cmd).toLowerCase()
  if (decoded !== cmd.toLowerCase()) {
    // Command contains URL encoding, check the decoded version too
    for (const dangerousCmd of DANGEROUS_COMMANDS) {
      if (decoded.includes(dangerousCmd)) {
        throw new SecurityValidationError(
          `Dangerous command detected in URL-encoded string: ${dangerousCmd}`,
          'command',
          cmd,
        )
      }
    }
  }
}

/**
 * Validate a path to prevent directory traversal attacks
 *
 * @param basePath - The base directory that access should be restricted to
 * @param relativePath - The relative path to validate
 * @returns The resolved safe path
 * @throws {SecurityValidationError} If the path is unsafe
 *
 * @example
 * ```typescript
 * const safe = validatePath('/tmp/test', 'file.txt')
 * // Returns: '/tmp/test/file.txt'
 *
 * validatePath('/tmp/test', '../../../etc/passwd')
 * // Throws SecurityValidationError
 * ```
 */
export function validatePath(basePath: string, relativePath: string): string {
  if (typeof basePath !== 'string' || typeof relativePath !== 'string') {
    throw new SecurityValidationError(
      'Both basePath and relativePath must be strings',
      'path',
      `basePath: ${basePath}, relativePath: ${relativePath}`,
    )
  }

  // Check for null bytes
  if (basePath.includes('\0') || relativePath.includes('\0')) {
    throw new SecurityValidationError('Path contains null byte', 'path', relativePath)
  }

  // Check for dangerous path traversal patterns
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(relativePath)) {
      throw new SecurityValidationError(
        `Path contains dangerous pattern: ${pattern.source}`,
        'path',
        relativePath,
      )
    }
  }

  // Normalize and resolve paths
  const normalizedBase = normalize(resolve(basePath))
  const targetPath = normalize(resolve(normalizedBase, relativePath))

  // Ensure the target path is within the base directory
  const relativeToParsed = relative(normalizedBase, targetPath)

  // If the relative path starts with '..' or is absolute, it's outside the base
  if (relativeToParsed.startsWith('..') || isAbsolute(relativeToParsed)) {
    throw new SecurityValidationError(
      `Path traversal attempt detected. Target path '${targetPath}' is outside base directory '${normalizedBase}'`,
      'path',
      relativePath,
    )
  }

  return targetPath
}

/**
 * Sanitize a SQL identifier to prevent SQL injection in table/column names
 *
 * @param identifier - The SQL identifier to sanitize
 * @returns The sanitized identifier
 * @throws {SecurityValidationError} If the identifier is invalid
 *
 * @example
 * ```typescript
 * const safe = sanitizeSqlIdentifier('user_table')
 * // Returns: 'user_table'
 *
 * sanitizeSqlIdentifier('table; DROP TABLE users;')
 * // Throws SecurityValidationError
 * ```
 */
export function sanitizeSqlIdentifier(identifier: string): string {
  if (typeof identifier !== 'string') {
    throw new SecurityValidationError('SQL identifier must be a string', 'sql', String(identifier))
  }

  // Check for empty identifier
  if (!identifier.trim()) {
    throw new SecurityValidationError('SQL identifier cannot be empty', 'sql', identifier)
  }

  // SQL identifiers should only contain alphanumeric characters and underscores
  // and should not start with a number
  const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/

  if (!validPattern.test(identifier)) {
    throw new SecurityValidationError(
      'SQL identifier contains invalid characters. Only letters, numbers, and underscores are allowed, and it cannot start with a number',
      'sql',
      identifier,
    )
  }

  // Check length (reasonable limit)
  if (identifier.length > 64) {
    throw new SecurityValidationError(
      'SQL identifier is too long (maximum 64 characters)',
      'sql',
      identifier,
    )
  }

  // Check against SQL reserved words (basic set)
  const reservedWords = [
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'CREATE',
    'DROP',
    'ALTER',
    'TRUNCATE',
    'INDEX',
    'TABLE',
    'DATABASE',
    'SCHEMA',
    'VIEW',
    'TRIGGER',
    'PROCEDURE',
    'FUNCTION',
    'WHERE',
    'FROM',
    'JOIN',
    'INNER',
    'OUTER',
    'LEFT',
    'RIGHT',
    'UNION',
    'GROUP',
    'ORDER',
    'BY',
    'HAVING',
    'LIMIT',
    'OFFSET',
    'DISTINCT',
    'AS',
    'AND',
    'OR',
    'NOT',
    'IN',
    'EXISTS',
    'BETWEEN',
    'LIKE',
    'IS',
    'NULL',
    'TRUE',
    'FALSE',
  ]

  if (reservedWords.includes(identifier.toUpperCase())) {
    throw new SecurityValidationError(
      `SQL identifier cannot be a reserved word: ${identifier}`,
      'sql',
      identifier,
    )
  }

  return identifier
}

/**
 * Properly escape a shell argument to prevent injection
 *
 * @param arg - The argument to escape
 * @returns The escaped argument
 *
 * @example
 * ```typescript
 * const safe = escapeShellArg('hello world; rm -rf /')
 * // Returns: "'hello world; rm -rf /'"
 * ```
 */
export function escapeShellArg(arg: string): string {
  if (typeof arg !== 'string') {
    throw new SecurityValidationError('Shell argument must be a string', 'shell', String(arg))
  }

  // On Windows, use double quotes and escape internal quotes
  if (process.platform === 'win32') {
    // Escape double quotes by doubling them
    const escaped = arg.replace(/"/g, '""')
    return `"${escaped}"`
  }

  // On Unix-like systems, use single quotes
  // Single quotes preserve everything literally except single quotes themselves
  // To include a single quote, we end the quoted string, add an escaped quote, and start a new quoted string
  const escaped = arg.replace(/'/g, "'\"'\"'")
  return `'${escaped}'`
}

/**
 * Comprehensive security validation for shell commands with arguments
 *
 * @param command - The base command
 * @param args - Array of arguments
 * @returns Object with sanitized command and escaped arguments
 *
 * @example
 * ```typescript
 * const result = validateShellExecution('echo', ['hello', 'world; rm -rf /'])
 * // Returns: { command: 'echo', args: ['hello', "'world; rm -rf /'"] }
 * ```
 */
export function validateShellExecution(
  command: string,
  args: string[] = [],
): {
  command: string
  args: string[]
} {
  // Validate the base command
  validateCommand(command)

  // Escape all arguments
  const escapedArgs = args.map((arg) => escapeShellArg(arg))

  return {
    command: sanitizeCommand(command),
    args: escapedArgs,
  }
}

/**
 * Type definitions for better TypeScript support
 */
export type SecurityValidationType = 'command' | 'path' | 'sql' | 'shell'

export interface SecurityValidationOptions {
  /** Whether to throw on validation errors or return validation result */
  strict?: boolean
  /** Custom dangerous commands to check for */
  additionalDangerousCommands?: string[]
  /** Custom allowed file extensions for path validation */
  allowedExtensions?: string[]
}

/**
 * Batch validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: SecurityValidationError[]
  sanitized?: string
}

/**
 * Validate multiple inputs at once
 *
 * @param inputs - Array of validation tasks
 * @returns Array of validation results
 */
export function validateBatch(
  inputs: Array<{
    type: SecurityValidationType
    value: string
    basePath?: string // Required for path validation
  }>,
): ValidationResult[] {
  return inputs.map(({ type, value, basePath }) => {
    try {
      let sanitized: string

      switch (type) {
        case 'command':
          validateCommand(value)
          sanitized = sanitizeCommand(value)
          break
        case 'path':
          if (!basePath) {
            throw new SecurityValidationError(
              'basePath is required for path validation',
              'path',
              value,
            )
          }
          sanitized = validatePath(basePath, value)
          break
        case 'sql':
          sanitized = sanitizeSqlIdentifier(value)
          break
        case 'shell':
          sanitized = escapeShellArg(value)
          break
        default:
          throw new SecurityValidationError(`Unknown validation type: ${type}`, type, value)
      }

      return {
        valid: true,
        errors: [],
        sanitized,
      }
    } catch (error) {
      return {
        valid: false,
        errors: [error as SecurityValidationError],
      }
    }
  })
}
