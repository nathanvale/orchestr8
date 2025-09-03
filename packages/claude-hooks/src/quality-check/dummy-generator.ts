/**
 * Generate dummy implementations for missing imports during TDD
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { ParsedImport } from './import-parser.js'

/**
 * Generate appropriate dummy content based on import details
 */
export function generateDummyContent(parsedImport: ParsedImport): string {
  const { defaultImport, namedImports, namespace, isTypeOnly } = parsedImport
  const lines: string[] = []

  // Add header comment
  lines.push('/**')
  lines.push(' * Auto-generated dummy implementation for TDD')
  lines.push(' * This file was created to satisfy ESLint during test-driven development.')
  lines.push(' * Replace this with your actual implementation.')
  lines.push(' */')
  lines.push('')

  if (isTypeOnly) {
    // Generate type definitions
    if (defaultImport) {
      lines.push(`export type ${defaultImport} = {`)
      lines.push('  // TODO: Add actual type definition')
      lines.push('  _dummy: true')
      lines.push('}')
      lines.push('')
    }

    for (const namedImport of namedImports) {
      if (isInterfaceOrTypeName(namedImport)) {
        lines.push(`export interface ${namedImport} {`)
        lines.push('  // TODO: Add actual interface definition')
        lines.push('  _dummy: true')
        lines.push('}')
      } else {
        lines.push(`export type ${namedImport} = any // TODO: Add actual type`)
      }
      lines.push('')
    }
  } else {
    // Generate runtime implementations
    if (defaultImport) {
      if (isComponentName(defaultImport)) {
        lines.push(generateReactComponent(defaultImport, true))
      } else {
        lines.push(generateFunction(defaultImport, true))
      }
      lines.push('')
    }

    for (const namedImport of namedImports) {
      if (isComponentName(namedImport)) {
        lines.push(generateReactComponent(namedImport, false))
      } else if (isConstantName(namedImport)) {
        lines.push(generateConstant(namedImport))
      } else {
        lines.push(generateFunction(namedImport, false))
      }
      lines.push('')
    }

    if (namespace) {
      lines.push(`const ${namespace} = {`)
      lines.push('  // TODO: Add namespace exports')
      lines.push('}')
      lines.push('')
      lines.push(`export default ${namespace}`)
    }
  }

  return lines.join('\n')
}

/**
 * Check if name is likely a React component (PascalCase)
 */
function isComponentName(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name)
}

/**
 * Check if name is likely a constant (UPPER_CASE)
 */
function isConstantName(name: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(name)
}

/**
 * Check if name is likely an interface or type (starts with I or ends with Type)
 */
function isInterfaceOrTypeName(name: string): boolean {
  return /^I[A-Z]/.test(name) || /Type$/.test(name) || isComponentName(name)
}

/**
 * Generate a React component stub
 */
function generateReactComponent(name: string, isDefault: boolean): string {
  const lines = [
    `${isDefault ? 'export default ' : 'export '}function ${name}(props: any) {`,
    `  throw new Error('${name} component not implemented yet')`,
    `  // TODO: Implement ${name} component`,
    `  // return <div>${name}</div>`,
    '}',
  ]
  return lines.join('\n')
}

/**
 * Generate a function stub
 */
function generateFunction(name: string, isDefault: boolean): string {
  const lines = [
    `${isDefault ? 'export default ' : 'export '}function ${name}(...args: any[]): any {`,
    `  throw new Error('${name} not implemented yet')`,
    '  // TODO: Implement this function',
    '}',
  ]
  return lines.join('\n')
}

/**
 * Generate a constant stub
 */
function generateConstant(name: string): string {
  return `export const ${name} = {} as any // TODO: Add actual value`
}

/**
 * Create dummy file with appropriate content
 */
export async function createDummyFile(
  filePath: string,
  parsedImport: ParsedImport,
  log?: (message: string) => void,
): Promise<boolean> {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })

    // Check if file already exists
    try {
      await fs.access(filePath)
      return false // File already exists, don't overwrite
    } catch {
      // File doesn't exist, proceed
    }

    // Generate content
    const content = generateDummyContent(parsedImport)

    // Write file
    await fs.writeFile(filePath, content, 'utf8')

    if (log) {
      log(`📝 Created dummy implementation: ${path.relative(process.cwd(), filePath)}`)
      log('   (Replace with actual implementation)')
    }

    return true
  } catch (error) {
    if (log) {
      log(
        `Failed to create dummy file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
    return false
  }
}
