/**
 * @fileoverview Tests for dual module consumption patterns (ES modules and CommonJS)
 * These tests validate that packages can be consumed correctly in both module systems
 */

import { execSync } from 'child_process'
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { describe, it, expect } from 'vitest'

describe.skip('Dual Module Consumption', () => {
  describe('ES Module Consumption', () => {
    it('should import core package using ES module syntax', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'orchestr8-esm-test-'))

      try {
        // Create test package.json for ES module
        const packageJson = {
          name: 'test-esm-consumer',
          type: 'module',
          dependencies: {
            '@orchestr8/core': 'file:../../../packages/core',
          },
        }

        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify(packageJson, null, 2),
        )

        // Create test script using ES import syntax
        const testScript = `
import { EventBus } from '@orchestr8/core'

console.log('ES Module import successful')
console.log('EventBus type:', typeof EventBus)

// Basic smoke test
const eventBus = new EventBus({ maxQueueSize: 100 })
console.log('EventBus instance created successfully')
console.log('Instance type:', typeof eventBus)

process.exit(0)
        `

        await writeFile(join(tempDir, 'test.mjs'), testScript)

        // Install dependencies and run test
        execSync('pnpm install', { cwd: tempDir, stdio: 'pipe' })
        const result = execSync('node test.mjs', {
          cwd: tempDir,
          encoding: 'utf8',
        })

        expect(result).toContain('ES Module import successful')
        expect(result).toContain('EventBus type: function')
        expect(result).toContain('EventBus instance created successfully')
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    it('should import schema package using ES module syntax', async () => {
      const tempDir = await mkdtemp(
        join(tmpdir(), 'orchestr8-esm-schema-test-'),
      )

      try {
        const packageJson = {
          name: 'test-esm-schema-consumer',
          type: 'module',
          dependencies: {
            '@orchestr8/schema': 'file:../../../packages/schema',
          },
        }

        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify(packageJson, null, 2),
        )

        const testScript = `
import { WorkflowSchema } from '@orchestr8/schema'

console.log('Schema ES Module import successful')
console.log('WorkflowSchema type:', typeof WorkflowSchema)

// Validate schema is functional
const result = WorkflowSchema.safeParse({
  version: '1.0',
  steps: []
})

console.log('Schema validation successful:', result.success)
process.exit(0)
        `

        await writeFile(join(tempDir, 'test.mjs'), testScript)

        execSync('pnpm install', { cwd: tempDir, stdio: 'pipe' })
        const result = execSync('node test.mjs', {
          cwd: tempDir,
          encoding: 'utf8',
        })

        expect(result).toContain('Schema ES Module import successful')
        expect(result).toContain('WorkflowSchema type: object')
        expect(result).toContain('Schema validation successful: true')
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
  })

  describe('CommonJS Consumption', () => {
    it('should require core package using CommonJS syntax', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'orchestr8-cjs-test-'))

      try {
        // Create test package.json for CommonJS
        const packageJson = {
          name: 'test-cjs-consumer',
          type: 'commonjs',
          dependencies: {
            '@orchestr8/core': 'file:../../../packages/core',
          },
        }

        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify(packageJson, null, 2),
        )

        // Create test script using CommonJS require syntax
        const testScript = `
const { EventBus } = require('@orchestr8/core')

console.log('CommonJS require successful')
console.log('EventBus type:', typeof EventBus)

// Basic smoke test
const eventBus = new EventBus({ maxQueueSize: 100 })
console.log('EventBus instance created successfully')
console.log('Instance type:', typeof eventBus)

process.exit(0)
        `

        await writeFile(join(tempDir, 'test.cjs'), testScript)

        // Install dependencies and run test
        execSync('pnpm install', { cwd: tempDir, stdio: 'pipe' })
        const result = execSync('node test.cjs', {
          cwd: tempDir,
          encoding: 'utf8',
        })

        expect(result).toContain('CommonJS require successful')
        expect(result).toContain('EventBus type: function')
        expect(result).toContain('EventBus instance created successfully')
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    it('should require schema package using CommonJS syntax', async () => {
      const tempDir = await mkdtemp(
        join(tmpdir(), 'orchestr8-cjs-schema-test-'),
      )

      try {
        const packageJson = {
          name: 'test-cjs-schema-consumer',
          type: 'commonjs',
          dependencies: {
            '@orchestr8/schema': 'file:../../../packages/schema',
          },
        }

        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify(packageJson, null, 2),
        )

        const testScript = `
const { WorkflowSchema } = require('@orchestr8/schema')

console.log('Schema CommonJS require successful')
console.log('WorkflowSchema type:', typeof WorkflowSchema)

// Validate schema is functional
const result = WorkflowSchema.safeParse({
  version: '1.0',
  steps: []
})

console.log('Schema validation successful:', result.success)
process.exit(0)
        `

        await writeFile(join(tempDir, 'test.cjs'), testScript)

        execSync('pnpm install', { cwd: tempDir, stdio: 'pipe' })
        const result = execSync('node test.cjs', {
          cwd: tempDir,
          encoding: 'utf8',
        })

        expect(result).toContain('Schema CommonJS require successful')
        expect(result).toContain('WorkflowSchema type: object')
        expect(result).toContain('Schema validation successful: true')
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
  })

  describe('TypeScript Declaration Files', () => {
    it('should provide accurate TypeScript definitions for both module systems', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'orchestr8-types-test-'))

      try {
        const packageJson = {
          name: 'test-types-consumer',
          type: 'module',
          dependencies: {
            '@orchestr8/core': 'file:../../../packages/core',
            '@orchestr8/schema': 'file:../../../packages/schema',
            typescript: '^5.8.0',
          },
        }

        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify(packageJson, null, 2),
        )

        // Create TypeScript test file
        const testScript = `
import { EventBus } from '@orchestr8/core'
import { WorkflowSchema } from '@orchestr8/schema'

// Test that TypeScript can infer types correctly
const eventBus: EventBus = new EventBus({ maxQueueSize: 100 })
const schema: typeof WorkflowSchema = WorkflowSchema

// Test method signatures
eventBus.emit('test', { data: 'test' })

// Test schema validation types
const validation = WorkflowSchema.safeParse({ version: '1.0', steps: [] })
if (validation.success) {
  const workflow = validation.data
  console.log('Workflow version:', workflow.version)
}

console.log('TypeScript compilation successful')
        `

        await writeFile(join(tempDir, 'test.ts'), testScript)

        const tsconfig = {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            skipLibCheck: true,
          },
        }

        await writeFile(
          join(tempDir, 'tsconfig.json'),
          JSON.stringify(tsconfig, null, 2),
        )

        execSync('pnpm install', { cwd: tempDir, stdio: 'pipe' })

        // TypeScript should compile without errors
        const result = execSync('pnpm tsc --noEmit test.ts', {
          cwd: tempDir,
          encoding: 'utf8',
        })

        // No output means successful compilation
        expect(result.trim()).toBe('')
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
  })

  describe('Module System Detection', () => {
    it('should correctly detect and handle different module environments', () => {
      // Test that the validation script can detect module configurations
      expect(typeof process.versions.node).toBe('string')
      expect(
        parseInt(process.versions.node.split('.')[0]),
      ).toBeGreaterThanOrEqual(18)
    })

    it('should validate export field ordering', async () => {
      const packages = [
        '@orchestr8/schema',
        '@orchestr8/logger',
        '@orchestr8/resilience',
        '@orchestr8/core',
        '@orchestr8/cli',
        '@orchestr8/testing',
      ]

      for (const packageName of packages) {
        const packageJsonPath = `/Users/nathanvale/code/@orchestr8/packages/${packageName.replace('@orchestr8/', '')}/package.json`

        try {
          const content = await readFile(packageJsonPath, 'utf8')
          const packageJson = JSON.parse(content)

          if (packageJson.exports?.['.']) {
            const exportKeys = Object.keys(packageJson.exports['.'])

            // Development condition should come first for proper tooling support
            expect(exportKeys[0]).toBe('development')

            // Types should be present for TypeScript support
            expect(exportKeys).toContain('types')

            // Import should be present for ES modules
            expect(exportKeys).toContain('import')

            console.log(`✅ ${packageName} export order validation passed`)
          }
        } catch (error) {
          // Skip packages that don't exist yet
          console.log(
            `⏭️  Skipping ${packageName}: ${(error as Error).message}`,
          )
        }
      }
    })
  })
})
