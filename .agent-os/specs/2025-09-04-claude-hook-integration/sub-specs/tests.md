# Tests Specification

This is the tests coverage details for the spec detailed in
@.agent-os/specs/2025-09-04-claude-hook-integration/spec.md

> Created: 2025-09-04 Version: 1.0.0

## Test Coverage

### Unit Tests

**hooks/claude-hook.js**

- should_execute_quality_check_facade_when_hook_triggered
- should_propagate_exit_code_when_child_process_fails
- should_timeout_after_2_seconds_when_process_hangs
- should_handle_uncaught_exceptions_gracefully
- should_set_proper_environment_variables_when_executing

**ErrorClassifier (Enhancement Tests)**

- should_classify_prettier_issues_as_auto_fixable
- should_classify_unused_vars_as_claude_fixable
- should_classify_complexity_issues_as_human_required
- should_generate_claude_instructions_for_fixable_issues
- should_provide_educational_content_for_human_issues

**ClaudeFacade Integration**

- should_parse_claude_payload_from_stdin_correctly
- should_handle_malformed_json_payload_gracefully
- should_skip_unsupported_file_types_silently
- should_process_typescript_files_through_quality_check
- should_normalize_legacy_payload_formats

### Integration Tests

**End-to-End Hook Workflow**

- should_complete_auto_fix_workflow_in_under_2_seconds
- should_block_claude_with_instructions_for_fixable_issues
- should_provide_educational_stop_for_complex_issues
- should_handle_multiple_file_operations_correctly
- should_maintain_performance_under_concurrent_hooks

**Real Claude Code Integration**

- should_integrate_with_claude_code_write_operations
- should_integrate_with_claude_code_edit_operations
- should_integrate_with_claude_code_multiedit_operations
- should_handle_claude_code_timeout_scenarios

**Configuration Integration**

- should_respect_claude_settings_json_configuration
- should_handle_missing_configuration_gracefully
- should_override_behavior_with_environment_variables

### End-to-End Tests

**Complete User Workflows**

- should_complete_silent_auto_fix_workflow_for_formatting_issues
- should_complete_block_and_fix_workflow_for_type_errors
- should_complete_stop_and_educate_workflow_for_complexity_issues
- should_handle_mixed_issue_types_with_appropriate_responses

**Performance Validation**

- should_complete_hook_execution_within_2_second_timeout
- should_maintain_memory_usage_under_50mb_during_execution
- should_handle_large_files_up_to_5mb_efficiently

## Mocking Requirements

### Hook Process Mocking

```javascript
// Mock execSync for hook wrapper testing
const mockExecSync = vi.fn()
vi.mock('child_process', () => ({
  execSync: mockExecSync,
}))

// Test scenarios
describe('claude-hook wrapper', () => {
  test('should_propagate_success_exit_code_when_quality_check_passes', () => {
    // Arrange
    mockExecSync.mockImplementation(() => {}) // Success case

    // Act & Assert
    expect(() => runHook()).not.toThrow()
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('node dist/facades/claude.js'),
      expect.objectContaining({
        timeout: 2000,
        env: expect.objectContaining({
          QUALITY_CHECK_MODE: 'claude-hook',
        }),
      }),
    )
  })
})
```

### Stdin Payload Mocking

```javascript
// Mock stdin for payload testing
const mockStdin = {
  setEncoding: vi.fn(),
  on: vi.fn(),
  data: '',
}

vi.mock('process', () => ({
  stdin: mockStdin,
  exit: vi.fn(),
}))

// Payload simulation
function simulateClaudePayload(payload) {
  const jsonPayload = JSON.stringify(payload)

  // Trigger data event
  const dataCallback = mockStdin.on.mock.calls.find(
    (call) => call[0] === 'data',
  )[1]
  dataCallback(jsonPayload)

  // Trigger end event
  const endCallback = mockStdin.on.mock.calls.find(
    (call) => call[0] === 'end',
  )[1]
  endCallback()
}

// Test usage
test('should_parse_valid_claude_payload_correctly', async () => {
  // Arrange
  const payload = {
    operation: 'write_file',
    file_path: '/test/file.ts',
    content: 'export const test = "hello"',
  }

  // Act
  simulateClaudePayload(payload)
  const result = await parseClaudePayload()

  // Assert
  expect(result).toEqual(payload)
})
```

### File System Mocking

```javascript
// Mock file operations for testing
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
}))

// Test file processing without actual I/O
test('should_process_file_content_for_quality_check', async () => {
  // Arrange
  const mockContent = 'const unused = "test"'
  vi.mocked(readFile).mockResolvedValue(mockContent)

  // Act
  const result = await processFileForQuality('/test/file.ts')

  // Assert
  expect(result.issues).toHaveLength(1)
  expect(result.issues[0].ruleId).toBe('@typescript-eslint/no-unused-vars')
})
```

### Error Classification Mocking

```javascript
// Mock error classification for predictable testing
const mockClassifier = {
  classifyIssues: vi.fn(),
  isAutoFixable: vi.fn(),
  isClaudeFixable: vi.fn(),
  generateClaudeInstructions: vi.fn(),
  generateEducationalContent: vi.fn(),
}

// Test different classification scenarios
describe('Error Classification', () => {
  test('should_return_auto_fixable_for_prettier_issues', () => {
    // Arrange
    const prettierIssue = {
      ruleId: 'prettier/prettier',
      message: 'Delete trailing whitespace',
      line: 5,
      column: 10,
    }

    // Act
    const result = classifier.classifySingleIssue(prettierIssue)

    // Assert
    expect(result.tier).toBe('auto-fixable')
    expect(result.action).toBe('silent-fix')
  })

  test('should_return_claude_fixable_for_unused_vars', () => {
    // Arrange
    const unusedVarIssue = {
      ruleId: '@typescript-eslint/no-unused-vars',
      message: 'Unused variable: event',
      line: 15,
      column: 8,
    }

    // Act
    const result = classifier.classifySingleIssue(unusedVarIssue)

    // Assert
    expect(result.tier).toBe('claude-fixable')
    expect(result.action).toBe('block-and-instruct')
    expect(result.instructions).toContain('prefix with underscore')
  })
})
```

### Performance Test Utilities

```javascript
// Performance validation helpers
function measureHookPerformance(payload) {
  const startTime = Date.now()

  return new Promise((resolve) => {
    const child = spawn('node', ['hooks/claude-hook.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    child.stdin.write(JSON.stringify(payload))
    child.stdin.end()

    child.on('close', (code) => {
      const duration = Date.now() - startTime
      resolve({ exitCode: code, duration })
    })
  })
}

// Performance tests
test('should_complete_hook_execution_within_2_seconds', async () => {
  // Arrange
  const payload = createTestPayload()

  // Act
  const result = await measureHookPerformance(payload)

  // Assert
  expect(result.duration).toBeLessThan(2000)
  expect(result.exitCode).toBe(0)
})
```

## Test Environment Setup

### Wallaby Configuration for Hook Tests

```javascript
// wallaby.js updates for hook testing
module.exports = {
  files: [
    'hooks/**/*.js',
    'packages/quality-check/src/**/*.ts',
    'packages/quality-check/dist/**/*.js',
  ],

  tests: [
    'hooks/**/*.unit.test.js',
    'packages/quality-check/tests/**/*.unit.test.ts',
  ],

  env: {
    type: 'node',
    params: {
      env: 'NODE_ENV=test;QUALITY_CHECK_MODE=test',
    },
  },
}
```

### Test Data Fixtures

```javascript
// Test payload fixtures
export const TEST_PAYLOADS = {
  validWrite: {
    operation: 'write_file',
    file_path: '/test/components/Button.ts',
    content: 'export const Button = () => <button>Click</button>',
    metadata: { tool_name: 'Write', timestamp: '2025-09-04T10:30:00Z' },
  },

  prettierIssue: {
    operation: 'write_file',
    file_path: '/test/utils.ts',
    content: 'export const util = ( x ) => { return x ; }', // Bad formatting
    metadata: { tool_name: 'Write' },
  },

  typeError: {
    operation: 'edit_file',
    file_path: '/test/service.ts',
    content: 'function process(data: any) { return data.value }', // any type
    metadata: { tool_name: 'Edit' },
  },

  complexityIssue: {
    operation: 'write_file',
    file_path: '/test/complex.ts',
    content: generateComplexFunction(20), // >10 complexity
    metadata: { tool_name: 'Write' },
  },
}
```

This comprehensive test specification ensures robust validation of the Claude
hook integration across all scenarios and performance requirements.
