import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import {
  readClaudeSettings,
  validateClaudeHookConfig,
  resolveHookCommand,
  expandEnvironmentVariables,
  normalizeHookConfig,
} from './claude-settings.js'

describe('Claude Settings Configuration', () => {
  let mockFs: any
  let originalProcessCwd: typeof process.cwd

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock process.cwd to control project directory
    originalProcessCwd = process.cwd
    process.cwd = vi.fn().mockReturnValue('/mock/project')

    // Mock fs operations
    mockFs = {
      readFile: vi.fn(),
      access: vi.fn(),
    }
    vi.spyOn(fs, 'readFile').mockImplementation(mockFs.readFile)
    vi.spyOn(fs, 'access').mockImplementation(mockFs.access)
  })

  afterEach(() => {
    process.cwd = originalProcessCwd
    vi.restoreAllMocks()
  })

  describe('Settings file detection and parsing', () => {
    test('should_detect_claude_settings_in_project_root', async () => {
      // Arrange
      const mockSettings = {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write|Edit|MultiEdit',
              hooks: [
                {
                  type: 'command',
                  command: 'quality-check-claude-hook',
                  timeout: 10,
                  description: 'Quality check enforcement',
                  continueOnError: false,
                },
              ],
            },
          ],
        },
      }
      mockFs.access.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockSettings))

      // Act
      const result = await readClaudeSettings()

      // Assert
      expect(mockFs.access).toHaveBeenCalledWith('/mock/project/.claude/settings.json')
      expect(mockFs.readFile).toHaveBeenCalledWith('/mock/project/.claude/settings.json', 'utf8')
      expect(result).toEqual(mockSettings)
    })

    test('should_handle_missing_settings_file_gracefully', async () => {
      // Arrange
      mockFs.access.mockRejectedValue(new Error('ENOENT'))

      // Act
      const result = await readClaudeSettings()

      // Assert
      expect(result).toBeNull()
    })

    test('should_handle_malformed_settings_json_gracefully', async () => {
      // Arrange
      mockFs.access.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue('{ invalid json content')

      // Act
      const result = await readClaudeSettings()

      // Assert
      expect(result).toBeNull()
    })

    test('should_validate_hook_configuration_structure', async () => {
      // Arrange
      const validConfigs = [
        {
          hooks: {
            PostToolUse: [
              {
                matcher: 'Write|Edit',
                hooks: [{ type: 'command', command: 'test' }],
              },
            ],
          },
        },
        {
          hooks: {
            PostToolUse: [
              {
                matcher: 'Write',
                hooks: [{ type: 'command', command: 'quality-check-claude-hook' }],
              },
            ],
          },
        },
      ]

      for (const config of validConfigs) {
        mockFs.access.mockResolvedValue(true)
        mockFs.readFile.mockResolvedValue(JSON.stringify(config))

        // Act
        const result = await readClaudeSettings()
        const isValid = validateClaudeHookConfig(result)

        // Assert
        expect(isValid).toBe(true)
      }
    })

    test('should_reject_invalid_hook_configuration_structure', async () => {
      // Arrange
      const invalidConfigs = [
        {}, // Empty config
        { hooks: {} }, // Missing PostToolUse
        { hooks: { PostToolUse: [] } }, // Empty PostToolUse
        { hooks: { PostToolUse: [{}] } }, // Missing matcher
        { hooks: { PostToolUse: [{ matcher: 'Write' }] } }, // Missing hooks array
      ]

      for (const config of invalidConfigs) {
        mockFs.access.mockResolvedValue(true)
        mockFs.readFile.mockResolvedValue(JSON.stringify(config))

        // Act
        const result = await readClaudeSettings()
        const isValid = validateClaudeHookConfig(result)

        // Assert
        expect(isValid).toBe(false)
      }
    })
  })

  describe('Hook command resolution', () => {
    test('should_resolve_npm_binary_command', async () => {
      // Arrange
      const settings = {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write|Edit|MultiEdit',
              hooks: [
                {
                  type: 'command',
                  command: 'quality-check-claude-hook',
                  timeout: 10,
                  description: 'Quality check enforcement',
                },
              ],
            },
          ],
        },
      }

      // Act
      const resolvedCommand = resolveHookCommand(settings.hooks.PostToolUse[0].hooks[0].command)

      // Assert
      expect(resolvedCommand).toBe('npx quality-check-claude-hook')
    })

    test('should_handle_absolute_path_commands', async () => {
      // Arrange
      const absolutePath = '/usr/local/bin/quality-check-claude-hook'

      // Act
      const resolvedCommand = resolveHookCommand(absolutePath)

      // Assert
      expect(resolvedCommand).toBe(absolutePath)
    })

    test('should_handle_relative_path_commands', async () => {
      // Arrange
      const relativePath = './node_modules/.bin/quality-check-claude-hook'

      // Act
      const resolvedCommand = resolveHookCommand(relativePath)

      // Assert
      expect(resolvedCommand).toBe(relativePath)
    })
  })

  describe('Environment variable processing', () => {
    test('should_expand_project_directory_variable', () => {
      // Arrange
      const command = 'cd $CLAUDE_PROJECT_DIR && quality-check-claude-hook'
      process.env.CLAUDE_PROJECT_DIR = '/mock/project'

      // Act
      const expandedCommand = expandEnvironmentVariables(command)

      // Assert
      expect(expandedCommand).toBe('cd /mock/project && quality-check-claude-hook')
    })

    test('should_handle_multiple_environment_variables', () => {
      // Arrange
      const command = '$CLAUDE_PROJECT_DIR/packages/$PACKAGE_NAME/bin/hook'
      process.env.CLAUDE_PROJECT_DIR = '/project'
      process.env.PACKAGE_NAME = 'quality-check'

      // Act
      const expandedCommand = expandEnvironmentVariables(command)

      // Assert
      expect(expandedCommand).toBe('/project/packages/quality-check/bin/hook')
    })

    test('should_leave_undefined_variables_as_is', () => {
      // Arrange
      const command = 'echo $UNDEFINED_VAR'

      // Act
      const expandedCommand = expandEnvironmentVariables(command)

      // Assert
      expect(expandedCommand).toBe('echo $UNDEFINED_VAR')
    })
  })

  describe('Configuration fallbacks', () => {
    test('should_use_default_timeout_when_not_specified', async () => {
      // Arrange
      const settings = {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write|Edit',
              hooks: [
                {
                  type: 'command',
                  command: 'quality-check-claude-hook',
                  // timeout not specified
                },
              ],
            },
          ],
        },
      }

      // Act
      const config = normalizeHookConfig(settings.hooks.PostToolUse[0].hooks[0])

      // Assert
      expect(config.timeout).toBe(10) // Default timeout
    })

    test('should_use_default_continue_on_error_when_not_specified', async () => {
      // Arrange
      const hookConfig = {
        type: 'command',
        command: 'quality-check-claude-hook',
        // continueOnError not specified
      }

      // Act
      const config = normalizeHookConfig(hookConfig)

      // Assert
      expect(config.continueOnError).toBe(false) // Default to false for quality checks
    })

    test('should_preserve_explicit_configuration_values', async () => {
      // Arrange
      const hookConfig = {
        type: 'command',
        command: 'quality-check-claude-hook',
        timeout: 30,
        continueOnError: true,
        description: 'Custom quality check',
      }

      // Act
      const config = normalizeHookConfig(hookConfig)

      // Assert
      expect(config.timeout).toBe(30)
      expect(config.continueOnError).toBe(true)
      expect(config.description).toBe('Custom quality check')
    })
  })

  describe('Settings validation edge cases', () => {
    test('should_handle_empty_matcher_patterns', async () => {
      // Arrange
      const settings = {
        hooks: {
          PostToolUse: [
            {
              matcher: '',
              hooks: [{ type: 'command', command: 'test' }],
            },
          ],
        },
      }

      // Act
      const isValid = validateClaudeHookConfig(settings)

      // Assert
      expect(isValid).toBe(false)
    })

    test('should_validate_supported_hook_types', async () => {
      // Arrange
      const settings = {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [
                { type: 'command', command: 'valid' },
                { type: 'unsupported', command: 'invalid' },
              ],
            },
          ],
        },
      }

      // Act
      const isValid = validateClaudeHookConfig(settings)

      // Assert
      expect(isValid).toBe(false) // Should fail due to unsupported hook type
    })

    test('should_require_command_for_command_type_hooks', async () => {
      // Arrange
      const settings = {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [
                { type: 'command' }, // Missing command
              ],
            },
          ],
        },
      }

      // Act
      const isValid = validateClaudeHookConfig(settings)

      // Assert
      expect(isValid).toBe(false)
    })
  })
})
