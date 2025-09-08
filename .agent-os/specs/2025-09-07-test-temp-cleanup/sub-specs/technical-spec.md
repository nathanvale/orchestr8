# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-09-07-test-temp-cleanup/spec.md

## Technical Requirements

### Current Issues Analysis

Based on code analysis, the following issues were identified:

1. **claude-hook-workflow.integration.test.ts** creates directories in project
   root `test-temp/` (lines 18-26)
2. Cleanup mechanism in afterEach hook (lines 32-43) is not working properly
3. The `test-temp` directory is not in `.gitignore`, risking accidental commits
4. Tests accumulate directories with patterns:
   - `claude-test-{timestamp}`
   - `eslint-config-test-{timestamp}`

### Migration Requirements

1. **Replace Project Root Usage**
   - Current: `path.join(__dirname, '..', '..', '..', '..', 'test-temp', ...)`
   - Target: `path.join(os.tmpdir(), 'quality-check-tests', ...)`

2. **Use Existing Test Isolation Utility**
   - The project already has `test-utils/test-isolation.ts` with proper temp
     directory handling
   - Refactor `claude-hook-workflow.integration.test.ts` to use
     `createIsolatedTestEnv()`

3. **Directory Naming Convention**
   - Pattern:
     `claude-test-${process.pid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
   - Ensures uniqueness for parallel test execution
   - Includes process ID for better tracking

### Cleanup Implementation

1. **Multi-Layer Cleanup Strategy**

   ```typescript
   afterEach(async () => {
     // 1. Restore original working directory
     process.chdir(originalCwd)

     // 2. Try graceful cleanup
     try {
       await fs.rm(tempDir, { recursive: true, force: true })
     } catch (error) {
       // 3. Fallback to sync cleanup
       try {
         fs.rmSync(tempDir, { recursive: true, force: true })
       } catch {
         // Log but don't fail test
         console.warn(`Failed to cleanup: ${tempDir}`)
       }
     }
   })
   ```

2. **Process Exit Handler**
   ```typescript
   process.on('exit', () => {
     // Emergency cleanup for unexpected exits
     if (tempDir && fs.existsSync(tempDir)) {
       try {
         fs.rmSync(tempDir, { recursive: true, force: true })
       } catch {}
     }
   })
   ```

### Parallel Test Safety

1. **Unique Directory Generation**
   - Use `fs.mkdtemp()` for atomic directory creation
   - Include process PID in directory name
   - Add random suffix to prevent timestamp collisions

2. **Test Isolation**
   - Each test gets its own temp directory
   - No shared state between tests
   - Working directory restored after each test

### File System Operations

1. **Error Handling**
   - All fs operations wrapped in try-catch
   - Use `force: true` flag for cleanup
   - Continue test execution even if cleanup fails

2. **Cross-Platform Compatibility**
   - Use `path.join()` for all path operations
   - Use `os.tmpdir()` for system temp directory
   - Handle Windows path length limitations

### Performance Optimization

1. **Cleanup Timing**
   - Immediate cleanup in afterEach hooks
   - Don't wait for all tests to complete
   - Parallel cleanup where possible

2. **Directory Structure**
   - Create minimal directory structure
   - Only create directories actually needed
   - Lazy creation of subdirectories

## Integration Points

### Test Framework Integration

1. **Vitest Hooks**
   - Use beforeEach for setup
   - Use afterEach for cleanup
   - Proper async/await handling

2. **Test Helper Functions**
   - Leverage existing `createTestProject()` helper
   - Use `executeCommand()` for subprocess management
   - Apply `retry()` for flaky operations

### CI/CD Considerations

1. **GitHub Actions**
   - Temp directories automatically cleaned by runner
   - No special configuration needed
   - Works with matrix builds

2. **Local Development**
   - OS handles cleanup of old temp files
   - Manual cleanup script provided if needed
   - Clear logging of temp directory locations

## Validation Requirements

1. **Cleanup Verification**
   - Test should verify directory doesn't exist after cleanup
   - Add assertions for successful cleanup
   - Monitor for directory accumulation

2. **Git Status Check**
   - Ensure `git status` remains clean after tests
   - No untracked test-temp directories
   - Verify .gitignore effectiveness

3. **Performance Metrics**
   - Tests should complete within 2 seconds
   - Cleanup should take less than 100ms
   - No performance regression from changes
