/**
 * Tests for temp directory management utilities
 */

import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createTempDirectory,
  createNamedTempDirectory,
  createMultipleTempDirectories,
  cleanupMultipleTempDirectories,
  type TempDirectory,
  type DirectoryStructure,
} from '../temp.js'
import { SecurityValidationError } from '../../security/index.js'

describe('createTempDirectory', () => {
  let tempDirs: TempDirectory[] = []

  afterEach(async () => {
    // Clean up all created temp directories
    await Promise.allSettled(tempDirs.map((dir) => dir.cleanup()))
    tempDirs = []
  })

  it('should create a temporary directory with default options', async () => {
    const tempDir = await createTempDirectory()
    tempDirs.push(tempDir)

    expect(tempDir.path).toMatch(/^\/.*\/test-.*/)
    expect(tempDir.path.startsWith(tmpdir())).toBe(true)

    // Verify directory exists
    const stat = await fs.stat(tempDir.path)
    expect(stat.isDirectory()).toBe(true)
  })

  it('should create a temporary directory with custom prefix', async () => {
    const tempDir = await createTempDirectory({ prefix: 'custom-test-' })
    tempDirs.push(tempDir)

    expect(tempDir.path).toMatch(/\/custom-test-.*/)

    // Verify directory exists
    const stat = await fs.stat(tempDir.path)
    expect(stat.isDirectory()).toBe(true)
  })

  it('should create a temporary directory without random suffix', async () => {
    const tempDir = await createTempDirectory({
      prefix: 'fixed-test-',
      randomSuffix: false,
    })
    tempDirs.push(tempDir)

    expect(tempDir.path).toMatch(/\/fixed-test-\d+$/)

    // Verify directory exists
    const stat = await fs.stat(tempDir.path)
    expect(stat.isDirectory()).toBe(true)
  })

  it('should create a temporary directory in custom parent', async () => {
    const customParent = await createTempDirectory()
    tempDirs.push(customParent)

    const tempDir = await createTempDirectory({
      prefix: 'nested-',
      parent: customParent.path,
    })
    tempDirs.push(tempDir)

    expect(tempDir.path.startsWith(customParent.path)).toBe(true)

    // Verify directory exists
    const stat = await fs.stat(tempDir.path)
    expect(stat.isDirectory()).toBe(true)
  })

  describe('TempDirectory interface', () => {
    let tempDir: TempDirectory

    beforeEach(async () => {
      tempDir = await createTempDirectory()
      tempDirs.push(tempDir)
    })

    it('should write files to temp directory', async () => {
      const filePath = await tempDir.writeFile('test.txt', 'Hello, World!')

      expect(filePath).toBe(join(tempDir.path, 'test.txt'))

      const content = await fs.readFile(filePath, 'utf-8')
      expect(content).toBe('Hello, World!')
    })

    it('should write files with nested paths', async () => {
      const filePath = await tempDir.writeFile('nested/deep/file.txt', 'Nested content')

      expect(filePath).toBe(join(tempDir.path, 'nested/deep/file.txt'))

      const content = await fs.readFile(filePath, 'utf-8')
      expect(content).toBe('Nested content')

      // Verify parent directories were created
      const parentStat = await fs.stat(dirname(filePath))
      expect(parentStat.isDirectory()).toBe(true)
    })

    it('should write binary files', async () => {
      const binaryData = Buffer.from([1, 2, 3, 4, 5])
      const filePath = await tempDir.writeFile('binary.dat', binaryData)

      const readData = await fs.readFile(filePath)
      expect(readData).toEqual(binaryData)
    })

    it('should create directories', async () => {
      const dirPath = await tempDir.mkdir('subdir')

      expect(dirPath).toBe(join(tempDir.path, 'subdir'))

      const stat = await fs.stat(dirPath)
      expect(stat.isDirectory()).toBe(true)
    })

    it('should create nested directories', async () => {
      const dirPath = await tempDir.mkdir('deep/nested/dirs')

      expect(dirPath).toBe(join(tempDir.path, 'deep/nested/dirs'))

      const stat = await fs.stat(dirPath)
      expect(stat.isDirectory()).toBe(true)
    })

    it('should get path for files and directories', () => {
      const filePath = tempDir.getPath('file.txt')
      const dirPath = tempDir.getPath('subdir')
      const nestedPath = tempDir.getPath('nested/file.txt')

      expect(filePath).toBe(join(tempDir.path, 'file.txt'))
      expect(dirPath).toBe(join(tempDir.path, 'subdir'))
      expect(nestedPath).toBe(join(tempDir.path, 'nested/file.txt'))
    })

    it('should read files from temp directory', async () => {
      await tempDir.writeFile('read-test.txt', 'Read this content')

      const content = await tempDir.readFile('read-test.txt')
      expect(content).toBe('Read this content')
    })

    it('should check if files exist', async () => {
      await tempDir.writeFile('exists.txt', 'I exist')
      await tempDir.mkdir('exists-dir')

      expect(await tempDir.exists('exists.txt')).toBe(true)
      expect(await tempDir.exists('exists-dir')).toBe(true)
      expect(await tempDir.exists('nonexistent.txt')).toBe(false)
      expect(await tempDir.exists('nonexistent-dir')).toBe(false)
    })

    it('should list directory contents', async () => {
      await tempDir.writeFile('file1.txt', 'content1')
      await tempDir.writeFile('file2.txt', 'content2')
      await tempDir.mkdir('subdir')

      const contents = await tempDir.readdir()
      expect(contents.sort()).toEqual(['file1.txt', 'file2.txt', 'subdir'].sort())
    })

    it('should list subdirectory contents', async () => {
      await tempDir.mkdir('subdir')
      await tempDir.writeFile('subdir/nested.txt', 'nested content')

      const contents = await tempDir.readdir('subdir')
      expect(contents).toEqual(['nested.txt'])
    })

    it('should copy files into temp directory', async () => {
      // Create a source file first
      const sourceDir = await createTempDirectory()
      tempDirs.push(sourceDir)
      await sourceDir.writeFile('source.txt', 'Source content')

      const destPath = await tempDir.copyFileIn(sourceDir.getPath('source.txt'), 'copied.txt')

      expect(destPath).toBe(join(tempDir.path, 'copied.txt'))

      const content = await tempDir.readFile('copied.txt')
      expect(content).toBe('Source content')
    })

    it('should copy files with nested destination paths', async () => {
      // Create a source file first
      const sourceDir = await createTempDirectory()
      tempDirs.push(sourceDir)
      await sourceDir.writeFile('source.txt', 'Source content')

      const destPath = await tempDir.copyFileIn(
        sourceDir.getPath('source.txt'),
        'nested/path/copied.txt',
      )

      expect(destPath).toBe(join(tempDir.path, 'nested/path/copied.txt'))

      const content = await tempDir.readFile('nested/path/copied.txt')
      expect(content).toBe('Source content')
    })

    it('should create directory structure from object', async () => {
      const structure: DirectoryStructure = {
        'file1.txt': 'Content of file 1',
        'subdir': {
          'file2.txt': 'Content of file 2',
          'nested': {
            'file3.txt': 'Content of file 3',
          },
        },
        'another-file.txt': 'Another content',
      }

      await tempDir.createStructure(structure)

      // Verify files were created
      expect(await tempDir.readFile('file1.txt')).toBe('Content of file 1')
      expect(await tempDir.readFile('subdir/file2.txt')).toBe('Content of file 2')
      expect(await tempDir.readFile('subdir/nested/file3.txt')).toBe('Content of file 3')
      expect(await tempDir.readFile('another-file.txt')).toBe('Another content')

      // Verify directories exist
      expect(await tempDir.exists('subdir')).toBe(true)
      expect(await tempDir.exists('subdir/nested')).toBe(true)
    })

    it('should cleanup temp directory and all contents', async () => {
      // Create some files and directories
      await tempDir.writeFile('file.txt', 'content')
      await tempDir.mkdir('subdir')
      await tempDir.writeFile('subdir/nested.txt', 'nested')

      // Verify they exist
      expect(await tempDir.exists('file.txt')).toBe(true)
      expect(await tempDir.exists('subdir')).toBe(true)
      expect(await tempDir.exists('subdir/nested.txt')).toBe(true)

      // Cleanup
      await tempDir.cleanup()

      // Verify directory is gone
      await expect(fs.access(tempDir.path)).rejects.toThrow()

      // Remove from cleanup list since we already cleaned up
      tempDirs = tempDirs.filter((dir) => dir !== tempDir)
    })

    it('should handle cleanup gracefully when directory does not exist', async () => {
      await tempDir.cleanup()

      // Cleanup again should not throw
      await expect(tempDir.cleanup()).resolves.toBeUndefined()

      // Remove from cleanup list since we already cleaned up
      tempDirs = tempDirs.filter((dir) => dir !== tempDir)
    })
  })
})

describe('createNamedTempDirectory', () => {
  let tempDirs: TempDirectory[] = []

  afterEach(async () => {
    await Promise.allSettled(tempDirs.map((dir) => dir.cleanup()))
    tempDirs = []
  })

  it('should create temp directory with specific name prefix', async () => {
    const tempDir = await createNamedTempDirectory('my-test')
    tempDirs.push(tempDir)

    expect(tempDir.path).toMatch(/\/test-my-test-.*/)

    const stat = await fs.stat(tempDir.path)
    expect(stat.isDirectory()).toBe(true)
  })

  it('should create unique directories for same name', async () => {
    const tempDir1 = await createNamedTempDirectory('same-name')
    const tempDir2 = await createNamedTempDirectory('same-name')
    tempDirs.push(tempDir1, tempDir2)

    expect(tempDir1.path).not.toBe(tempDir2.path)
    expect(tempDir1.path).toMatch(/\/test-same-name-.*/)
    expect(tempDir2.path).toMatch(/\/test-same-name-.*/)

    // Both should exist
    const stat1 = await fs.stat(tempDir1.path)
    const stat2 = await fs.stat(tempDir2.path)
    expect(stat1.isDirectory()).toBe(true)
    expect(stat2.isDirectory()).toBe(true)
  })
})

describe('createMultipleTempDirectories', () => {
  let tempDirs: TempDirectory[] = []

  afterEach(async () => {
    await Promise.allSettled(tempDirs.map((dir) => dir.cleanup()))
    tempDirs = []
  })

  it('should create multiple temp directories', async () => {
    const dirs = await createMultipleTempDirectories(3)
    tempDirs.push(...dirs)

    expect(dirs).toHaveLength(3)

    // All should be unique
    const paths = dirs.map((dir) => dir.path)
    const uniquePaths = new Set(paths)
    expect(uniquePaths.size).toBe(3)

    // All should exist
    for (const dir of dirs) {
      const stat = await fs.stat(dir.path)
      expect(stat.isDirectory()).toBe(true)
    }
  })

  it('should create multiple temp directories with custom options', async () => {
    const dirs = await createMultipleTempDirectories(2, {
      prefix: 'multi-test-',
    })
    tempDirs.push(...dirs)

    expect(dirs).toHaveLength(2)

    for (const dir of dirs) {
      expect(dir.path).toMatch(/\/multi-test-.*/)
      const stat = await fs.stat(dir.path)
      expect(stat.isDirectory()).toBe(true)
    }
  })

  it('should handle creating zero directories', async () => {
    const dirs = await createMultipleTempDirectories(0)

    expect(dirs).toHaveLength(0)
  })
})

describe('cleanupMultipleTempDirectories', () => {
  it('should cleanup multiple temp directories', async () => {
    const dirs = await createMultipleTempDirectories(3)

    // Create some content
    await dirs[0].writeFile('test1.txt', 'content1')
    await dirs[1].writeFile('test2.txt', 'content2')
    await dirs[2].mkdir('subdir')

    // Verify they exist
    for (const dir of dirs) {
      const stat = await fs.stat(dir.path)
      expect(stat.isDirectory()).toBe(true)
    }

    // Cleanup all
    await cleanupMultipleTempDirectories(dirs)

    // Verify they're gone
    for (const dir of dirs) {
      await expect(fs.access(dir.path)).rejects.toThrow()
    }
  })

  it('should handle cleanup errors gracefully', async () => {
    const dirs = await createMultipleTempDirectories(2)

    // Manually cleanup one
    await dirs[0].cleanup()

    // Cleanup all should not throw even though one is already gone
    await expect(cleanupMultipleTempDirectories(dirs)).resolves.toBeUndefined()
  })

  it('should handle empty array', async () => {
    await expect(cleanupMultipleTempDirectories([])).resolves.toBeUndefined()
  })
})

describe('error handling', () => {
  let tempDirs: TempDirectory[] = []

  afterEach(async () => {
    await Promise.allSettled(tempDirs.map((dir) => dir.cleanup()))
    tempDirs = []
  })

  it('should handle read file errors', async () => {
    const tempDir = await createTempDirectory()
    tempDirs.push(tempDir)

    await expect(tempDir.readFile('nonexistent.txt')).rejects.toThrow()
  })

  it('should handle readdir errors', async () => {
    const tempDir = await createTempDirectory()
    tempDirs.push(tempDir)

    await expect(tempDir.readdir('nonexistent-dir')).rejects.toThrow()
  })

  it('should handle copy file errors', async () => {
    const tempDir = await createTempDirectory()
    tempDirs.push(tempDir)

    await expect(tempDir.copyFileIn('/nonexistent/source.txt', 'dest.txt')).rejects.toThrow()
  })
})

describe('performance', () => {
  let tempDirs: TempDirectory[] = []

  afterEach(async () => {
    await Promise.allSettled(tempDirs.map((dir) => dir.cleanup()))
    tempDirs = []
  })

  it('should create temp directories quickly', async () => {
    const start = Date.now()

    const tempDir = await createTempDirectory()
    tempDirs.push(tempDir)

    const duration = Date.now() - start
    expect(duration).toBeLessThan(1000) // Should take less than 1 second
  })

  it('should handle many small files efficiently', async () => {
    const tempDir = await createTempDirectory()
    tempDirs.push(tempDir)

    const start = Date.now()

    // Create 100 small files
    const promises = Array.from({ length: 100 }, (_, i) =>
      tempDir.writeFile(`file${i}.txt`, `Content ${i}`),
    )

    await Promise.all(promises)

    const duration = Date.now() - start
    expect(duration).toBeLessThan(5000) // Should take less than 5 seconds

    // Verify all files exist
    const contents = await tempDir.readdir()
    expect(contents).toHaveLength(100)
  })
})

describe('security - path traversal prevention', () => {
  let tempDirs: TempDirectory[] = []

  afterEach(async () => {
    await Promise.allSettled(tempDirs.map((dir) => dir.cleanup()))
    tempDirs = []
  })

  describe('writeFile security', () => {
    it('should prevent path traversal with ../', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(tempDir.writeFile('../../../etc/passwd', 'malicious')).rejects.toThrow(
        SecurityValidationError,
      )
    })

    it('should prevent path traversal with ..\\', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(
        tempDir.writeFile('..\\..\\windows\\system32\\evil.txt', 'malicious'),
      ).rejects.toThrow(SecurityValidationError)
    })

    it('should prevent absolute path access', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(tempDir.writeFile('/etc/passwd', 'malicious')).rejects.toThrow(
        SecurityValidationError,
      )
    })

    it('should prevent Windows absolute path access', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(
        tempDir.writeFile('C:\\Windows\\System32\\evil.txt', 'malicious'),
      ).rejects.toThrow(SecurityValidationError)
    })

    it('should prevent null byte injection', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(tempDir.writeFile('file.txt\x00.exe', 'malicious')).rejects.toThrow(
        SecurityValidationError,
      )
    })

    it('should prevent home directory access', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(tempDir.writeFile('~/sensitive.txt', 'malicious')).rejects.toThrow(
        SecurityValidationError,
      )
    })
  })

  describe('mkdir security', () => {
    it('should prevent path traversal with ../', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(tempDir.mkdir('../../../tmp/evil')).rejects.toThrow(SecurityValidationError)
    })

    it('should prevent absolute path access', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(tempDir.mkdir('/tmp/evil')).rejects.toThrow(SecurityValidationError)
    })

    it('should prevent null byte injection', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(tempDir.mkdir('dir\x00evil')).rejects.toThrow(SecurityValidationError)
    })
  })

  describe('getPath security', () => {
    it('should prevent path traversal with ../', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      expect(() => tempDir.getPath('../../../etc/passwd')).toThrow(SecurityValidationError)
    })

    it('should prevent absolute path access', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      expect(() => tempDir.getPath('/etc/passwd')).toThrow(SecurityValidationError)
    })

    it('should prevent null byte injection', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      expect(() => tempDir.getPath('file\x00.exe')).toThrow(SecurityValidationError)
    })
  })

  describe('readFile security', () => {
    it('should prevent path traversal with ../', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(tempDir.readFile('../../../etc/passwd')).rejects.toThrow(SecurityValidationError)
    })

    it('should prevent absolute path access', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(tempDir.readFile('/etc/passwd')).rejects.toThrow(SecurityValidationError)
    })

    it('should prevent null byte injection', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(tempDir.readFile('file\x00.txt')).rejects.toThrow(SecurityValidationError)
    })
  })

  describe('exists security', () => {
    it('should prevent path traversal with ../', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(tempDir.exists('../../../etc/passwd')).rejects.toThrow(SecurityValidationError)
    })

    it('should prevent absolute path access', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(tempDir.exists('/etc/passwd')).rejects.toThrow(SecurityValidationError)
    })
  })

  describe('readdir security', () => {
    it('should prevent path traversal with ../', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(tempDir.readdir('../../../etc')).rejects.toThrow(SecurityValidationError)
    })

    it('should prevent absolute path access', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await expect(tempDir.readdir('/etc')).rejects.toThrow(SecurityValidationError)
    })
  })

  describe('copyFileIn security', () => {
    it('should prevent path traversal in destination with ../', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      // Create a source file first
      const sourceDir = await createTempDirectory()
      tempDirs.push(sourceDir)
      await sourceDir.writeFile('source.txt', 'content')

      await expect(
        tempDir.copyFileIn(sourceDir.getPath('source.txt'), '../../../tmp/evil.txt'),
      ).rejects.toThrow(SecurityValidationError)
    })

    it('should prevent absolute path in destination', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      // Create a source file first
      const sourceDir = await createTempDirectory()
      tempDirs.push(sourceDir)
      await sourceDir.writeFile('source.txt', 'content')

      await expect(
        tempDir.copyFileIn(sourceDir.getPath('source.txt'), '/tmp/evil.txt'),
      ).rejects.toThrow(SecurityValidationError)
    })

    it('should prevent null byte injection in destination', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      // Create a source file first
      const sourceDir = await createTempDirectory()
      tempDirs.push(sourceDir)
      await sourceDir.writeFile('source.txt', 'content')

      await expect(
        tempDir.copyFileIn(sourceDir.getPath('source.txt'), 'dest\x00.exe'),
      ).rejects.toThrow(SecurityValidationError)
    })
  })

  describe('createStructure security', () => {
    it('should prevent path traversal in structure keys', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      const maliciousStructure: DirectoryStructure = {
        '../../../tmp/evil.txt': 'malicious content',
      }

      await expect(tempDir.createStructure(maliciousStructure)).rejects.toThrow(
        SecurityValidationError,
      )
    })

    it('should prevent absolute paths in structure keys', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      const maliciousStructure: DirectoryStructure = {
        '/tmp/evil.txt': 'malicious content',
      }

      await expect(tempDir.createStructure(maliciousStructure)).rejects.toThrow(
        SecurityValidationError,
      )
    })

    it('should prevent null byte injection in structure keys', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      const maliciousStructure: DirectoryStructure = {
        'file\x00.exe': 'malicious content',
      }

      await expect(tempDir.createStructure(maliciousStructure)).rejects.toThrow(
        SecurityValidationError,
      )
    })

    it('should prevent nested path traversal in structure', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      const maliciousStructure: DirectoryStructure = {
        subdir: {
          '../../../tmp/evil.txt': 'malicious content',
        },
      }

      await expect(tempDir.createStructure(maliciousStructure)).rejects.toThrow(
        SecurityValidationError,
      )
    })
  })

  describe('createTempDirectory parent option security', () => {
    it('should handle safe parent directories', async () => {
      const parentDir = await createTempDirectory()
      tempDirs.push(parentDir)

      const tempDir = await createTempDirectory({ parent: parentDir.path })
      tempDirs.push(tempDir)

      expect(tempDir.path.startsWith(parentDir.path)).toBe(true)
    })

    it('should allow default tmpdir parent', async () => {
      const tempDir = await createTempDirectory({ parent: tmpdir() })
      tempDirs.push(tempDir)

      expect(tempDir.path.startsWith(tmpdir())).toBe(true)
    })
  })

  describe('legitimate operations should work', () => {
    it('should allow safe relative paths', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await tempDir.writeFile('safe/nested/file.txt', 'safe content')
      const content = await tempDir.readFile('safe/nested/file.txt')
      expect(content).toBe('safe content')
    })

    it('should allow safe file names', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await tempDir.writeFile('file-name_with.dots.txt', 'safe content')
      const content = await tempDir.readFile('file-name_with.dots.txt')
      expect(content).toBe('safe content')
    })

    it('should allow safe directory operations', async () => {
      const tempDir = await createTempDirectory()
      tempDirs.push(tempDir)

      await tempDir.mkdir('safe/nested/dirs')
      expect(await tempDir.exists('safe/nested/dirs')).toBe(true)
    })
  })
})
