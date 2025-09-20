# Task 015 Analysis: Align CLI Helper Semantics

## Executive Summary
The perceived API mismatch is actually a documentation/naming issue. The helper functions already support tri-registration (spawn/exec/execSync) through the underlying `mocker.register()` method. The real issues are missing fork() support and unclear documentation that misleads users about the actual behavior.

## Current Helper Implementation

### Core Helper Functions

1. **quickMocks() - packages/testkit/src/cli/spawn.ts:236**
```typescript
export function quickMocks(mocks: QuickMock[]) {
  const mocker = spawnMock()
  mocks.forEach((mock) => {
    mocker.register({
      command: mock.command,
      args: mock.args || [],
      behavior: mock.behavior,
    })
  })
}
```
- **Current behavior**: Calls mocker.register() which tri-registers spawn/exec/execSync
- **Misleading name**: "quickMocks" doesn't indicate multi-method support

2. **spawnUtils() - packages/testkit/src/cli/spawn.ts:245**
```typescript
export const spawnUtils = () => {
  quickMocks([
    {
      command: 'node',
      args: ['-v'],
      behavior: { stdout: 'v18.0.0' },
    },
  ])
}
```
- Utility helper that uses quickMocks
- Registers common Node.js commands

3. **commonCommands() - packages/testkit/src/cli/spawn.ts:250**
```typescript
export const commonCommands = () => {
  quickMocks([
    { command: 'echo', behavior: { stdout: '' } },
    { command: 'ls', behavior: { stdout: '' } },
    // ... more commands
  ])
}
```
- Registers common shell commands
- Also uses tri-registration through quickMocks

### Underlying Registration

**ProcessMocker.register() - packages/testkit/src/cli/process-mock.ts:164-182**
```typescript
register(config: ProcessMockConfig) {
  // Validates config
  const registration = { id, ...validated }
  this.registrations.set(id, registration)

  // Registers for spawn
  this.spawnMocks.set(createSpawnKey(validated), id)

  // ALSO registers for exec/execSync
  this.execMocks.set(createExecKey(validated), id)

  return { id, registration }
}
```
- **Key finding**: register() already does tri-registration!
- Creates entries in both spawnMocks and execMocks maps
- The exec key is used by both exec() and execSync()

## Test Usage Patterns

### Current Test Usage

1. **spawn.test.ts**
   - Uses quickMocks() at line 89, 108, 123
   - Tests spawn() behavior
   - Works correctly

2. **process-mock.test.ts:66-82**
```typescript
it('should handle exec with callback', async () => {
  const mocker = new ProcessMocker()
  mocker.activate()

  mocker.register({
    command: 'echo',
    args: ['hello'],
    behavior: { stdout: 'hello' }
  })

  const result = await new Promise((resolve) => {
    childProcess.exec('echo hello', (error, stdout, stderr) => {
      resolve({ error, stdout, stderr })
    })
  })

  expect(result.stdout).toBe('hello')
})
```
- Tests exec() after registration
- **Works because register() tri-registers**

3. **process-mock.test.ts:84-94**
```typescript
it('should handle execSync', () => {
  const mocker = new ProcessMocker()
  mocker.activate()

  mocker.register({
    command: 'echo',
    args: ['world'],
    behavior: { stdout: 'world' }
  })

  const result = childProcess.execSync('echo world')
  expect(result.toString()).toBe('world')
})
```
- Tests execSync() after registration
- **Also works due to tri-registration**

### No Actual Mismatch!
- Tests use exec/execSync successfully
- They work because register() handles all three methods
- The perceived issue is documentation/naming confusion

## Method Coverage Analysis

### Currently Supported
1. **spawn()** ✓ - Fully supported
2. **exec()** ✓ - Supported via tri-registration
3. **execSync()** ✓ - Supported via tri-registration
4. **fork()** ✓ - Has dedicated mock but not in tri-registration
5. **spawnSync()** ✓ - Supported
6. **execFile()** ✗ - Not implemented
7. **execFileSync()** ✗ - Not implemented

### Registration Gaps
- fork() has its own mock method but isn't included in default registration
- execFile/execFileSync not implemented (less commonly used)

## Recommended API Design

### 1. Update Default Registration
```typescript
// Make it quad-registration by default
register(config: ProcessMockConfig) {
  // ... existing validation

  // Register for all common methods
  this.spawnMocks.set(createSpawnKey(validated), id)
  this.execMocks.set(createExecKey(validated), id)
  this.forkMocks.set(createForkKey(validated), id)  // ADD THIS

  return { id, registration }
}
```

### 2. Add Scoped Registration Options
```typescript
interface QuickMockOptions {
  methods?: ('spawn' | 'exec' | 'execSync' | 'fork' | 'all')[]
}

export function quickMocks(mocks: QuickMock[], options?: QuickMockOptions) {
  const methods = options?.methods || ['all']
  const mocker = spawnMock()

  mocks.forEach((mock) => {
    if (methods.includes('all')) {
      mocker.register(mock)  // Default quad-registration
    } else {
      mocker.registerScoped(mock, methods)  // Method-specific
    }
  })
}
```

### 3. Rename for Clarity
```typescript
// Better names that reflect actual behavior
export const cliMocks = quickMocks  // Clearer that it's not spawn-only
export const registerCommands = quickMocks  // Alternative name
```

## TypeScript Typing Requirements

### Current Types (Accurate but Unclear)
```typescript
interface QuickMock {
  command: string
  args?: string[]
  behavior: MockBehavior
}
```

### Recommended Enhanced Types
```typescript
interface QuickMock {
  command: string
  args?: string[]
  behavior: MockBehavior
  /** Methods to register this mock for. Defaults to all. */
  methods?: ('spawn' | 'exec' | 'execSync' | 'fork' | 'all')[]
}

interface QuickMockOptions {
  /** Global default for which methods to register. */
  methods?: ('spawn' | 'exec' | 'execSync' | 'fork' | 'all')[]
  /** Whether to validate command exists on PATH. */
  validateCommand?: boolean
}
```

## Documentation Updates Needed

### 1. Update JSDoc for quickMocks
```typescript
/**
 * Register mock behaviors for CLI commands.
 * By default, registers mocks for spawn(), exec(), execSync(), and fork().
 *
 * @example
 * quickMocks([
 *   { command: 'git', args: ['status'], behavior: { stdout: 'clean' } }
 * ])
 *
 * // Now all of these will work:
 * spawn('git', ['status'])
 * exec('git status')
 * execSync('git status')
 * fork('git', ['status'])
 */
```

### 2. Update README/Documentation
- Clarify that helpers register for multiple methods
- Explain the tri/quad-registration behavior
- Provide examples showing all supported methods

## Migration Impact Assessment

### Low Impact Changes
1. **Adding fork() to default registration**: Backward compatible, only adds functionality
2. **Documentation updates**: No code changes required
3. **Adding optional scoping**: Backward compatible with defaults

### Medium Impact Changes
1. **Renaming helpers**: Would require updates to existing tests
2. **Changing default behavior**: Could break tests expecting specific methods

### Recommendation
- Start with low-impact changes (add fork, update docs)
- Add optional scoping for advanced users
- Consider deprecation cycle for any renames

## Implementation Steps

1. **Update register() method** to include fork() by default
2. **Update JSDoc comments** to clarify multi-method behavior
3. **Add optional scoping** for users who need method-specific mocking
4. **Update documentation** with clear examples
5. **Add tests** verifying all methods work with helpers
6. **Consider helper renames** in future major version

## Key Findings

1. **No actual API mismatch** - helpers already support exec/execSync
2. **Real issue is documentation** - misleading names/docs suggest spawn-only
3. **Missing fork() support** in default registration
4. **Works by design** - tri-registration is intentional and functional

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Adding fork() breaks existing mocks | Low | Fork uses different signature, unlikely to conflict |
| Documentation confusion | Medium | Clear examples showing all methods |
| Performance overhead of quad-registration | Low | Hash map lookups are O(1) |
| TypeScript type complexity | Low | Keep simple defaults, advanced types optional |

## Success Metrics

- All child_process methods work with helper functions
- Clear documentation prevents confusion
- No undefined returns from any method
- Tests demonstrate all supported methods
- TypeScript provides accurate types

## Conclusion

The perceived API mismatch doesn't exist - the helpers already support multiple methods through tri-registration. The solution is to add fork() support, update documentation to clarify the behavior, and optionally provide method-specific scoping for advanced use cases. This is primarily a documentation and minor enhancement task rather than a major refactoring.