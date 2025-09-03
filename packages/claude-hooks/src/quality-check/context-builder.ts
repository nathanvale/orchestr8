/**
 * Sub-agent Context Builder for TypeScript Error Analysis
 * Enriches error context with project information for intelligent analysis
 */

import { existsSync, readFileSync } from 'node:fs'
import * as path from 'node:path'

import type {
  ImportAnalysis,
  ProjectContext,
  SubAgentContext,
  TypeScriptErrorDetail,
} from './error-classifier.js'
import type { TypeScriptConfigCache } from './typescript-cache.js'

export interface EnrichedProjectContext extends ProjectContext {
  packageName?: string
  componentPath?: string
  framework?: string
  isAppRouter?: boolean
}

export interface EnrichedSubAgentContext extends SubAgentContext {
  projectPatterns: EnrichedProjectContext
  configMappings?: Record<string, { configPath: string; excludes: string[] }>
  nearbyFiles?: string[]
}

/**
 * Builds rich context for sub-agent analysis of TypeScript errors
 */
export class SubAgentContextBuilder {
  constructor(private tsCache: TypeScriptConfigCache) {}

  /**
   * Build comprehensive context for error analysis
   */
  async buildContext(errors: string[], filePath: string): Promise<EnrichedSubAgentContext> {
    const tsConfigPath = this.tsCache.getTsConfigForFile(filePath) || ''
    // Note: configMappings would need to be exposed by TypeScriptConfigCache if needed
    // For now, we'll use an empty object as TypeScriptConfigCache doesn't expose mappings
    const configMappings = {}

    // Extract file content if available
    let fileContent: string | undefined
    try {
      if (existsSync(filePath)) {
        fileContent = readFileSync(filePath, 'utf8')
      }
    } catch {
      // File reading failed, continue without content
    }

    // Build error details with line numbers
    const errorDetails = this.extractErrorDetails(errors)

    // Analyze project patterns
    const projectPatterns = this.analyzeProjectPatterns(filePath)

    // Extract imports from file content
    const relatedImports = this.extractImportAnalysis(fileContent || '')

    // Get nearby files for additional context
    const nearbyFiles = this.getNearbyFiles(filePath)

    return {
      filePath,
      fileContent,
      tsConfigPath,
      errorDetails,
      projectPatterns,
      relatedImports,
      configMappings,
      nearbyFiles,
    }
  }

  /**
   * Extract error details with line numbers and categorization
   */
  private extractErrorDetails(errors: string[]): TypeScriptErrorDetail[] {
    return errors.map((error) => {
      // Extract line number from TypeScript error format
      const lineMatch = error.match(/\((\d+),\d+\):|:(\d+):\d+/)
      const lineNumber = lineMatch ? parseInt(lineMatch[1] || lineMatch[2], 10) : undefined

      return {
        message: error,
        lineNumber,
        category: this.getErrorCategory(error),
      }
    })
  }

  /**
   * Categorize error type
   */
  private getErrorCategory(
    error: string,
  ): 'auto-fixable' | 'needs-reasoning' | 'dependency-warning' {
    const errorLower = error.toLowerCase()

    // Auto-fixable patterns
    if (
      errorLower.includes('semicolon') ||
      errorLower.includes('prettier') ||
      errorLower.includes('eslint') ||
      errorLower.includes('formatting')
    ) {
      return 'auto-fixable'
    }

    // Dependency warnings
    if (errorLower.includes('node_modules') || errorLower.includes('dependency')) {
      return 'dependency-warning'
    }

    // Complex TypeScript errors
    if (
      errorLower.includes('does not exist on type') ||
      errorLower.includes('cannot find module') ||
      errorLower.includes('not assignable to type')
    ) {
      return 'needs-reasoning'
    }

    return 'dependency-warning'
  }

  /**
   * Analyze project structure and patterns
   */
  private analyzeProjectPatterns(filePath: string): EnrichedProjectContext {
    const isMonorepo = filePath.includes('/packages/') || filePath.includes('/apps/')
    const packagePattern = isMonorepo ? '@template/*' : undefined

    // Extract package name from monorepo path
    let packageName: string | undefined
    if (isMonorepo) {
      const match = filePath.match(/\/packages\/([^/]+)\//)
      packageName = match ? match[1] : undefined
    }

    // Extract component path for monorepo packages
    let componentPath: string | undefined
    if (isMonorepo && filePath.includes('/src/')) {
      const srcIndex = filePath.indexOf('/src/')
      const afterSrc = filePath.substring(srcIndex + 5)
      const lastSlash = afterSrc.lastIndexOf('/')
      componentPath = lastSlash > 0 ? `src/${afterSrc.substring(0, lastSlash)}` : undefined
    }

    // Detect framework patterns
    let framework: string | undefined
    let isAppRouter: boolean | undefined
    if (filePath.includes('/app/') && filePath.endsWith('.tsx')) {
      framework = 'nextjs'
      isAppRouter = true
    }

    // Calculate relative path
    const pathParts = filePath.split('/')

    // Find the index for packages or apps (monorepo markers)
    const packagesIndex = pathParts.indexOf('packages')
    const appsIndex = pathParts.indexOf('apps')

    let relativePath: string
    if (packagesIndex !== -1) {
      relativePath = pathParts.slice(packagesIndex).join('/')
    } else if (appsIndex !== -1) {
      relativePath = pathParts.slice(appsIndex).join('/')
    } else {
      // For non-monorepo, find src or app folder
      const srcIndex = pathParts.indexOf('src')
      const appIndex = pathParts.indexOf('app')
      if (srcIndex !== -1) {
        relativePath = pathParts.slice(srcIndex).join('/')
      } else if (appIndex !== -1) {
        relativePath = pathParts.slice(appIndex).join('/')
      } else {
        relativePath = path.basename(filePath)
      }
    }

    return {
      isMonorepo,
      packagePattern,
      relativePath,
      packageName,
      componentPath,
      framework,
      isAppRouter,
    }
  }

  /**
   * Extract import statements from file content
   */
  private extractImportAnalysis(fileContent: string): ImportAnalysis[] {
    if (!fileContent) {
      return []
    }

    const imports: ImportAnalysis[] = []

    // Match various import patterns
    const importPatterns = [
      /import\s+(?:type\s+)?.*?\s+from\s+['"`]([^'"`]+)['"`]/g,
      /import\s+['"`]([^'"`]+)['"`]/g,
      /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]\s+assert\s+\{[^}]+\}/g,
    ]

    for (const pattern of importPatterns) {
      let match
      while ((match = pattern.exec(fileContent)) !== null) {
        const importPath = match[1]
        const isRelative = importPath.startsWith('.')

        // Avoid duplicates
        if (!imports.find((i) => i.importPath === importPath)) {
          imports.push({
            importPath,
            isRelative,
          })
        }
      }
    }

    return imports
  }

  /**
   * Get nearby files for additional context
   */
  private getNearbyFiles(filePath: string): string[] {
    const dir = path.dirname(filePath)
    const basename = path.basename(filePath, path.extname(filePath))
    const nearbyFiles: string[] = []

    try {
      const possibleFiles = [
        `${basename}.test.tsx`,
        `${basename}.test.ts`,
        `${basename}.spec.tsx`,
        `${basename}.spec.ts`,
        `${basename}.stories.tsx`,
        `${basename}.stories.ts`,
        'index.ts',
        'index.tsx',
      ]

      for (const file of possibleFiles) {
        const fullPath = path.join(dir, file)
        if (existsSync(fullPath) && fullPath !== filePath) {
          nearbyFiles.push(file)
        }
      }
    } catch {
      // Directory reading failed, return empty array
    }

    return nearbyFiles
  }
}

/**
 * Factory function to create a context builder
 */
export function createContextBuilder(tsCache: TypeScriptConfigCache): SubAgentContextBuilder {
  return new SubAgentContextBuilder(tsCache)
}
