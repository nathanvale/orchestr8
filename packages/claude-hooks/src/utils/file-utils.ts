/**
 * File system utilities
 */

import { promises as fs } from 'node:fs'

import type { ClaudeToolInput } from '../types/claude.js'

/**
 * Parse JSON input from stdin
 */
export async function parseJsonInput<T extends ClaudeToolInput>(): Promise<T | null> {
  let inputData = ''

  // Read from stdin
  for await (const chunk of process.stdin) {
    inputData += chunk
  }

  if (!inputData.trim()) {
    return null
  }

  try {
    return JSON.parse(inputData) as T
  } catch {
    return null
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Check if file is a source file
 */
export function isSourceFile(filePath: string): boolean {
  return /\.(ts|tsx|js|jsx)$/.test(filePath)
}

/**
 * Read file content
 */
export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8')
}

/**
 * Write file content
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf8')
}

/**
 * Make file executable
 */
export async function makeExecutable(filePath: string): Promise<void> {
  await fs.chmod(filePath, 0o755)
}
