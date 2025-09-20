/**
 * TypeScript Engine Tests with Real Files
 * Uses QualityCheckerTestBuilder to test with real TypeScript compilation
 * Eliminates 200+ mock calls by using real implementations
 */

import { describe, it, expect, afterEach } from 'vitest'
import { TypeScriptEngine } from './typescript-engine.js'
import {
  QualityCheckerTestBuilder,
  TestScenarios,
} from '../test-utils/quality-checker-test-builder.js'

describe('TypeScript Engine - Real File Tests', () => {
  let testEnv: ReturnType<typeof QualityCheckerTestBuilder.prototype.build>

  afterEach(() => {
    testEnv?.cleanup()
  })

  describe('Type Error Detection', () => {
    it('should detect basic type mismatch errors with real files', async () => {
      const builder = new QualityCheckerTestBuilder()
        .withRealFileSystem()
        .withTestFiles([
          {
            path: 'test.ts',
            content: `
const numberVar: number = "this is a string"; // Type error
const stringVar: string = 123; // Type error
`,
          },
        ])
        .withConfiguration({
          typescript: {
            compilerOptions: {
              target: 'ES2020',
              module: 'ESNext',
              strict: true,
              noEmit: true,
              skipLibCheck: true,
            },
          },
        })

      testEnv = builder.build()
      const engine = new TypeScriptEngine()

      const result = await engine.check({
        files: [`${testEnv.tempDir}/test.ts`],
      })

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(2)

      // Check first type error
      expect(result.issues[0]).toMatchObject({
        engine: 'typescript',
        severity: 'error',
        file: expect.stringContaining('test.ts'),
        message: expect.stringContaining("Type 'string' is not assignable to type 'number'"),
        ruleId: 'TS2322',
      })

      // Check second type error
      expect(result.issues[1]).toMatchObject({
        engine: 'typescript',
        severity: 'error',
        file: expect.stringContaining('test.ts'),
        message: expect.stringContaining("Type 'number' is not assignable to type 'string'"),
        ruleId: 'TS2322',
      })
    })

    it('should handle valid TypeScript files', async () => {
      const builder = TestScenarios.validTypeScript()
      testEnv = builder.build()
      const engine = new TypeScriptEngine()

      const result = await engine.check({
        files: [`${testEnv.tempDir}/test.ts`],
      })

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should detect syntax errors in TypeScript files', async () => {
      const builder = new QualityCheckerTestBuilder().withRealFileSystem().withTestFiles([
        {
          path: 'syntax-error.ts',
          content: `
const x = {
  incomplete: "object"
  // Missing closing brace
`,
        },
      ])

      testEnv = builder.build()
      const engine = new TypeScriptEngine()

      const result = await engine.check({
        files: [`${testEnv.tempDir}/syntax-error.ts`],
      })

      expect(result.success).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].severity).toBe('error')
      expect(result.issues[0].engine).toBe('typescript')
    })
  })

  describe('Complex Type Scenarios', () => {
    it('should handle generic type errors with real compilation', async () => {
      const builder = new QualityCheckerTestBuilder().withRealFileSystem().withTestFiles([
        {
          path: 'generics.ts',
          content: `
interface Container<T> {
  value: T;
}

function processContainer(container: Container<number>): number {
  return container.value;
}

// This should cause a type error
const stringContainer: Container<string> = { value: "hello" };
const result = processContainer(stringContainer); // Type error
`,
        },
      ])

      testEnv = builder.build()
      const engine = new TypeScriptEngine()

      const result = await engine.check({
        files: [`${testEnv.tempDir}/generics.ts`],
      })

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].message).toContain('Container<string>')
      expect(result.issues[0].message).toContain('Container<number>')
    })

    it('should handle Promise type mismatches', async () => {
      const builder = new QualityCheckerTestBuilder().withRealFileSystem().withTestFiles([
        {
          path: 'async.ts',
          content: `
async function getNumber(): Promise<number> {
  return 42;
}

async function getString(): Promise<string> {
  return "hello";
}

async function processData() {
  const numberPromise: Promise<number> = getString(); // Type error
  return numberPromise;
}
`,
        },
      ])

      testEnv = builder.build()
      const engine = new TypeScriptEngine()

      const result = await engine.check({
        files: [`${testEnv.tempDir}/async.ts`],
      })

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].message).toContain('Promise<string>')
      expect(result.issues[0].message).toContain('Promise<number>')
    })
  })

  describe('Configuration Handling', () => {
    it('should work with custom TypeScript configuration', async () => {
      const builder = new QualityCheckerTestBuilder()
        .withRealFileSystem()
        .withTestFiles([
          {
            path: 'configured.ts',
            content: `
// With strict: false, some type issues might be ignored
let anyValue: any = "hello";
let numberValue: number = anyValue; // Would error with strict: true
`,
          },
        ])
        .withConfiguration({
          typescript: {
            compilerOptions: {
              target: 'ES2020',
              strict: false, // Disable strict mode
              noEmit: true,
              skipLibCheck: true,
            },
          },
        })

      testEnv = builder.build()
      const engine = new TypeScriptEngine()

      const result = await engine.check({
        files: [`${testEnv.tempDir}/configured.ts`],
      })

      // With strict: false, this should pass
      expect(result.success).toBe(true)
    })

    it('should handle multiple files with imports', async () => {
      const builder = new QualityCheckerTestBuilder().withRealFileSystem().withTestFiles([
        {
          path: 'types.ts',
          content: `
export interface User {
  id: number;
  name: string;
}

export function createUser(name: string): User {
  return { id: Math.random(), name };
}
`,
        },
        {
          path: 'main.ts',
          content: `
import { createUser, User } from './types';

const user: User = createUser(123); // Type error - number instead of string
`,
        },
      ])

      testEnv = builder.build()
      const engine = new TypeScriptEngine()

      const result = await engine.check({
        files: [`${testEnv.tempDir}/types.ts`, `${testEnv.tempDir}/main.ts`],
      })

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].message).toContain('number')
      expect(result.issues[0].message).toContain('string')
      expect(result.issues[0].file).toContain('main.ts')
    })
  })

  describe('Error Recovery', () => {
    it('should handle missing tsconfig gracefully', async () => {
      const builder = new QualityCheckerTestBuilder().withRealFileSystem().withTestFiles([
        {
          path: 'no-config.ts',
          content: 'const x: number = "string";', // Simple type error
        },
      ])
      // Intentionally not providing TypeScript config

      testEnv = builder.build()
      const engine = new TypeScriptEngine()

      const result = await engine.check({
        files: [`${testEnv.tempDir}/no-config.ts`],
      })

      // Should still detect the type error even without explicit config
      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
    })

    it('should handle non-existent files gracefully', async () => {
      const builder = new QualityCheckerTestBuilder().withRealFileSystem()
      testEnv = builder.build()
      const engine = new TypeScriptEngine()

      const result = await engine.check({
        files: [`${testEnv.tempDir}/does-not-exist.ts`],
      })

      // Should handle missing files without crashing
      expect(result.success).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
    })
  })

  describe('Performance', () => {
    it('should handle incremental compilation with large files', async () => {
      // Generate a reasonably large TypeScript file
      const largeContent = `
// Large TypeScript file for performance testing
interface LargeInterface {
  ${Array.from({ length: 50 }, (_, i) => `  prop${i}: string;`).join('\n')}
}

class LargeClass implements LargeInterface {
  ${Array.from({ length: 50 }, (_, i) => `  prop${i}: string = "value${i}";`).join('\n')}

  process(): void {
    // Intentional type error
    const numberVar: number = "this should be a number";
  }
}
`

      const builder = new QualityCheckerTestBuilder().withRealFileSystem().withTestFiles([
        {
          path: 'large-file.ts',
          content: largeContent,
        },
      ])

      testEnv = builder.build()
      const engine = new TypeScriptEngine()

      const startTime = Date.now()
      const result = await engine.check({
        files: [`${testEnv.tempDir}/large-file.ts`],
      })
      const duration = Date.now() - startTime

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].message).toContain("Type 'string' is not assignable to type 'number'")

      // Should complete in reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000)
    })
  })
})
