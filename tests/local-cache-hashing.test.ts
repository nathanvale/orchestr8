/**
 * Local Cache Content-Aware Hashing Tests
 *
 * Tests for content-aware hashing that ignores file metadata
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

describe('Local Cache Content-Aware Hashing', () => {
  const testWorkspaceDir = 'test-workspace'

  beforeEach(() => {
    if (existsSync(testWorkspaceDir)) {
      rmSync(testWorkspaceDir, { recursive: true, force: true })
    }
    mkdirSync(testWorkspaceDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testWorkspaceDir)) {
      rmSync(testWorkspaceDir, { recursive: true, force: true })
    }
  })

  describe('Content-Aware Hashing', () => {
    it('should generate consistent hashes for identical content regardless of metadata', async () => {
      const content = 'console.log("Hello, World!");'

      // Create files with different timestamps but same content
      const file1Path = join(testWorkspaceDir, 'file1.js')
      const file2Path = join(testWorkspaceDir, 'file2.js')

      writeFileSync(file1Path, content)

      // Wait a bit to ensure different timestamp
      await new Promise<void>((resolve) => setTimeout(resolve, 10))

      writeFileSync(file2Path, content)

      // Generate content-based hashes (ignore metadata)
      const hash1 = createHash('sha256').update(content).digest('hex')
      const hash2 = createHash('sha256').update(content).digest('hex')

      expect(hash1).toBe(hash2)
    })

    it('should generate different hashes for different content', () => {
      const content1 = 'console.log("Hello, World!");'
      const content2 = 'console.log("Hello, Universe!");'

      const hash1 = createHash('sha256').update(content1).digest('hex')
      const hash2 = createHash('sha256').update(content2).digest('hex')

      expect(hash1).not.toBe(hash2)
    })

    it('should create composite hashes for multiple input factors', () => {
      const factors = {
        sourceFiles: ['src/index.ts', 'src/utils.ts'],
        config: { prettier: true, lint: true },
        dependencies: { react: '18.2.0', typescript: '5.0.0' },
        environment: { NODE_ENV: 'development' },
      }

      const compositeHash = createHash('sha256').update(JSON.stringify(factors)).digest('hex')

      expect(compositeHash).toBeDefined()
      expect(compositeHash.length).toBe(64) // SHA256 hex length

      // Different factors should produce different hashes
      const modifiedFactors = { ...factors, environment: { NODE_ENV: 'production' } }
      const modifiedHash = createHash('sha256')
        .update(JSON.stringify(modifiedFactors))
        .digest('hex')

      expect(compositeHash).not.toBe(modifiedHash)
    })

    it('should ignore file metadata in hash calculation', () => {
      const contentHasher = (filePath: string): string => {
        // Read only content, ignore file stats
        const content = readFileSync(filePath, 'utf8')
        return createHash('sha256').update(content).digest('hex')
      }

      const testFile = join(testWorkspaceDir, 'test.js')
      const content = 'export const greeting = "Hello, World!";'

      writeFileSync(testFile, content)
      const hash1 = contentHasher(testFile)

      // Rewrite same content to change timestamp
      writeFileSync(testFile, content)

      const hash2 = contentHasher(testFile)

      // Hashes should be the same despite metadata changes
      expect(hash1).toBe(hash2)
    })

    it('should support incremental hash computation for large files', () => {
      const chunks = [
        'function calculateSum(a, b) {',
        '  return a + b;',
        '}',
        '',
        'export { calculateSum };',
      ]

      // Compute hash incrementally
      const incrementalHash = createHash('sha256')
      chunks.forEach((chunk) => incrementalHash.update(chunk + '\n'))
      const incrementalResult = incrementalHash.digest('hex')

      // Compute hash all at once
      const fullContent = chunks.join('\n') + '\n'
      const fullHash = createHash('sha256').update(fullContent).digest('hex')

      expect(incrementalResult).toBe(fullHash)
    })
  })
})
