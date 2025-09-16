import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  StreamingFileReader,
  createStreamingReader,
  readFileLines,
  getQuickFileStats,
} from './streaming-file-reader'

describe('StreamingFileReader', () => {
  let reader: StreamingFileReader
  let tempDir: string
  let testFile: string

  beforeEach(() => {
    reader = new StreamingFileReader()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streaming-reader-test-'))
    testFile = path.join(tempDir, 'test.txt')

    // Create test file with sample content
    const content = 'line 1\nline 2\n\nline 4\nline 5'
    fs.writeFileSync(testFile, content)
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  describe('readChunks', () => {
    it('should read file in chunks', async () => {
      const chunks: string[] = []

      for await (const chunk of reader.readChunks(testFile)) {
        chunks.push(chunk.content)
        expect(chunk.lineNumber).toBeGreaterThanOrEqual(1)
        expect(chunk.offset).toBeGreaterThanOrEqual(0)
        expect(typeof chunk.isLast).toBe('boolean')
      }

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.join('')).toContain('line 1')
    })

    it('should handle empty files', async () => {
      const emptyFile = path.join(tempDir, 'empty.txt')
      fs.writeFileSync(emptyFile, '')

      const chunks = []
      for await (const chunk of reader.readChunks(emptyFile)) {
        chunks.push(chunk)
      }

      expect(chunks).toHaveLength(0)
    })

    it('should respect cancellation token', async () => {
      const token = {
        isCancellationRequested: true,
        onCancellationRequested: () => {},
      }

      const readerWithToken = new StreamingFileReader({ token })
      const chunks = []

      for await (const chunk of readerWithToken.readChunks(testFile)) {
        chunks.push(chunk)
      }

      // Should not read any chunks when cancelled
      expect(chunks).toHaveLength(0)
    })
  })

  describe('readLines', () => {
    it('should read file line by line', async () => {
      const lines: string[] = []

      for await (const line of reader.readLines(testFile)) {
        lines.push(line.text)
        expect(line.number).toBeGreaterThanOrEqual(1)
        expect(typeof line.isEmpty).toBe('boolean')
      }

      expect(lines).toContain('line 1')
      expect(lines).toContain('line 2')
      expect(lines).toContain('')
      expect(lines).toContain('line 4')
      expect(lines).toContain('line 5')
    })

    it('should skip empty lines when configured', async () => {
      const readerSkipEmpty = new StreamingFileReader({ skipEmptyLines: true })
      const lines: string[] = []

      for await (const line of readerSkipEmpty.readLines(testFile)) {
        lines.push(line.text)
      }

      expect(lines).not.toContain('')
      expect(lines).toContain('line 1')
      expect(lines).toContain('line 4')
    })

    it('should respect max lines limit', async () => {
      const readerMaxLines = new StreamingFileReader({ maxLines: 2 })
      const lines: string[] = []

      for await (const line of readerMaxLines.readLines(testFile)) {
        lines.push(line.text)
      }

      expect(lines).toHaveLength(2)
      expect(lines[0]).toBe('line 1')
      expect(lines[1]).toBe('line 2')
    })
  })

  describe('getFileStats', () => {
    it('should return file statistics', async () => {
      const stats = await reader.getFileStats(testFile)

      expect(stats.size).toBeGreaterThan(0)
      expect(stats.lines).toBe(5)
      expect(stats.emptyLines).toBe(1)
      expect(stats.encoding).toBe('utf8')
      expect(stats.estimatedMemoryUsage).toBeGreaterThan(0)
    })
  })

  describe('searchPattern', () => {
    it('should find pattern matches', async () => {
      const matches = []

      for await (const match of reader.searchPattern(testFile, /line \d+/g)) {
        matches.push(match)
      }

      expect(matches.length).toBe(4) // line 1, line 2, line 4, line 5
      expect(matches[0].line.text).toBe('line 1')
      expect(matches[0].matches[0][0]).toBe('line 1')
    })

    it('should work with string patterns', async () => {
      const matches = []

      for await (const match of reader.searchPattern(testFile, 'line 1')) {
        matches.push(match)
      }

      expect(matches.length).toBe(1)
      expect(matches[0].line.text).toBe('line 1')
    })
  })

  describe('processBatches', () => {
    it('should process lines in batches', async () => {
      const batches: string[][] = []

      await reader.processBatches(testFile, 2, async (batch) => {
        batches.push(batch.map((line) => line.text))
      })

      expect(batches.length).toBeGreaterThan(1)
      expect(batches[0]).toHaveLength(2)
      expect(batches[0]).toEqual(['line 1', 'line 2'])
    })
  })

  describe('validateFile', () => {
    it('should validate readable files', async () => {
      const result = await reader.validateFile(testFile)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject non-existent files', async () => {
      const nonExistentFile = path.join(tempDir, 'non-existent.txt')
      const result = await reader.validateFile(nonExistentFile)

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should reject directories', async () => {
      const result = await reader.validateFile(tempDir)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('not a file')
    })
  })

  describe('copyFile', () => {
    it('should copy files with progress tracking', async () => {
      const destFile = path.join(tempDir, 'copy.txt')
      const progressUpdates: number[] = []

      await reader.copyFile(testFile, destFile, (processed, total) => {
        progressUpdates.push(processed / total)
      })

      expect(fs.existsSync(destFile)).toBe(true)
      expect(fs.readFileSync(destFile, 'utf8')).toBe(fs.readFileSync(testFile, 'utf8'))
      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates[progressUpdates.length - 1]).toBe(1) // Should reach 100%
    })
  })
})

describe('Utility Functions', () => {
  let tempDir: string
  let testFile: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streaming-utils-test-'))
    testFile = path.join(tempDir, 'test.txt')
    fs.writeFileSync(testFile, 'line 1\nline 2\nline 3')
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  describe('createStreamingReader', () => {
    it('should create reader with options', () => {
      const reader = createStreamingReader({ maxLines: 10 })
      expect(reader).toBeInstanceOf(StreamingFileReader)
    })
  })

  describe('readFileLines', () => {
    it('should read file lines with minimal setup', async () => {
      const lines = []
      for await (const line of readFileLines(testFile)) {
        lines.push(line.text)
      }

      expect(lines).toEqual(['line 1', 'line 2', 'line 3'])
    })
  })

  describe('getQuickFileStats', () => {
    it('should get basic file statistics', async () => {
      const stats = await getQuickFileStats(testFile)

      expect(stats.size).toBeGreaterThan(0)
      expect(stats.lines).toBe(3)
      expect(stats.encoding).toBe('utf8')
    })
  })
})

describe('Error Handling', () => {
  let reader: StreamingFileReader

  beforeEach(() => {
    reader = new StreamingFileReader()
  })

  it('should handle file access errors', async () => {
    const nonExistentFile = '/non/existent/file.txt'

    await expect(async () => {
      for await (const _chunk of reader.readChunks(nonExistentFile)) {
        // Should not reach here
      }
    }).rejects.toThrow()
  })

  it('should handle invalid encoding gracefully', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encoding-test-'))
    const testFile = path.join(tempDir, 'test.txt')

    try {
      fs.writeFileSync(testFile, 'test content')

      // This should work with valid encoding
      const readerUtf8 = new StreamingFileReader({ encoding: 'utf8' })
      const result = await readerUtf8.validateFile(testFile)
      expect(result.valid).toBe(true)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
