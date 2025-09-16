/**
 * Local Cache Integration Tests
 *
 * Tests for integration with Turborepo cache system
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'

describe('Local Cache Integration', () => {
  describe('Integration with Turborepo Cache System', () => {
    it('should validate turbo cache configuration exists', () => {
      expect(existsSync('turbo.json')).toBe(true)

      const turboConfig = JSON.parse(readFileSync('turbo.json', 'utf8'))
      expect(turboConfig.tasks).toBeDefined()

      // Verify cache-enabled tasks exist
      const cacheableTasks = Object.entries(turboConfig.tasks)
        .filter(([_, config]: [string, any]) => config.cache === true)
        .map(([name]) => name)

      expect(cacheableTasks).toContain('format')
      expect(cacheableTasks).toContain('format:check')
    })

    it('should ensure cache directory is properly configured', () => {
      // Verify .turbo directory is in .gitignore
      if (existsSync('.gitignore')) {
        const gitignore = readFileSync('.gitignore', 'utf8')
        expect(gitignore).toContain('.turbo')
      }

      // Verify cache directory structure can be created
      const testTaskDir = '.turbo/cache/test-task'
      mkdirSync(testTaskDir, { recursive: true })
      expect(existsSync(testTaskDir)).toBe(true)

      // Cleanup
      rmSync(testTaskDir, { recursive: true, force: true })
    })

    it('should support cache key validation and integrity checks', () => {
      const validateCacheEntry = (key: string, content: string): boolean => {
        // Regenerate hash from content
        const expectedHash = createHash('sha256').update(content).digest('hex')

        // Extract hash from key (assuming key format includes hash)
        const keyHash = key.includes('-') ? key.split('-').pop() : key

        return keyHash === expectedHash.substring(0, keyHash?.length || 8)
      }

      const testContent = 'console.log("test");'
      const contentHash = createHash('sha256').update(testContent).digest('hex')
      const cacheKey = `format-${contentHash.substring(0, 8)}`

      expect(validateCacheEntry(cacheKey, testContent)).toBe(true)
      expect(validateCacheEntry(cacheKey, 'different content')).toBe(false)
    })
  })
})
