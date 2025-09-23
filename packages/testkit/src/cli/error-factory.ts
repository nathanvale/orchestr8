import type * as cp from 'child_process'

/**
 * Base error properties for exec-like errors
 */
export interface ExecLikeErrorProps {
  command: string
  exitCode: number
  signal?: NodeJS.Signals | null
  stdout?: string | Buffer
  stderr?: string | Buffer
  pid?: number
}

/**
 * Extended exec error with additional properties
 */
export type ExtendedExecError = cp.ExecException & {
  status?: number
  output?: Array<null | string>
  pid?: number
}

/**
 * Creates a standardized error for exec-like child_process methods
 *
 * @param method - The method name (exec, execSync, execFile, execFileSync)
 * @param props - Error properties
 * @returns Standardized error object with extended properties
 */
export function createExecLikeError(
  method: 'exec' | 'execSync' | 'execFile' | 'execFileSync',
  props: ExecLikeErrorProps,
): ExtendedExecError {
  const error = new Error(`Command failed: ${props.command}`) as ExtendedExecError

  // Standard ExecException properties
  error.code = props.exitCode
  error.killed = false
  error.signal = props.signal === null ? undefined : props.signal
  error.cmd = props.command

  // Extended properties
  error.status = props.exitCode
  error.pid = props.pid ?? 0

  // Method-specific properties
  if (method === 'exec' || method === 'execSync') {
    // exec/execSync include output array (always as strings)
    const stdoutStr =
      typeof props.stdout === 'string' ? props.stdout : (props.stdout?.toString() ?? '')
    const stderrStr =
      typeof props.stderr === 'string' ? props.stderr : (props.stderr?.toString() ?? '')
    error.output = [null, stdoutStr, stderrStr]
    // exec also includes stdout/stderr directly for compatibility
    if (method === 'exec') {
      error.stdout = stdoutStr
      error.stderr = stderrStr
    }
  }

  if (method === 'execFile' || method === 'execFileSync') {
    // execFile/execFileSync include stdout/stderr directly (convert Buffer to string)
    const stdoutStr =
      typeof props.stdout === 'string' ? props.stdout : (props.stdout?.toString() ?? '')
    const stderrStr =
      typeof props.stderr === 'string' ? props.stderr : (props.stderr?.toString() ?? '')
    error.stdout = stdoutStr
    error.stderr = stderrStr
    // output array always contains strings
    error.output = [null, stdoutStr, stderrStr]
  }

  if (method === 'execSync') {
    // execSync includes stdout/stderr directly (convert Buffer to string)
    const stdoutStr =
      typeof props.stdout === 'string' ? props.stdout : (props.stdout?.toString() ?? '')
    const stderrStr =
      typeof props.stderr === 'string' ? props.stderr : (props.stderr?.toString() ?? '')
    error.stdout = stdoutStr
    error.stderr = stderrStr
  }

  return error
}

/**
 * Creates a standardized error for spawn/fork methods
 *
 * @param command - The command that was run
 * @param exitCode - The exit code
 * @param signal - Optional signal that terminated the process
 * @returns Error object for spawn/fork
 */
export function createSpawnError(
  command: string,
  exitCode: number,
  signal?: NodeJS.Signals,
): Error & { code?: string | number; signal?: NodeJS.Signals } {
  const error = new Error(`Command failed: ${command}`) as Error & {
    code?: string | number
    signal?: NodeJS.Signals
  }
  error.code = exitCode
  error.signal = signal
  return error
}
