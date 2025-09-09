/**
 * TypeScript Error Enhancement Tests for V2
 * Tests TypeScript error formatting, compilation errors, and tsconfig validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as ts from 'typescript'
import * as fs from 'node:fs'
import { TypeScriptEngine } from './typescript-engine.js'

// Mock TypeScript module
vi.mock('typescript', () => ({
  findConfigFile: vi.fn(),
  readConfigFile: vi.fn(),
  parseJsonConfigFileContent: vi.fn(),
  createIncrementalProgram: vi.fn(),
  createProgram: vi.fn(),
  sys: {
    fileExists: vi.fn(),
    readFile: vi.fn(),
  },
  flattenDiagnosticMessageText: vi.fn((text) => text),
  DiagnosticCategory: {
    Warning: 0,
    Error: 1,
    Suggestion: 2,
    Message: 3,
  },
  getLineAndCharacterOfPosition: vi.fn(),
}))

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
}))

// Global test setup
let engine: TypeScriptEngine
let consoleErrorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  engine = new TypeScriptEngine()
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(fs.existsSync).mockReturnValue(true)
})

afterEach(() => {
  vi.clearAllMocks()
  consoleErrorSpy.mockRestore()
})

describe('Type Error Formatting', () => {
  it('should format basic type mismatch errors', async () => {
    const mockDiagnostic: ts.Diagnostic = {
      file: {
        fileName: 'test.ts',
        getLineAndCharacterOfPosition: vi.fn().mockReturnValue({ line: 5, character: 10 }),
      } as any,
      start: 100,
      length: 10,
      messageText: "Type 'string' is not assignable to type 'number'",
      category: ts.DiagnosticCategory.Error,
      code: 2322,
      source: 'typescript',
    }

    vi.mocked(ts.findConfigFile).mockReturnValue('tsconfig.json')
    vi.mocked(ts.readConfigFile).mockReturnValue({
      config: {},
      error: undefined,
    })
    vi.mocked(ts.parseJsonConfigFileContent).mockReturnValue({
      options: {},
      fileNames: ['test.ts'],
      errors: [],
    } as any)

    const mockProgram = {
      emit: vi.fn(),
      getSemanticDiagnostics: vi.fn().mockReturnValue([mockDiagnostic]),
      getSyntacticDiagnostics: vi.fn().mockReturnValue([]),
      getDeclarationDiagnostics: vi.fn().mockReturnValue([]),
      getConfigFileParsingDiagnostics: vi.fn().mockReturnValue([]),
      getGlobalDiagnostics: vi.fn().mockReturnValue([]),
      getSourceFile: vi.fn().mockReturnValue(mockDiagnostic.file),
    }

    vi.mocked(ts.createIncrementalProgram).mockReturnValue({
      getProgram: () => mockProgram,
    } as any)

    const result = await engine.check({
      files: ['test.ts'],
    })

    expect(result.success).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toMatchObject({
      engine: 'typescript',
      severity: 'error',
      file: 'test.ts',
      line: 6, // 0-indexed + 1
      col: 11, // 0-indexed + 1
      message: "Type 'string' is not assignable to type 'number'",
      ruleId: 'TS2322',
    })
  })

  it('should format complex generic type errors', async () => {
    const complexMessage = {
      messageText: 'Argument of type',
      category: ts.DiagnosticCategory.Error,
      code: 2345,
      next: [
        {
          messageText:
            "Type 'Promise<string>' is not assignable to parameter of type 'Promise<number>'",
          category: ts.DiagnosticCategory.Error,
          code: 0,
          next: undefined,
        },
      ],
    }

    const mockDiagnostic: ts.Diagnostic = {
      file: {
        fileName: 'async.ts',
        getLineAndCharacterOfPosition: vi.fn().mockReturnValue({ line: 10, character: 5 }),
      } as any,
      start: 200,
      length: 20,
      messageText: complexMessage as any,
      category: ts.DiagnosticCategory.Error,
      code: 2345,
      source: 'typescript',
    }

    vi.mocked(ts.findConfigFile).mockReturnValue('tsconfig.json')
    vi.mocked(ts.readConfigFile).mockReturnValue({
      config: {},
      error: undefined,
    })
    vi.mocked(ts.parseJsonConfigFileContent).mockReturnValue({
      options: {},
      fileNames: ['async.ts'],
      errors: [],
    } as any)
    vi.mocked(ts.flattenDiagnosticMessageText).mockReturnValue(
      "Argument of type 'Promise<string>' is not assignable to parameter of type 'Promise<number>'",
    )

    const mockProgram = {
      emit: vi.fn(),
      getSemanticDiagnostics: vi.fn().mockReturnValue([mockDiagnostic]),
      getSyntacticDiagnostics: vi.fn().mockReturnValue([]),
      getDeclarationDiagnostics: vi.fn().mockReturnValue([]),
      getConfigFileParsingDiagnostics: vi.fn().mockReturnValue([]),
      getGlobalDiagnostics: vi.fn().mockReturnValue([]),
      getSourceFile: vi.fn().mockReturnValue(mockDiagnostic.file),
    }

    vi.mocked(ts.createIncrementalProgram).mockReturnValue({
      getProgram: () => mockProgram,
    } as any)

    const result = await engine.check({
      files: ['async.ts'],
    })

    expect(result.success).toBe(false)
    expect(result.issues[0]?.message).toContain('Promise<string>')
    expect(result.issues[0]?.message).toContain('Promise<number>')
  })

  it('should handle union type errors', async () => {
    const mockDiagnostic: ts.Diagnostic = {
      file: {
        fileName: 'union.ts',
        getLineAndCharacterOfPosition: vi.fn().mockReturnValue({ line: 3, character: 7 }),
      } as any,
      start: 50,
      length: 15,
      messageText: "Type 'boolean' is not assignable to type 'string | number'",
      category: ts.DiagnosticCategory.Error,
      code: 2322,
      source: 'typescript',
    }

    vi.mocked(ts.findConfigFile).mockReturnValue('tsconfig.json')
    vi.mocked(ts.readConfigFile).mockReturnValue({
      config: {},
      error: undefined,
    })
    vi.mocked(ts.parseJsonConfigFileContent).mockReturnValue({
      options: {},
      fileNames: ['union.ts'],
      errors: [],
    } as any)

    const mockProgram = {
      emit: vi.fn(),
      getSemanticDiagnostics: vi.fn().mockReturnValue([mockDiagnostic]),
      getSyntacticDiagnostics: vi.fn().mockReturnValue([]),
      getDeclarationDiagnostics: vi.fn().mockReturnValue([]),
      getConfigFileParsingDiagnostics: vi.fn().mockReturnValue([]),
      getGlobalDiagnostics: vi.fn().mockReturnValue([]),
      getSourceFile: vi.fn().mockReturnValue(mockDiagnostic.file),
    }

    vi.mocked(ts.createIncrementalProgram).mockReturnValue({
      getProgram: () => mockProgram,
    } as any)

    const result = await engine.check({
      files: ['union.ts'],
    })

    expect(result.issues[0]?.message).toContain('string | number')
  })
})

describe('Compilation Error Tests', () => {
  it('should handle syntax errors', async () => {
    const mockDiagnostic: ts.Diagnostic = {
      file: {
        fileName: 'syntax-error.ts',
        getLineAndCharacterOfPosition: vi.fn().mockReturnValue({ line: 2, character: 0 }),
      } as any,
      start: 30,
      length: 5,
      messageText: "';' expected",
      category: ts.DiagnosticCategory.Error,
      code: 1005,
      source: 'typescript',
    }

    vi.mocked(ts.findConfigFile).mockReturnValue('tsconfig.json')
    vi.mocked(ts.readConfigFile).mockReturnValue({
      config: {},
      error: undefined,
    })
    vi.mocked(ts.parseJsonConfigFileContent).mockReturnValue({
      options: {},
      fileNames: ['syntax-error.ts'],
      errors: [],
    } as any)

    const mockProgram = {
      emit: vi.fn(),
      getSemanticDiagnostics: vi.fn().mockReturnValue([]),
      getSyntacticDiagnostics: vi.fn().mockReturnValue([mockDiagnostic]),
      getDeclarationDiagnostics: vi.fn().mockReturnValue([]),
      getConfigFileParsingDiagnostics: vi.fn().mockReturnValue([]),
      getGlobalDiagnostics: vi.fn().mockReturnValue([]),
      getSourceFile: vi.fn().mockReturnValue(mockDiagnostic.file),
    }

    vi.mocked(ts.createIncrementalProgram).mockReturnValue({
      getProgram: () => mockProgram,
    } as any)

    const result = await engine.check({
      files: ['syntax-error.ts'],
    })

    expect(result.success).toBe(false)
    expect(result.issues[0]?.ruleId).toBe('TS1005')
    expect(result.issues[0]?.message).toContain("';' expected")
  })

  it('should handle module resolution errors', async () => {
    const mockDiagnostic: ts.Diagnostic = {
      file: {
        fileName: 'import-error.ts',
        getLineAndCharacterOfPosition: vi.fn().mockReturnValue({ line: 0, character: 19 }),
      } as any,
      start: 19,
      length: 15,
      messageText:
        "Cannot find module 'non-existent-module' or its corresponding type declarations",
      category: ts.DiagnosticCategory.Error,
      code: 2307,
      source: 'typescript',
    }

    vi.mocked(ts.findConfigFile).mockReturnValue('tsconfig.json')
    vi.mocked(ts.readConfigFile).mockReturnValue({
      config: {},
      error: undefined,
    })
    vi.mocked(ts.parseJsonConfigFileContent).mockReturnValue({
      options: {},
      fileNames: ['import-error.ts'],
      errors: [],
    } as any)

    const mockProgram = {
      emit: vi.fn(),
      getSemanticDiagnostics: vi.fn().mockReturnValue([mockDiagnostic]),
      getSyntacticDiagnostics: vi.fn().mockReturnValue([]),
      getDeclarationDiagnostics: vi.fn().mockReturnValue([]),
      getConfigFileParsingDiagnostics: vi.fn().mockReturnValue([]),
      getGlobalDiagnostics: vi.fn().mockReturnValue([]),
      getSourceFile: vi.fn().mockReturnValue(mockDiagnostic.file),
    }

    vi.mocked(ts.createIncrementalProgram).mockReturnValue({
      getProgram: () => mockProgram,
    } as any)

    const result = await engine.check({
      files: ['import-error.ts'],
    })

    expect(result.issues[0]?.ruleId).toBe('TS2307')
    expect(result.issues[0]?.message).toContain('Cannot find module')
  })

  it('should handle declaration errors', async () => {
    const mockDiagnostic: ts.Diagnostic = {
      file: {
        fileName: 'declaration.ts',
        getLineAndCharacterOfPosition: vi.fn().mockReturnValue({ line: 5, character: 2 }),
      } as any,
      start: 80,
      length: 10,
      messageText:
        "Property 'name' has no initializer and is not definitely assigned in the constructor",
      category: ts.DiagnosticCategory.Error,
      code: 2564,
      source: 'typescript',
    }

    vi.mocked(ts.findConfigFile).mockReturnValue('tsconfig.json')
    vi.mocked(ts.readConfigFile).mockReturnValue({
      config: {},
      error: undefined,
    })
    vi.mocked(ts.parseJsonConfigFileContent).mockReturnValue({
      options: { strict: true },
      fileNames: ['declaration.ts'],
      errors: [],
    } as any)

    const mockProgram = {
      emit: vi.fn(),
      getSemanticDiagnostics: vi.fn().mockReturnValue([mockDiagnostic]),
      getSyntacticDiagnostics: vi.fn().mockReturnValue([]),
      getDeclarationDiagnostics: vi.fn().mockReturnValue([]),
      getConfigFileParsingDiagnostics: vi.fn().mockReturnValue([]),
      getGlobalDiagnostics: vi.fn().mockReturnValue([]),
      getSourceFile: vi.fn().mockReturnValue(mockDiagnostic.file),
    }

    vi.mocked(ts.createIncrementalProgram).mockReturnValue({
      getProgram: () => mockProgram,
    } as any)

    const result = await engine.check({
      files: ['declaration.ts'],
    })

    expect(result.issues[0]?.ruleId).toBe('TS2564')
    expect(result.issues[0]?.message).toContain('Property')
    expect(result.issues[0]?.message).toContain('initializer')
  })
})

describe('TSConfig Validation Tests', () => {
  it('should handle missing tsconfig.json', async () => {
    vi.mocked(ts.findConfigFile).mockReturnValue(undefined)

    const result = await engine.check({
      files: ['test.ts'],
    })

    expect(result.success).toBe(false)
    expect(result.issues[0]?.message).toContain('tsconfig.json not found')
  })

  it('should handle invalid tsconfig.json', async () => {
    vi.mocked(ts.findConfigFile).mockReturnValue('tsconfig.json')
    vi.mocked(ts.readConfigFile).mockReturnValue({
      config: {},
      error: {
        messageText: 'Invalid configuration option',
        category: ts.DiagnosticCategory.Error,
        code: 5023,
      } as any,
    })

    const result = await engine.check({
      files: ['test.ts'],
    })

    expect(result.success).toBe(false)
    expect(result.issues[0]?.message).toContain('Failed to read tsconfig.json')
    expect(result.issues[0]?.message).toContain('Invalid configuration option')
  })

  it('should handle tsconfig parsing errors', async () => {
    vi.mocked(ts.findConfigFile).mockReturnValue('tsconfig.json')
    vi.mocked(ts.readConfigFile).mockReturnValue({
      config: { compilerOptions: {} },
      error: undefined,
    })
    vi.mocked(ts.parseJsonConfigFileContent).mockReturnValue({
      options: {},
      fileNames: [],
      errors: [
        {
          messageText: 'Unknown compiler option "invalidOption"',
          category: ts.DiagnosticCategory.Error,
          code: 5024,
        } as any,
      ],
    } as any)

    const mockProgram = {
      emit: vi.fn(),
      getSemanticDiagnostics: vi.fn().mockReturnValue([]),
      getSyntacticDiagnostics: vi.fn().mockReturnValue([]),
      getDeclarationDiagnostics: vi.fn().mockReturnValue([]),
      getConfigFileParsingDiagnostics: vi.fn().mockReturnValue([
        {
          messageText: 'Unknown compiler option "invalidOption"',
          category: ts.DiagnosticCategory.Error,
          code: 5024,
        },
      ]),
      getGlobalDiagnostics: vi.fn().mockReturnValue([]),
      getSourceFile: vi.fn(),
    }

    vi.mocked(ts.createIncrementalProgram).mockReturnValue({
      getProgram: () => mockProgram,
    } as any)

    const result = await engine.check({
      files: ['test.ts'],
    })

    expect(result.issues.some((issue) => issue.message.includes('Unknown compiler option'))).toBe(
      true,
    )
  })

  it('should use custom tsconfig path when provided', async () => {
    const customPath = '/custom/path/tsconfig.json'

    vi.mocked(ts.findConfigFile).mockReturnValue(customPath)
    vi.mocked(ts.readConfigFile).mockReturnValue({
      config: { compilerOptions: { strict: true } },
      error: undefined,
    })
    vi.mocked(ts.parseJsonConfigFileContent).mockReturnValue({
      options: { strict: true },
      fileNames: ['test.ts'],
      errors: [],
    } as any)

    const mockProgram = {
      emit: vi.fn(),
      getSemanticDiagnostics: vi.fn().mockReturnValue([]),
      getSyntacticDiagnostics: vi.fn().mockReturnValue([]),
      getDeclarationDiagnostics: vi.fn().mockReturnValue([]),
      getConfigFileParsingDiagnostics: vi.fn().mockReturnValue([]),
      getGlobalDiagnostics: vi.fn().mockReturnValue([]),
      getSourceFile: vi.fn(),
    }

    vi.mocked(ts.createIncrementalProgram).mockReturnValue({
      getProgram: () => mockProgram,
    } as any)

    const result = await engine.check({
      files: ['test.ts'],
      tsconfigPath: customPath,
    })

    expect(result.success).toBe(true)
    expect(vi.mocked(ts.readConfigFile)).toHaveBeenCalledWith(customPath, expect.any(Function))
  })
})

describe('TypeScript 5.x Features', () => {
  it('should handle const type parameters', async () => {
    const mockDiagnostic: ts.Diagnostic = {
      file: {
        fileName: 'const-generics.ts',
        getLineAndCharacterOfPosition: vi.fn().mockReturnValue({ line: 1, character: 15 }),
      } as any,
      start: 25,
      length: 10,
      messageText: "Type parameter 'T' has a circular constraint",
      category: ts.DiagnosticCategory.Error,
      code: 2313,
      source: 'typescript',
    }

    vi.mocked(ts.findConfigFile).mockReturnValue('tsconfig.json')
    vi.mocked(ts.readConfigFile).mockReturnValue({
      config: {},
      error: undefined,
    })
    vi.mocked(ts.parseJsonConfigFileContent).mockReturnValue({
      options: {},
      fileNames: ['const-generics.ts'],
      errors: [],
    } as any)

    const mockProgram = {
      emit: vi.fn(),
      getSemanticDiagnostics: vi.fn().mockReturnValue([mockDiagnostic]),
      getSyntacticDiagnostics: vi.fn().mockReturnValue([]),
      getDeclarationDiagnostics: vi.fn().mockReturnValue([]),
      getConfigFileParsingDiagnostics: vi.fn().mockReturnValue([]),
      getGlobalDiagnostics: vi.fn().mockReturnValue([]),
      getSourceFile: vi.fn().mockReturnValue(mockDiagnostic.file),
    }

    vi.mocked(ts.createIncrementalProgram).mockReturnValue({
      getProgram: () => mockProgram,
    } as any)

    const result = await engine.check({
      files: ['const-generics.ts'],
    })

    expect(result.issues[0]?.ruleId).toBe('TS2313')
  })

  it('should handle satisfies operator errors', async () => {
    const mockDiagnostic: ts.Diagnostic = {
      file: {
        fileName: 'satisfies.ts',
        getLineAndCharacterOfPosition: vi.fn().mockReturnValue({ line: 3, character: 10 }),
      } as any,
      start: 60,
      length: 15,
      messageText: "Type 'number' does not satisfy the expected type 'string'",
      category: ts.DiagnosticCategory.Error,
      code: 1360,
      source: 'typescript',
    }

    vi.mocked(ts.findConfigFile).mockReturnValue('tsconfig.json')
    vi.mocked(ts.readConfigFile).mockReturnValue({
      config: {},
      error: undefined,
    })
    vi.mocked(ts.parseJsonConfigFileContent).mockReturnValue({
      options: {},
      fileNames: ['satisfies.ts'],
      errors: [],
    } as any)

    const mockProgram = {
      emit: vi.fn(),
      getSemanticDiagnostics: vi.fn().mockReturnValue([mockDiagnostic]),
      getSyntacticDiagnostics: vi.fn().mockReturnValue([]),
      getDeclarationDiagnostics: vi.fn().mockReturnValue([]),
      getConfigFileParsingDiagnostics: vi.fn().mockReturnValue([]),
      getGlobalDiagnostics: vi.fn().mockReturnValue([]),
      getSourceFile: vi.fn().mockReturnValue(mockDiagnostic.file),
    }

    vi.mocked(ts.createIncrementalProgram).mockReturnValue({
      getProgram: () => mockProgram,
    } as any)

    const result = await engine.check({
      files: ['satisfies.ts'],
    })

    expect(result.issues[0]?.message).toContain('satisfy')
  })
})

describe('Error Severity Mapping', () => {
  it('should map TypeScript warnings correctly', async () => {
    const mockDiagnostic: ts.Diagnostic = {
      file: {
        fileName: 'warning.ts',
        getLineAndCharacterOfPosition: vi.fn().mockReturnValue({ line: 1, character: 0 }),
      } as any,
      start: 0,
      length: 10,
      messageText: 'Unreachable code detected',
      category: ts.DiagnosticCategory.Warning,
      code: 7027,
      source: 'typescript',
    }

    vi.mocked(ts.findConfigFile).mockReturnValue('tsconfig.json')
    vi.mocked(ts.readConfigFile).mockReturnValue({
      config: {},
      error: undefined,
    })
    vi.mocked(ts.parseJsonConfigFileContent).mockReturnValue({
      options: {},
      fileNames: ['warning.ts'],
      errors: [],
    } as any)

    const mockProgram = {
      emit: vi.fn(),
      getSemanticDiagnostics: vi.fn().mockReturnValue([mockDiagnostic]),
      getSyntacticDiagnostics: vi.fn().mockReturnValue([]),
      getDeclarationDiagnostics: vi.fn().mockReturnValue([]),
      getConfigFileParsingDiagnostics: vi.fn().mockReturnValue([]),
      getGlobalDiagnostics: vi.fn().mockReturnValue([]),
      getSourceFile: vi.fn().mockReturnValue(mockDiagnostic.file),
    }

    vi.mocked(ts.createIncrementalProgram).mockReturnValue({
      getProgram: () => mockProgram,
    } as any)

    const result = await engine.check({
      files: ['warning.ts'],
    })

    expect(result.issues[0]?.severity).toBe('warning')
    expect(result.issues[0]?.ruleId).toBe('TS7027')
  })

  it('should handle suggestion-level diagnostics', async () => {
    const mockDiagnostic: ts.Diagnostic = {
      file: {
        fileName: 'suggestion.ts',
        getLineAndCharacterOfPosition: vi.fn().mockReturnValue({ line: 2, character: 5 }),
      } as any,
      start: 35,
      length: 8,
      messageText: 'Variable is declared but never used',
      category: ts.DiagnosticCategory.Suggestion,
      code: 6133,
      source: 'typescript',
    }

    vi.mocked(ts.findConfigFile).mockReturnValue('tsconfig.json')
    vi.mocked(ts.readConfigFile).mockReturnValue({
      config: {},
      error: undefined,
    })
    vi.mocked(ts.parseJsonConfigFileContent).mockReturnValue({
      options: {},
      fileNames: ['suggestion.ts'],
      errors: [],
    } as any)

    const mockProgram = {
      emit: vi.fn(),
      getSemanticDiagnostics: vi.fn().mockReturnValue([mockDiagnostic]),
      getSyntacticDiagnostics: vi.fn().mockReturnValue([]),
      getDeclarationDiagnostics: vi.fn().mockReturnValue([]),
      getConfigFileParsingDiagnostics: vi.fn().mockReturnValue([]),
      getGlobalDiagnostics: vi.fn().mockReturnValue([]),
      getSourceFile: vi.fn().mockReturnValue(mockDiagnostic.file),
    }

    vi.mocked(ts.createIncrementalProgram).mockReturnValue({
      getProgram: () => mockProgram,
    } as any)

    const result = await engine.check({
      files: ['suggestion.ts'],
    })

    // Suggestions should be mapped to warnings
    expect(result.issues[0]?.severity).toBe('warning')
  })
})
