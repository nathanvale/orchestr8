/**
 * Performance benchmarks for file system operations
 */

import { bench, describe, afterEach } from 'vitest'
import {
  createTempDirectory,
  createNamedTempDirectory,
  createMultipleTempDirectories,
  cleanupMultipleTempDirectories,
  type TempDirectory,
  type DirectoryStructure,
} from '../src/fs'

// Track directories for cleanup
const tempDirs: TempDirectory[] = []

afterEach(async () => {
  // Clean up all test directories
  await Promise.all(tempDirs.map((dir) => dir.cleanup()))
  tempDirs.length = 0
})

describe('temp directory creation performance', () => {
  bench(
    'createTempDirectory basic',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)
    },
    { iterations: 100 },
  )

  bench(
    'createTempDirectory with custom prefix',
    async () => {
      const dir = await createTempDirectory({ prefix: 'bench-test-' })
      tempDirs.push(dir)
    },
    { iterations: 100 },
  )

  bench(
    'createTempDirectory without random suffix',
    async () => {
      const dir = await createTempDirectory({ randomSuffix: false })
      tempDirs.push(dir)
    },
    { iterations: 100 },
  )

  bench(
    'createNamedTempDirectory',
    async () => {
      const dir = await createNamedTempDirectory('benchmark')
      tempDirs.push(dir)
    },
    { iterations: 100 },
  )
})

describe('multiple directory operations', () => {
  bench(
    'createMultipleTempDirectories (5)',
    async () => {
      const dirs = await createMultipleTempDirectories(5)
      tempDirs.push(...dirs)
    },
    { iterations: 20 },
  )

  bench(
    'createMultipleTempDirectories (10)',
    async () => {
      const dirs = await createMultipleTempDirectories(10)
      tempDirs.push(...dirs)
    },
    { iterations: 10 },
  )

  bench(
    'cleanupMultipleTempDirectories (5)',
    async () => {
      const dirs = await createMultipleTempDirectories(5)
      await cleanupMultipleTempDirectories(dirs)
    },
    { iterations: 20 },
  )
})

describe('file operations performance', () => {
  bench(
    'writeFile small content',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)
      await dir.writeFile('test.txt', 'Hello, world!')
    },
    { iterations: 500 },
  )

  bench(
    'writeFile medium content',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)
      const content = 'x'.repeat(1024) // 1KB
      await dir.writeFile('medium.txt', content)
    },
    { iterations: 200 },
  )

  bench(
    'writeFile large content',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)
      const content = 'x'.repeat(1024 * 100) // 100KB
      await dir.writeFile('large.txt', content)
    },
    { iterations: 50 },
  )

  bench(
    'writeFile with nested path',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)
      await dir.writeFile('nested/deep/path/file.txt', 'content')
    },
    { iterations: 200 },
  )

  bench(
    'readFile after write',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)
      await dir.writeFile('read-test.txt', 'read this content')
      await dir.readFile('read-test.txt')
    },
    { iterations: 200 },
  )

  bench(
    'multiple file writes',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)

      await Promise.all([
        dir.writeFile('file1.txt', 'content 1'),
        dir.writeFile('file2.txt', 'content 2'),
        dir.writeFile('file3.txt', 'content 3'),
        dir.writeFile('file4.txt', 'content 4'),
        dir.writeFile('file5.txt', 'content 5'),
      ])
    },
    { iterations: 100 },
  )
})

describe('directory operations performance', () => {
  bench(
    'mkdir single directory',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)
      await dir.mkdir('subdir')
    },
    { iterations: 500 },
  )

  bench(
    'mkdir nested directories',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)
      await dir.mkdir('level1/level2/level3')
    },
    { iterations: 200 },
  )

  bench(
    'readdir operation',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)

      // Create some files first
      await dir.writeFile('file1.txt', 'content')
      await dir.writeFile('file2.txt', 'content')
      await dir.mkdir('subdir')

      await dir.readdir()
    },
    { iterations: 200 },
  )

  bench(
    'exists check (existing)',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)
      await dir.writeFile('exists.txt', 'content')
      await dir.exists('exists.txt')
    },
    { iterations: 1000 },
  )

  bench(
    'exists check (non-existing)',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)
      await dir.exists('does-not-exist.txt')
    },
    { iterations: 1000 },
  )
})

describe('copyFileIn performance', () => {
  bench(
    'copyFileIn operation',
    async () => {
      // Create a source file first
      const sourceDir = await createTempDirectory()
      const targetDir = await createTempDirectory()
      tempDirs.push(sourceDir, targetDir)

      const sourcePath = await sourceDir.writeFile('source.txt', 'source content')
      await targetDir.copyFileIn(sourcePath, 'copied.txt')
    },
    { iterations: 100 },
  )

  bench(
    'copyFileIn with nested destination',
    async () => {
      const sourceDir = await createTempDirectory()
      const targetDir = await createTempDirectory()
      tempDirs.push(sourceDir, targetDir)

      const sourcePath = await sourceDir.writeFile('source.txt', 'source content')
      await targetDir.copyFileIn(sourcePath, 'nested/path/copied.txt')
    },
    { iterations: 100 },
  )
})

describe('createStructure performance', () => {
  bench(
    'createStructure small',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)

      const structure: DirectoryStructure = {
        'file1.txt': 'content 1',
        'file2.txt': 'content 2',
        'subdir': {
          'nested.txt': 'nested content',
        },
      }

      await dir.createStructure(structure)
    },
    { iterations: 100 },
  )

  bench(
    'createStructure medium',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)

      const structure: DirectoryStructure = {
        'src': {
          'index.ts': 'export * from "./lib"',
          'lib': {
            'utils.ts': 'export function helper() {}',
            'types.ts': 'export interface Config {}',
          },
        },
        'tests': {
          unit: {
            'utils.test.ts': 'describe("utils", () => {})',
            'types.test.ts': 'describe("types", () => {})',
          },
          integration: {
            'full.test.ts': 'describe("integration", () => {})',
          },
        },
        'package.json': '{"name": "test-package"}',
        'README.md': '# Test Package',
      }

      await dir.createStructure(structure)
    },
    { iterations: 50 },
  )

  bench(
    'createStructure large',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)

      // Create a larger structure programmatically
      const structure: DirectoryStructure = {}

      for (let i = 0; i < 10; i++) {
        const moduleDir: DirectoryStructure = {}
        for (let j = 0; j < 5; j++) {
          moduleDir[`file${j}.ts`] = `export const value${j} = ${j}`
        }
        structure[`module${i}`] = moduleDir
      }

      await dir.createStructure(structure)
    },
    { iterations: 20 },
  )
})

describe('cleanup performance', () => {
  bench(
    'single directory cleanup',
    async () => {
      const dir = await createTempDirectory()
      await dir.writeFile('test.txt', 'content')
      await dir.mkdir('subdir')
      await dir.writeFile('subdir/nested.txt', 'nested content')
      await dir.cleanup()
    },
    { iterations: 100 },
  )

  bench(
    'cleanup with many files',
    async () => {
      const dir = await createTempDirectory()

      // Create many files
      const promises = Array.from({ length: 50 }, (_, i) =>
        dir.writeFile(`file${i}.txt`, `content ${i}`),
      )
      await Promise.all(promises)

      await dir.cleanup()
    },
    { iterations: 20 },
  )

  bench(
    'cleanup with deep nesting',
    async () => {
      const dir = await createTempDirectory()

      // Create deep nested structure
      let currentPath = ''
      for (let i = 0; i < 10; i++) {
        currentPath += `level${i}/`
        await dir.mkdir(currentPath)
        await dir.writeFile(`${currentPath}file.txt`, `content at level ${i}`)
      }

      await dir.cleanup()
    },
    { iterations: 50 },
  )
})

describe('path operations performance', () => {
  bench(
    'getPath operation',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)

      // Test multiple path operations
      for (let i = 0; i < 10; i++) {
        dir.getPath(`file${i}.txt`)
        dir.getPath(`nested/path/file${i}.txt`)
      }
    },
    { iterations: 1000 },
  )

  bench(
    'path validation overhead',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)

      // This tests the path validation that happens in most operations
      await dir.writeFile('test.txt', 'content')
      await dir.exists('test.txt')
      await dir.readFile('test.txt')
      dir.getPath('another-file.txt')
    },
    { iterations: 500 },
  )
})

describe('concurrent operations', () => {
  bench(
    'concurrent file writes',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)

      const promises = Array.from({ length: 20 }, (_, i) =>
        dir.writeFile(`concurrent${i}.txt`, `content ${i}`),
      )

      await Promise.all(promises)
    },
    { iterations: 50 },
  )

  bench(
    'concurrent directory creation',
    async () => {
      const dirs = await Promise.all(Array.from({ length: 10 }, () => createTempDirectory()))
      tempDirs.push(...dirs)
    },
    { iterations: 50 },
  )

  bench(
    'mixed concurrent operations',
    async () => {
      const dir = await createTempDirectory()
      tempDirs.push(dir)

      await Promise.all([
        dir.writeFile('file1.txt', 'content 1'),
        dir.mkdir('subdir1'),
        dir.writeFile('file2.txt', 'content 2'),
        dir.mkdir('subdir2'),
        dir.writeFile('subdir1/nested.txt', 'nested content'),
        dir.writeFile('subdir2/nested.txt', 'nested content'),
      ])
    },
    { iterations: 100 },
  )
})
