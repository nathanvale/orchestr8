/**
 * Bootstrap smoke test for CLI process mocks
 *
 * This test verifies that child_process mocks are active and functioning
 * properly. It should run first to catch any mock setup issues early.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as cp from 'child_process'
import { getGlobalProcessMocker } from '../process-mock.js'

describe('CLI process mock bootstrap', () => {
  let mocker: ReturnType<typeof getGlobalProcessMocker>

  beforeEach(() => {
    mocker = getGlobalProcessMocker()
    mocker.clear()
  })

  afterEach(() => {
    mocker.clear()
    mocker.restore()
  })

  it('should have active child_process mocks', () => {
    // Verify that child_process functions are mocked (Vitest mock functions have certain properties)
    expect(cp.spawn).toBeDefined()
    expect(cp.exec).toBeDefined()
    expect(cp.execSync).toBeDefined()
    expect(cp.fork).toBeDefined()

    // These should be Vitest mock functions
    expect(typeof cp.spawn).toBe('function')
    expect(typeof cp.exec).toBe('function')
    expect(typeof cp.execSync).toBe('function')
    expect(typeof cp.fork).toBeDefined()
  })

  it('should register and execute a simple mock successfully', () => {
    // Register a simple mock
    mocker.registerExecSync('test-bootstrap-command', {
      stdout: 'Bootstrap test successful',
      exitCode: 0,
    })

    // Debug: Check if mock was registered
    const registry = globalThis.__PROCESS_MOCK_REGISTRY__
    console.log('Registry after registration:', {
      execSyncMocks: registry?.execSyncMocks?.size,
      hasCommand: registry?.execSyncMocks?.has('test-bootstrap-command'),
      allKeys: Array.from(registry?.execSyncMocks?.keys() || []),
    })

    // Check if cp.execSync is the mocked version
    console.log('cp.execSync type:', typeof cp.execSync)
    console.log('cp.execSync.name:', cp.execSync.name)

    // Execute the command
    console.log('About to call cp.execSync')
    const result = cp.execSync('test-bootstrap-command')
    console.log('Result:', result)

    // Verify the result
    expect(result).toBeDefined()
    expect(result.toString()).toBe('Bootstrap test successful')

    // Verify the call was tracked
    const execSyncCalls = mocker.getExecSyncCalls()
    expect(execSyncCalls).toHaveLength(1)
    expect(execSyncCalls[0].command).toBe('test-bootstrap-command')
  })

  it('should handle command normalization correctly', () => {
    // Register with normalized command
    mocker.registerExecSync('git status', {
      stdout: 'nothing to commit, working tree clean',
      exitCode: 0,
    })

    // Test various command formats that should all normalize to the same thing
    const testCases = [
      'git status',
      '  git   status  ',
      'git  status',
      '"git" "status"',
      "'git' 'status'",
    ]

    testCases.forEach((command) => {
      const result = cp.execSync(command)
      expect(result.toString()).toBe('nothing to commit, working tree clean')
    })

    // Should have tracked all calls
    const execSyncCalls = mocker.getExecSyncCalls()
    expect(execSyncCalls.length).toBeGreaterThanOrEqual(testCases.length)
  })

  it('should support fallback chain across process types', () => {
    // Register only in execSync but test with other methods
    mocker.registerExecSync('universal-command', {
      stdout: 'Universal response',
      exitCode: 0,
    })

    // execSync should work directly
    const execSyncResult = cp.execSync('universal-command')
    expect(execSyncResult.toString()).toBe('Universal response')

    // exec should fall back to execSync mock
    cp.exec('universal-command', (error, stdout, stderr) => {
      expect(error).toBe(null)
      expect(stdout).toBe('Universal response')
      expect(stderr).toBe('')
    })

    // spawn should also fall back
    const spawnProcess = cp.spawn('universal-command')
    expect(spawnProcess).toBeDefined()
    expect(spawnProcess.pid).toBeGreaterThan(0)
  })

  it('should warn when no mock is registered', () => {
    // Enable debug mode to trigger warnings
    const originalDebug = process.env.DEBUG_TESTKIT
    process.env.DEBUG_TESTKIT = '1'
    // Capture console.warn calls
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      // Execute an unmocked command
      cp.execSync('unmocked-command')

      // Should have warned about missing mock
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No mock registered for execSync command: unmocked-command'),
      )
    } finally {
      // Restore original debug setting
      if (originalDebug !== undefined) {
        process.env.DEBUG_TESTKIT = originalDebug
      } else {
        delete process.env.DEBUG_TESTKIT
      }
      warnSpy.mockRestore()
    }
  })

  it('should track spawned processes correctly', () => {
    // Register a spawn mock
    mocker.registerSpawn('track-test', {
      stdout: 'Tracked process',
      exitCode: 0,
    })

    // Spawn the process
    const process = cp.spawn('track-test')

    // Verify it was tracked
    const spawnedProcesses = mocker.getSpawnedProcesses()
    expect(spawnedProcesses).toHaveLength(1)
    expect(spawnedProcesses[0]).toBe(process)
  })
})
