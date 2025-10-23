import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as ts from 'typescript'
import { FileError, ToolMissingError } from '../core/errors.js'
import type { CancellationToken } from '../core/timeout-manager.js'
import type { CheckerResult, Issue } from '../types/issue-types.js'
import type { ErrorReport } from '../utils/logger.js'

/**
 * TypeScript engine configuration
 */
export interface TypeScriptEngineConfig {
  /** Path to tsconfig.json */
  tsconfigPath?: string

  /** Cache directory for tsBuildInfo */
  cacheDir?: string

  /** Target files to check */
  files: string[]

  /** Cancellation token */
  token?: CancellationToken
}

/**
 * TypeScript engine with file-scoped incremental compilation
 */
export class TypeScriptEngine {
  private program: ts.BuilderProgram | undefined
  private host: ts.CompilerHost | undefined
  private cacheDir: string
  private lastDiagnostics: readonly ts.Diagnostic[] = []
  private isClearing: boolean = false

  constructor() {
    // Set default cache directory
    const tmpDir = process.env.TMPDIR ?? process.env.TEMP ?? os.tmpdir()
    this.cacheDir = process.env.QC_TS_CACHE_DIR ?? path.join(tmpDir, 'quality-check-ts-cache')
  }

  /**
   * Check TypeScript files
   */
  async check(config: TypeScriptEngineConfig): Promise<CheckerResult> {
    const startTime = Date.now()

    try {
      // Ensure TypeScript is available
      if (!ts) {
        throw new ToolMissingError('typescript')
      }

      // Validate critical TypeScript APIs - skip gracefully if unavailable
      if (
        !ts.parseJsonConfigFileContent ||
        !ts.sys ||
        (!ts.createIncrementalProgram && !ts.createProgram)
      ) {
        // TypeScript APIs not fully available - skip TypeScript checking
        const duration = Date.now() - startTime
        return {
          success: true,
          issues: [],
          duration,
          fixable: false,
        }
      }
      // Set cache directory if provided
      if (config.cacheDir) {
        this.cacheDir = config.cacheDir
      }

      // Ensure cache directory exists
      this.ensureCacheDir()

      // Find and parse tsconfig
      const { configPath, parsedConfig } = await this.loadTsConfig(
        config.tsconfigPath,
        config.files[0],
      )

      // Create incremental program if needed
      // We maintain a single program instance for the entire session to leverage
      // TypeScript's incremental compilation cache
      // Don't recreate if we're in the process of clearing
      if (!this.program && !this.isClearing) {
        this.createIncrementalProgram(parsedConfig, configPath)
      }

      // If clearing is in progress, just return empty results
      if (this.isClearing) {
        const duration = Date.now() - startTime
        return {
          success: true,
          issues: [],
          duration,
          fixable: false,
        }
      }

      // Get diagnostics for the specific files being checked
      // The incremental program will handle file changes internally
      const issues = this.getDiagnostics(config.files, config.token)

      const duration = Date.now() - startTime

      return {
        success: issues.length === 0,
        issues,
        duration,
        fixable: false,
      }
    } catch (error) {
      if (error instanceof ToolMissingError) {
        throw error
      }

      const duration = Date.now() - startTime
      return {
        success: false,
        issues: [
          {
            engine: 'typescript',
            severity: 'error',
            file: config.files[0],
            line: 1,
            col: 1,
            message: error instanceof Error ? error.message : String(error),
          },
        ],
        duration,
        fixable: false,
      }
    }
  }

  /**
   * Ensure cache directory exists
   */
  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true })
    }
  }

  /**
   * Load TypeScript configuration
   */
  private async loadTsConfig(
    tsconfigPath?: string,
    targetFile?: string,
  ): Promise<{ configPath: string; parsedConfig: ts.ParsedCommandLine }> {
    // Provide fallback file system utilities when ts.sys is not available
    // This handles edge cases where TypeScript's sys utilities aren't properly initialized
    const fileExists = ts.sys?.fileExists ?? ((filePath: string) => fs.existsSync(filePath))
    const readFile = ts.sys?.readFile ?? ((filePath: string) => fs.readFileSync(filePath, 'utf8'))

    // Fallback implementation of findConfigFile when ts.findConfigFile is not available
    const findConfigFile = (
      searchPath: string,
      fileExistsFn: (path: string) => boolean,
      configName: string,
    ): string | undefined => {
      if (ts.findConfigFile) {
        return ts.findConfigFile(searchPath, fileExistsFn, configName)
      }

      // Manual implementation as fallback
      let currentDir = path.resolve(searchPath)
      while (true) {
        const configPath = path.join(currentDir, configName)
        if (fileExistsFn(configPath)) {
          return configPath
        }

        const parentDir = path.dirname(currentDir)
        if (parentDir === currentDir) {
          return undefined
        }
        currentDir = parentDir
      }
    }

    // Find tsconfig.json
    const configPath =
      tsconfigPath ??
      (targetFile
        ? findConfigFile(path.dirname(targetFile), fileExists, 'tsconfig.json')
        : findConfigFile(process.cwd(), fileExists, 'tsconfig.json'))

    if (!configPath) {
      throw new FileError('tsconfig.json not found')
    }

    // Read and parse config with fallback
    let configFile: { config?: unknown; error?: ts.Diagnostic }
    if (ts.readConfigFile) {
      configFile = ts.readConfigFile(configPath, readFile)
    } else {
      // Fallback: manually read and parse JSON
      // TypeScript config files support JSON5 (comments, trailing commas, etc.)
      try {
        const configText = readFile(configPath)
        if (configText === undefined) {
          throw new FileError(`Failed to read tsconfig.json at ${configPath}`)
        }
        // Strip comments and trailing commas to make it valid JSON
        const cleanedJson = configText
          .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '') // Remove comments
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        configFile = { config: JSON.parse(cleanedJson) }
      } catch (error) {
        throw new FileError(
          `Failed to read tsconfig.json: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    if (configFile.error) {
      throw new FileError(
        `Failed to read tsconfig.json: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n')}`,
      )
    }

    // Create fallback sys object if ts.sys is not available
    const sys = ts.sys ?? {
      fileExists,
      readFile,
      getCurrentDirectory: () => process.cwd(),
      useCaseSensitiveFileNames: process.platform !== 'win32',
      getNewLine: () => os.EOL,
    }

    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      sys as ts.System,
      path.dirname(configPath),
      {
        noEmit: true,
        incremental: true,
        tsBuildInfoFile: path.join(this.cacheDir, 'qc.tsbuildinfo'),
        skipLibCheck: true,
      },
    )

    if (parsedConfig.errors.length > 0) {
      const errors = parsedConfig.errors.map((d) =>
        ts.flattenDiagnosticMessageText(d.messageText, '\n'),
      )
      throw new FileError(`Failed to parse tsconfig.json: ${errors.join('\n')}`)
    }

    return { configPath, parsedConfig }
  }

  /**
   * Create incremental program
   */
  private createIncrementalProgram(parsedConfig: ts.ParsedCommandLine, _configPath: string): void {
    // Set up compiler options - preserve all options from tsconfig
    const options: ts.CompilerOptions = {
      ...parsedConfig.options,
      noEmit: true,
      incremental: true,
      tsBuildInfoFile: path.join(this.cacheDir, 'qc.tsbuildinfo'),
      // Don't override skipLibCheck if it's set in tsconfig
      skipLibCheck: parsedConfig.options.skipLibCheck ?? true,
    }

    // Create compiler host
    this.host = ts.createIncrementalCompilerHost(options)

    // Create incremental program with ALL files from the parsed config
    // This ensures proper incremental compilation across all project files
    this.program = ts.createIncrementalProgram({
      rootNames: parsedConfig.fileNames, // Use all files from tsconfig
      options,
      host: this.host,
      projectReferences: parsedConfig.projectReferences,
      configFileParsingDiagnostics: parsedConfig.errors,
    })
  }

  /**
   * Get diagnostics for target files
   */
  private getDiagnostics(targetFiles: string[], token?: CancellationToken): Issue[] {
    if (!this.program) {
      return []
    }

    const issues: Issue[] = []
    const allDiagnostics: ts.Diagnostic[] = []
    const program = this.program.getProgram()
    const targetFilesSet = new Set(targetFiles.map((f) => path.resolve(f)))

    // Check for cancellation
    if (token?.isCancellationRequested) {
      return issues
    }

    // Get syntactic diagnostics for target files
    for (const sourceFile of program.getSourceFiles()) {
      if (targetFilesSet.has(sourceFile.fileName)) {
        const syntacticDiagnostics = program.getSyntacticDiagnostics(sourceFile)
        allDiagnostics.push(...syntacticDiagnostics)
        issues.push(...this.convertDiagnostics(syntacticDiagnostics))

        // Check for cancellation
        if (token?.isCancellationRequested) {
          return issues
        }
      }
    }

    // Get semantic diagnostics for target files
    for (const sourceFile of program.getSourceFiles()) {
      if (targetFilesSet.has(sourceFile.fileName)) {
        const semanticDiagnostics = program.getSemanticDiagnostics(sourceFile)
        allDiagnostics.push(...semanticDiagnostics)
        issues.push(...this.convertDiagnostics(semanticDiagnostics))

        // Check for cancellation
        if (token?.isCancellationRequested) {
          return issues
        }
      }
    }

    // Get options diagnostics (no file associated)
    const optionsDiagnostics = program.getOptionsDiagnostics()
    allDiagnostics.push(...optionsDiagnostics)
    issues.push(...this.convertDiagnostics(optionsDiagnostics))

    // Store diagnostics for error reporting
    this.lastDiagnostics = allDiagnostics

    return issues
  }

  /**
   * Convert TypeScript diagnostics to Issues
   */
  private convertDiagnostics(diagnostics: readonly ts.Diagnostic[]): Issue[] {
    return diagnostics.map((diagnostic) => {
      const file = diagnostic.file
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

      if (file && diagnostic.start !== undefined) {
        const { line, character } = file.getLineAndCharacterOfPosition(diagnostic.start)
        const endPosition = diagnostic.start + (diagnostic.length ?? 0)
        const { line: endLine, character: endCharacter } =
          file.getLineAndCharacterOfPosition(endPosition)

        return {
          engine: 'typescript',
          severity: diagnostic.category === ts.DiagnosticCategory.Error ? 'error' : 'warning',
          ruleId: `TS${diagnostic.code}`,
          file: file.fileName,
          line: line + 1, // Convert to 1-based
          col: character + 1, // Convert to 1-based
          endLine: endLine + 1,
          endCol: endCharacter + 1,
          message,
        }
      }

      // For diagnostics without file location (e.g., options diagnostics)
      return {
        engine: 'typescript',
        severity: diagnostic.category === ts.DiagnosticCategory.Error ? 'error' : 'warning',
        ruleId: `TS${diagnostic.code}`,
        file: process.cwd(),
        line: 1,
        col: 1,
        message,
      }
    })
  }

  /**
   * Clear the incremental program cache
   */
  clearCache(): void {
    // Set clearing flag to prevent recreation during concurrent operations
    this.isClearing = true

    // Clear the program and host references
    this.program = undefined
    this.host = undefined
    this.lastDiagnostics = []

    // Clear tsBuildInfo file
    const buildInfoPath = path.join(this.cacheDir, 'qc.tsbuildinfo')
    if (fs.existsSync(buildInfoPath)) {
      try {
        fs.unlinkSync(buildInfoPath)
      } catch {
        // Ignore errors when clearing cache
      }
    }

    // Reset clearing flag after a microtask to ensure any ongoing operations complete
    Promise.resolve().then(() => {
      this.isClearing = false
    })
  }

  /**
   * Dispose of all resources held by the TypeScript engine.
   * This should be called when the engine is no longer needed
   * to free up memory and clean up file handles.
   */
  dispose(): void {
    // Set clearing flag to prevent recreation
    this.isClearing = true

    // Clear the incremental program
    this.program = undefined

    // Clear the compiler host
    this.host = undefined

    // Clear cached diagnostics
    this.lastDiagnostics = []

    // Clear tsBuildInfo file
    const buildInfoPath = path.join(this.cacheDir, 'qc.tsbuildinfo')
    if (fs.existsSync(buildInfoPath)) {
      try {
        fs.unlinkSync(buildInfoPath)
      } catch {
        // Ignore errors when clearing cache
      }
    }

    // Reset clearing flag
    this.isClearing = false

    // Force garbage collection if available (for Node.js with --expose-gc)
    if (global.gc) {
      global.gc()
    }
  }

  /**
   * Check if the engine has cached compilation state
   */
  hasCacheState(): boolean {
    return this.program !== undefined
  }

  /**
   * Get the last diagnostics from the most recent check
   */
  getLastDiagnostics(): readonly ts.Diagnostic[] {
    return this.lastDiagnostics
  }

  /**
   * Generate ErrorReport from TypeScript diagnostics
   */
  async generateErrorReport(diagnostics: readonly ts.Diagnostic[]): Promise<ErrorReport> {
    const issues = this.convertDiagnostics(diagnostics)
    const totalErrors = issues.filter((i) => i.severity === 'error').length
    const totalWarnings = issues.filter((i) => i.severity === 'warning').length
    const filesAffected = new Set(issues.map((i) => i.file)).size

    // Format raw output similar to tsc output
    const rawOutput = diagnostics
      .map((diagnostic) => {
        const file = diagnostic.file
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

        if (file && diagnostic.start !== undefined) {
          const { line, character } = file.getLineAndCharacterOfPosition(diagnostic.start)
          return `${file.fileName}(${line + 1},${character + 1}): error TS${diagnostic.code}: ${message}`
        }

        return `error TS${diagnostic.code}: ${message}`
      })
      .join('\n')

    return {
      timestamp: new Date().toISOString(),
      tool: 'typescript',
      status: totalErrors > 0 ? 'error' : totalWarnings > 0 ? 'warning' : 'success',
      summary: {
        totalErrors,
        totalWarnings,
        filesAffected,
      },
      details: {
        files: this.groupIssuesByFile(issues),
      },
      raw: rawOutput,
    }
  }

  /**
   * Group issues by file for ErrorReport format
   */
  private groupIssuesByFile(issues: Issue[]): Array<{
    path: string
    errors: Array<{
      line: number
      column: number
      message: string
      ruleId?: string
      severity: 'error' | 'warning'
    }>
  }> {
    const fileGroups: Record<string, Issue[]> = {}

    // Filter out 'info' severity issues since ErrorReport only accepts 'error' | 'warning'
    const reportableIssues = issues.filter((issue) => issue.severity !== 'info')

    for (const issue of reportableIssues) {
      if (!fileGroups[issue.file]) {
        fileGroups[issue.file] = []
      }
      fileGroups[issue.file].push(issue)
    }

    return Object.entries(fileGroups).map(([path, fileIssues]) => ({
      path,
      errors: fileIssues.map((issue) => ({
        line: issue.line,
        column: issue.col,
        message: issue.message,
        ruleId: issue.ruleId,
        severity: issue.severity as 'error' | 'warning', // Safe cast since we filtered out 'info'
      })),
    }))
  }
}
