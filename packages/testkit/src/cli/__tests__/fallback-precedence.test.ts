import * as cp from 'node:child_process'
import { beforeEach, describe, expect, it } from 'vitest'
import { getRegistry, resetAll } from '../registry.js'

describe('Fallback precedence', () => {
  beforeEach(() => {
    resetAll()
  })

  it('should follow documented fallback order when command not in primary map', () => {
    const registry = getRegistry()

    // Register different configs for the same command in different maps
    // Precedence order: primary → execFile → execSync → spawn → fork → execFileSync

    registry.execFileMocks.set('test-cmd', { stdout: 'from execFile' })
    registry.execSyncMocks.set('test-cmd', { stdout: 'from execSync' })
    registry.spawnMocks.set('test-cmd', { stdout: 'from spawn' })
    registry.forkMocks.set('test-cmd', { stdout: 'from fork' })
    registry.execFileSyncMocks.set('test-cmd', { stdout: 'from execFileSync' })

    // When exec is called and not found in execMocks, it should use execFile (first fallback)
    cp.exec('test-cmd', (_err, stdout) => {
      expect(stdout).toBe('from execFile')
    })
  })

  it('should use spawn map as fallback for fork when not found', () => {
    const registry = getRegistry()

    // Only register in spawn map
    registry.spawnMocks.set('module.js', { stdout: 'from spawn fallback' })

    // Fork should find it via fallback
    const proc = cp.fork('module.js')
    let output = ''
    proc.stdout?.on('data', (data) => {
      output += data.toString()
    })
    proc.on('close', () => {
      expect(output).toBe('from spawn fallback')
    })
  })

  it('should use execSync map as fallback for spawn when not found', () => {
    const registry = getRegistry()

    // Only register in execSync map
    registry.execSyncMocks.set('spawn-test', { stdout: 'from execSync fallback' })

    // Spawn should find it via fallback
    const proc = cp.spawn('spawn-test')
    let output = ''
    proc.stdout.on('data', (data) => {
      output += data.toString()
    })
    proc.on('close', () => {
      expect(output).toBe('from execSync fallback')
    })
  })

  it('should prioritize primary map over any fallback', () => {
    const registry = getRegistry()

    // Register in multiple maps with different outputs
    registry.execMocks.set('priority-test', { stdout: 'primary exec' })
    registry.execFileMocks.set('priority-test', { stdout: 'fallback execFile' })
    registry.spawnMocks.set('priority-test', { stdout: 'fallback spawn' })

    // Should use primary map (execMocks) not fallback
    cp.exec('priority-test', (_err, stdout) => {
      expect(stdout).toBe('primary exec')
    })
  })

  it('should handle regex patterns in fallback maps', () => {
    const registry = getRegistry()

    // Register regex pattern in a fallback map
    registry.spawnMocks.set(/^npm /, { stdout: 'npm command via spawn' })

    // exec should find it via fallback
    cp.exec('npm install', (_err, stdout) => {
      expect(stdout).toBe('npm command via spawn')
    })
  })

  it('should respect execFile before execSync in precedence', () => {
    const registry = getRegistry()

    // Register in both execFile and execSync
    registry.execFileMocks.set('precedence-test', { stdout: 'from execFile' })
    registry.execSyncMocks.set('precedence-test', { stdout: 'from execSync' })

    // When spawn is called and not in spawnMocks, should use execFile (higher precedence)
    const proc = cp.spawn('precedence-test')
    let output = ''
    proc.stdout.on('data', (data) => {
      output += data.toString()
    })
    proc.on('close', () => {
      expect(output).toBe('from execFile')
    })
  })

  it('should use execFileSync as last resort fallback', () => {
    const registry = getRegistry()

    // Only register in execFileSync (lowest precedence)
    registry.execFileSyncMocks.set('last-resort', { stdout: 'from execFileSync' })

    // exec should find it as last resort
    cp.exec('last-resort', (_err, stdout) => {
      expect(stdout).toBe('from execFileSync')
    })
  })

  it('should handle normalized commands in fallback lookup', () => {
    const registry = getRegistry()

    // Register with extra spaces in fallback map
    registry.spawnMocks.set('git   status', { stdout: 'normalized fallback' })

    // exec with different spacing should find it via normalized fallback
    cp.exec('git status', (_err, stdout) => {
      expect(stdout).toBe('normalized fallback')
    })
  })
})
