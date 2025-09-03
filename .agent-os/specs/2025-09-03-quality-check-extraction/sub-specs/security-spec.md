# Security Specification

This is the security specification for the spec detailed in
@.agent-os/specs/2025-09-03-quality-check-extraction/spec.md

> Created: 2025-09-03  
> Version: 2.0.0

## NPM Package Security

### Package.json Security Configuration

```json
{
  "name": "@template/quality-check",
  "version": "2.0.0",
  "private": false,
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "files": ["dist", "README.md", "LICENSE", "package.json"],
  "scripts": {
    "prepublishOnly": "npm audit --audit-level=high && npm run build && npm test",
    "postinstall": "node scripts/verify-integrity.js"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  },
  "os": ["darwin", "linux"],
  "cpu": ["x64", "arm64"]
}
```

### Dependency Security

```typescript
// scripts/verify-integrity.js
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

function verifyIntegrity() {
  const lockfile = require('../package-lock.json')

  for (const [name, details] of Object.entries(lockfile.packages)) {
    if (!name || name === '') continue

    const packagePath = path.join(__dirname, '..', name)
    if (!fs.existsSync(packagePath)) continue

    // Verify integrity hash
    if (details.integrity) {
      const actualHash = calculateIntegrity(packagePath)
      if (actualHash !== details.integrity) {
        throw new Error(`Integrity check failed for ${name}`)
      }
    }
  }
}

function calculateIntegrity(dirPath) {
  // Implementation of SRI hash calculation
  const hash = crypto.createHash('sha512')
  // ... hash all files in directory
  return `sha512-${hash.digest('base64')}`
}

// Run verification
try {
  verifyIntegrity()
  console.log('✅ Package integrity verified')
} catch (error) {
  console.error('❌ Package integrity check failed:', error.message)
  process.exit(1)
}
```

## Path Security

### Path Traversal Prevention

```typescript
export class PathValidator {
  constructor(private readonly projectRoot: string) {}

  validatePath(filepath: string): string {
    const resolved = path.resolve(this.projectRoot, filepath)

    // Prevent path traversal attacks
    if (!resolved.startsWith(this.projectRoot)) {
      throw new SecurityError(`Path traversal detected: ${filepath}`)
    }

    // Check for symbolic links
    const realPath = fs.realpathSync(resolved)
    if (!realPath.startsWith(this.projectRoot)) {
      throw new SecurityError(`Symlink escape detected: ${filepath}`)
    }

    return resolved
  }

  isIgnored(filepath: string): boolean {
    const ignorePatterns = [
      'node_modules/**',
      '.git/**',
      '*.min.js',
      '*.map',
      'dist/**',
      'build/**',
      'coverage/**',
      '.cache/**',
    ]

    return micromatch.isMatch(filepath, ignorePatterns)
  }
}
```

### File Access Validation

```typescript
export class FileAccessValidator {
  private readonly maxFileSizeMB = 10
  private readonly allowedExtensions = [
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.mjs',
    '.cjs',
  ]

  async validateFile(filepath: string): Promise<void> {
    // Check file exists
    try {
      await fs.access(filepath, fs.constants.R_OK)
    } catch {
      throw new Error(`Cannot read file: ${filepath}`)
    }

    // Check file size
    const stats = await fs.stat(filepath)
    const sizeMB = stats.size / 1024 / 1024

    if (sizeMB > this.maxFileSizeMB) {
      throw new Error(
        `File too large: ${sizeMB}MB (max: ${this.maxFileSizeMB}MB)`,
      )
    }

    // Check file extension
    const ext = path.extname(filepath).toLowerCase()
    if (!this.allowedExtensions.includes(ext)) {
      throw new Error(`Unsupported file type: ${ext}`)
    }

    // Check if binary file
    if (await this.isBinaryFile(filepath)) {
      throw new Error(`Binary files not supported: ${filepath}`)
    }
  }

  private async isBinaryFile(filepath: string): Promise<boolean> {
    const buffer = await fs.readFile(filepath, { encoding: null })
    const slice = buffer.slice(0, 512)

    // Check for null bytes (common in binary files)
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] === 0) return true
    }

    return false
  }
}
```

## Input Sanitization

### JSON Input Validation

```typescript
export class InputSanitizer {
  private readonly maxJSONSize = 1024 * 1024 // 1MB

  sanitizeFilePath(input: string): string {
    // Remove null bytes
    let sanitized = input.replace(/\0/g, '')

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '')

    // Normalize path separators
    sanitized = sanitized.replace(/\\/g, '/')

    // Remove multiple slashes
    sanitized = sanitized.replace(/\/+/g, '/')

    // Remove relative path components
    const parts = sanitized.split('/')
    const cleaned = parts.filter(
      (part) => part !== '.' && part !== '..' && part !== '',
    )

    return cleaned.join('/')
  }

  sanitizeCommand(input: string): string {
    // Remove shell metacharacters
    return input.replace(/[;&|`$<>(){}[\]!*?~^'"\\\n\r]/g, '')
  }

  validateJSON(input: string): object {
    try {
      // Check size limit
      if (input.length > this.maxJSONSize) {
        throw new Error('JSON input too large')
      }

      // Parse with prototype pollution protection
      const parsed = JSON.parse(input, (key, value) => {
        // Reject __proto__ and constructor keys
        if (
          key === '__proto__' ||
          key === 'constructor' ||
          key === 'prototype'
        ) {
          throw new Error('Prototype pollution attempt detected')
        }
        return value
      })

      // Validate structure
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Invalid JSON structure')
      }

      // Deep freeze to prevent modification
      return this.deepFreeze(parsed)
    } catch (error) {
      throw new Error(`Invalid JSON input: ${error.message}`)
    }
  }

  private deepFreeze(obj: any): any {
    Object.freeze(obj)
    Object.getOwnPropertyNames(obj).forEach((prop) => {
      if (
        obj[prop] !== null &&
        (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') &&
        !Object.isFrozen(obj[prop])
      ) {
        this.deepFreeze(obj[prop])
      }
    })
    return obj
  }
}
```

## Environment Variable Security

### Secure Environment Variable Access

```typescript
export class SecureEnvironment {
  private readonly allowedEnvVars = new Set([
    'CLAUDE_PROJECT_DIR',
    'CLAUDE_FILE_PATHS',
    'QUALITY_CHECK_CACHE',
    'QUALITY_CHECK_MODE',
    'QUALITY_CHECK_LOG_LEVEL',
    'QUALITY_CHECK_TIMEOUT',
    'NODE_ENV',
    'NODE_COMPILE_CACHE',
    'LOG_LEVEL',
    'DEBUG',
    'VERBOSE',
  ])

  private readonly sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /key/i,
    /auth/i,
    /credential/i,
    /private/i,
  ]

  getEnvVar(name: string): string | undefined {
    // Check if allowed
    if (!this.allowedEnvVars.has(name)) {
      console.warn(`Access to environment variable '${name}' denied`)
      return undefined
    }

    const value = process.env[name]

    // Validate value doesn't contain injection attempts
    if (value && this.containsInjection(value)) {
      console.error(`Potential injection in env var '${name}'`)
      return undefined
    }

    // Warn if accessing potentially sensitive vars
    if (this.sensitivePatterns.some((pattern) => pattern.test(name))) {
      console.warn(`Accessing potentially sensitive env var: ${name}`)
    }

    return value
  }

  private containsInjection(value: string): boolean {
    const dangerousPatterns = [
      /\$\{.*\}/, // Template injection
      /\$\(.*\)/, // Command substitution
      /`.*`/, // Backtick execution
      /;.*$/, // Command chaining
      /\|\|/, // OR operator
      /&&/, // AND operator
      /\|/, // Pipe operator
      />/, // Redirect operator
      /</, // Input redirect
    ]

    return dangerousPatterns.some((pattern) => pattern.test(value))
  }

  sanitizeEnvValue(value: string): string {
    // Remove potentially dangerous characters
    return value.replace(/[`${}()[\]|;&<>\\]/g, '')
  }
}
```

## Resource Limits

### Resource Management

```typescript
export class ResourceLimiter {
  private readonly limits = {
    maxMemoryMB: 512,
    maxFileSizeMB: 10,
    maxFiles: 100,
    maxTimeout: 30000, // 30 seconds
    maxConcurrency: 4,
  }

  private activeOperations = 0
  private memoryCheckInterval: NodeJS.Timer | null = null

  constructor() {
    this.startMemoryMonitoring()
  }

  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage()
    }, 5000) // Check every 5 seconds
  }

  checkMemoryUsage(): void {
    const usage = process.memoryUsage()
    const heapUsedMB = usage.heapUsed / 1024 / 1024

    if (heapUsedMB > this.limits.maxMemoryMB) {
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      // Check again after GC
      const newUsage = process.memoryUsage()
      const newHeapUsedMB = newUsage.heapUsed / 1024 / 1024

      if (newHeapUsedMB > this.limits.maxMemoryMB) {
        console.error(`Memory limit exceeded: ${newHeapUsedMB}MB`)
        process.exit(5) // Exit with timeout code
      }
    }
  }

  async checkConcurrency(): Promise<void> {
    if (this.activeOperations >= this.limits.maxConcurrency) {
      // Wait for a slot to become available
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.activeOperations < this.limits.maxConcurrency) {
            clearInterval(checkInterval)
            resolve(undefined)
          }
        }, 100)
      })
    }

    this.activeOperations++
  }

  releaseOperation(): void {
    this.activeOperations--
  }

  createTimeout(seconds: number = 30): AbortController {
    const maxSeconds = Math.min(seconds, this.limits.maxTimeout / 1000)
    const controller = new AbortController()

    const timeout = setTimeout(() => {
      controller.abort()
    }, maxSeconds * 1000)

    // Clean up timeout when done
    controller.signal.addEventListener('abort', () => {
      clearTimeout(timeout)
    })

    return controller
  }

  cleanup(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval)
      this.memoryCheckInterval = null
    }
  }
}
```

## Process Security

### Process Lifecycle Security

```typescript
export class SecureProcessLifecycle {
  private cleanupHandlers: Array<() => Promise<void>> = []
  private isCleaningUp = false

  constructor() {
    // Register signal handlers
    this.registerSignalHandlers()

    // Prevent process manipulation
    this.hardenProcess()
  }

  private registerSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP']

    signals.forEach((signal) => {
      process.on(signal, async () => {
        if (this.isCleaningUp) return
        this.isCleaningUp = true

        console.log(`Received ${signal}, cleaning up...`)
        await this.cleanup(signal)

        // Exit with appropriate code
        const exitCode = signal === 'SIGINT' ? 130 : 1
        process.exit(exitCode)
      })
    })

    // Handle uncaught errors securely
    process.on('uncaughtException', (error) => {
      // Don't log sensitive information
      const sanitizedError = this.sanitizeError(error)
      console.error('Uncaught exception:', sanitizedError)
      this.cleanup('uncaughtException')
    })

    process.on('unhandledRejection', (reason) => {
      // Don't log sensitive information
      const sanitizedReason = this.sanitizeError(reason)
      console.error('Unhandled rejection:', sanitizedReason)
      this.cleanup('unhandledRejection')
    })
  }

  private hardenProcess(): void {
    // Prevent modification of global objects
    Object.freeze(Object.prototype)
    Object.freeze(Array.prototype)
    Object.freeze(Function.prototype)

    // Set secure process title
    process.title = 'quality-check'

    // Clear sensitive environment variables
    const sensitiveVars = [
      'AWS_SECRET_ACCESS_KEY',
      'DATABASE_PASSWORD',
      'API_KEY',
    ]
    sensitiveVars.forEach((varName) => {
      delete process.env[varName]
    })
  }

  private sanitizeError(error: any): string {
    if (!error) return 'Unknown error'

    // Remove sensitive patterns from error messages
    let message = error.message || error.toString()

    // Remove file paths that might expose system structure
    message = message.replace(/\/[^\s]+/g, '[path]')

    // Remove potential secrets (common patterns)
    message = message.replace(/[a-zA-Z0-9]{32,}/g, '[redacted]')

    return message
  }

  registerCleanup(handler: () => Promise<void>): void {
    this.cleanupHandlers.push(handler)
  }

  private async cleanup(signal: string): Promise<void> {
    // Run all cleanup handlers with timeout
    const cleanupPromises = this.cleanupHandlers.map((handler) =>
      Promise.race([
        handler().catch((err) =>
          console.error('Cleanup handler failed:', this.sanitizeError(err)),
        ),
        new Promise((resolve) => setTimeout(resolve, 5000)), // 5s timeout
      ]),
    )

    await Promise.all(cleanupPromises)
  }
}
```

## Security Audit Logging

### Security Event Logger

```typescript
export class SecurityLogger {
  private readonly logFile: string

  constructor(projectRoot: string) {
    this.logFile = path.join(
      projectRoot,
      '.cache',
      'quality-check',
      'security.log',
    )
    this.ensureLogDirectory()
  }

  private ensureLogDirectory(): void {
    const dir = path.dirname(this.logFile)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 }) // Restricted permissions
    }
  }

  logSecurityEvent(event: SecurityEvent): void {
    const entry = {
      timestamp: new Date().toISOString(),
      ...event,
      pid: process.pid,
      uid: process.getuid?.() || null,
    }

    // Append to log file with restricted permissions
    fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n', {
      mode: 0o600,
    })
  }

  logPathTraversalAttempt(filepath: string): void {
    this.logSecurityEvent({
      type: 'PATH_TRAVERSAL_ATTEMPT',
      severity: 'high',
      filepath,
      message: 'Path traversal attempt blocked',
    })
  }

  logInjectionAttempt(input: string, type: string): void {
    this.logSecurityEvent({
      type: 'INJECTION_ATTEMPT',
      severity: 'high',
      inputType: type,
      message: 'Injection attempt blocked',
      // Don't log the actual malicious input
      inputLength: input.length,
    })
  }

  logResourceLimit(resource: string, limit: number, actual: number): void {
    this.logSecurityEvent({
      type: 'RESOURCE_LIMIT_EXCEEDED',
      severity: 'medium',
      resource,
      limit,
      actual,
      message: `Resource limit exceeded: ${resource}`,
    })
  }
}

interface SecurityEvent {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  [key: string]: any
}
```
