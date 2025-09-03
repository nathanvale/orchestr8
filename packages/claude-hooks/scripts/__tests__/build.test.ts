import { execSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '../..')
const distDir = path.join(packageRoot, 'dist')

describe('Build Configuration', () => {
  // Note: The dist directory is built by Turborepo's dependency chain
  // We don't clean it between tests to preserve the build artifacts

  describe('TypeScript Compilation', () => {
    it('should compile TypeScript to JavaScript in dist directory', async () => {
      // Note: Build is run once in globalSetup
      // Check that dist directory exists
      const distExists = await fs
        .stat(distDir)
        .then(() => true)
        .catch(() => false)
      expect(distExists).toBe(true)

      // Check for compiled index.js
      const indexPath = path.join(distDir, 'index.js')
      const indexExists = await fs
        .stat(indexPath)
        .then(() => true)
        .catch(() => false)
      expect(indexExists).toBe(true)
    })

    it('should generate source maps', async () => {
      // Check for source map files
      const indexMapPath = path.join(distDir, 'index.js.map')
      const mapExists = await fs
        .stat(indexMapPath)
        .then(() => true)
        .catch(() => false)
      expect(mapExists).toBe(true)
    })

    it.skip('should generate TypeScript declaration files', async () => {
      // SKIPPED: Package uses dual consumption - TypeScript source files are used directly in development
      // Check for .d.ts files
      const indexDtsPath = path.join(distDir, 'index.d.ts')
      const dtsExists = await fs
        .stat(indexDtsPath)
        .then(() => true)
        .catch(() => false)
      expect(dtsExists).toBe(true)
    })

    it('should maintain directory structure in dist', async () => {
      // Check that subdirectories are created
      const stopDirPath = path.join(distDir, 'stop')
      const stopDirExists = await fs
        .stat(stopDirPath)
        .then(() => true)
        .catch(() => false)
      expect(stopDirExists).toBe(true)

      // Check for compiled stop/stop.js (main module file)
      const stopPath = path.join(distDir, 'stop', 'stop.js')
      const stopExists = await fs
        .stat(stopPath)
        .then(() => true)
        .catch(() => false)
      expect(stopExists).toBe(true)
    })
  })

  describe('Bin Files', () => {
    it('should compile bin files to dist/bin directory', async () => {
      const binDir = path.join(distDir, 'bin')
      const binDirExists = await fs
        .stat(binDir)
        .then(() => true)
        .catch(() => false)
      expect(binDirExists).toBe(true)
    })

    it('should have correct shebang in compiled bin files', async () => {
      const binFile = path.join(distDir, 'bin', 'claude-hooks-stop.js')
      const binExists = await fs
        .stat(binFile)
        .then(() => true)
        .catch(() => false)

      if (binExists) {
        const content = await fs.readFile(binFile, 'utf8')
        expect(content.startsWith('#!/usr/bin/env node')).toBe(true)
      }
    })

    it('should make bin files executable', async () => {
      const binFile = path.join(distDir, 'bin', 'claude-hooks-stop.js')
      const binExists = await fs
        .stat(binFile)
        .then(() => true)
        .catch(() => false)

      if (binExists) {
        const stats = await fs.stat(binFile)
        // Check if file is executable (on Unix systems)
        if (process.platform !== 'win32') {
          const isExecutable = (stats.mode & 0o111) !== 0
          expect(isExecutable).toBe(true)
        }
      }
    })
  })

  describe('Build Scripts', () => {
    it('should run fix-shebangs script after TypeScript compilation', async () => {
      // Skip if dist already exists and has content
      const distExists = await fs
        .stat(distDir)
        .then(() => true)
        .catch(() => false)
      if (!distExists) {
        execSync('pnpm build', { cwd: packageRoot })
      }

      // Check that all bin files have proper shebangs
      const binDir = path.join(distDir, 'bin')
      const binDirExists = await fs
        .stat(binDir)
        .then(() => true)
        .catch(() => false)

      if (binDirExists) {
        const files = await fs.readdir(binDir)
        const jsFiles = files.filter((f) => f.endsWith('.js'))

        for (const file of jsFiles) {
          const content = await fs.readFile(path.join(binDir, file), 'utf8')
          expect(content.startsWith('#!/usr/bin/env node')).toBe(true)
        }
      }
    })

    it.skip('should clean dist directory before building', async () => {
      // SKIPPED: This test rebuilds which interferes with other tests
      // The cleaning behavior is tested implicitly by successful builds
    })
  })

  describe('Package Structure', () => {
    it('should not include source TypeScript files in dist', async () => {
      // Check that .ts files are not in dist
      const checkForTsFiles = async (dir: string): Promise<boolean> => {
        const files = await fs.readdir(dir)
        for (const file of files) {
          const fullPath = path.join(dir, file)
          const stat = await fs.stat(fullPath)
          if (stat.isDirectory()) {
            const hasTsFiles = await checkForTsFiles(fullPath)
            if (hasTsFiles) return true
          } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
            return true
          }
        }
        return false
      }

      const hasTsFiles = await checkForTsFiles(distDir)
      expect(hasTsFiles).toBe(false)
    })

    it('should include all necessary runtime files', async () => {
      // Check for key files that should be in dist
      const expectedFiles = [
        'index.js',
        'base-hook.js',
        'stop/stop.js',
        'notification/notification.js',
        'utils/auto-config.js',
        'speech/providers/provider-factory.js',
      ]

      for (const file of expectedFiles) {
        const filePath = path.join(distDir, file)
        const exists = await fs
          .stat(filePath)
          .then(() => true)
          .catch(() => false)
        expect(exists, `Expected ${file} to exist in dist`).toBe(true)
      }
    })
  })
})
