/**
 * Import parser for analyzing import statements and ESLint errors
 */

import path from 'node:path'

export interface ParsedImport {
  importPath: string
  isRelative: boolean
  isTypeOnly: boolean
  defaultImport?: string
  namedImports: string[]
  namespace?: string
  rawStatement: string
}

export interface ImportError {
  message: string
  importPath?: string
  line: number
  column: number
}

/**
 * Parse import statement to extract details
 */
export function parseImportStatement(statement: string): ParsedImport | null {
  // Remove comments and extra whitespace
  const cleaned = statement
    .trim()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')

  // Match various import patterns
  const importRegex =
    /^import\s+(?:type\s+)?(?:(\w+)(?:\s*,\s*)?)?(?:\{([^}]+)\})?\s*(?:,\s*\*\s+as\s+(\w+))?\s*from\s*['"]([^'"]+)['"]/
  const namespaceRegex = /^import\s+(?:type\s+)?\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/

  let match = importRegex.exec(cleaned)
  let isNamespace = false

  if (!match) {
    match = namespaceRegex.exec(cleaned)
    isNamespace = true
  }

  if (!match) {
    return null
  }

  if (isNamespace) {
    const [, namespace, importPath] = match
    return {
      importPath,
      isRelative: importPath.startsWith('.'),
      isTypeOnly: cleaned.includes('import type'),
      namedImports: [],
      namespace,
      rawStatement: statement,
    }
  }

  const [, defaultImport, namedImportsStr, namespace, importPath] = match

  // Parse named imports
  const namedImports: string[] = []
  if (namedImportsStr) {
    for (const imp of namedImportsStr.split(',')) {
      const trimmed = imp.trim()
      if (trimmed) {
        // Handle renamed imports like "foo as bar"
        const renamed = trimmed.split(/\s+as\s+/)
        namedImports.push(renamed[0].trim())
      }
    }
  }

  return {
    importPath,
    isRelative: importPath.startsWith('.'),
    isTypeOnly: cleaned.includes('import type'),
    defaultImport: defaultImport?.trim(),
    namedImports,
    namespace: namespace?.trim(),
    rawStatement: statement,
  }
}

/**
 * Extract import errors from ESLint messages
 */
export function extractImportErrors(
  eslintMessages: Array<{
    message?: string
    ruleId?: string | null
    line?: number
    column?: number
  }>,
): ImportError[] {
  const importErrors: ImportError[] = []

  for (const message of eslintMessages) {
    // Check for various import-related error messages
    if (
      message.message?.includes('Unable to resolve') ||
      message.message?.includes('Cannot find module') ||
      message.message?.includes('Could not find a declaration file') ||
      message.ruleId === 'import/no-unresolved' ||
      message.ruleId === 'import/named'
    ) {
      // Try to extract the import path from the message
      const pathMatch = message.message?.match(/['"]([^'"]+)['"]/)

      importErrors.push({
        message: message.message || 'Import error',
        importPath: pathMatch?.[1],
        line: message.line || 0,
        column: message.column || 0,
      })
    }
  }

  return importErrors
}

/**
 * Determine the file extension to use for the dummy file
 */
export function determineFileExtension(
  importPath: string,
  isTypeOnly: boolean,
  fileContext: string,
): string {
  // If import path already has extension, use it
  if (/\.[jt]sx?$/.test(importPath)) {
    return ''
  }

  // For type-only imports, prefer .ts
  if (isTypeOnly) {
    return '.ts'
  }

  // If importing from a test file, check if it's likely a React component
  const importName = importPath.split('/').pop() || ''
  if (
    /^[A-Z]/.test(importName) || // PascalCase suggests component
    importPath.includes('components') ||
    fileContext.includes('.tsx')
  ) {
    return '.tsx'
  }

  // Default to .ts for TypeScript projects
  return '.ts'
}

/**
 * Resolve relative import path to absolute file path
 */
export function resolveImportPath(
  importPath: string,
  currentFile: string,
  projectRoot: string,
): string {
  if (!importPath.startsWith('.')) {
    // Not a relative import, might be a module or alias
    return importPath
  }

  const currentDir = path.dirname(currentFile)
  const resolved = path.resolve(currentDir, importPath)

  // Make relative to project root for cleaner paths
  return path.relative(projectRoot, resolved)
}
