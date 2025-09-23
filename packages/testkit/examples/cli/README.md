# CLI Mocking Examples

This directory contains runnable examples that demonstrate the CLI process
mocking utilities: spawn/exec/execSync/execFile/fork mocks, call verification,
stream behavior, and timing controls.

## Example Files

### 1. [Basic Success](./01-basic-success.test.ts)

Fundamental success path and bootstrap check

- Register a simple command and assert stdout/exit code
- Verify bootstrap hoists child_process mocks
- Inspect registry state and captured calls

### 2. [Non‑zero Exit](./02-nonzero-exit.test.ts)

Simulating failures and error paths

- Configure exitCode/stderr for failure
- Assert error handling and process termination
- Capture and assert exec/execSync call metadata

### 3. [Args & Regex Matching](./03-args-regex.test.ts)

Flexible matching for command variants

- Exact string and tokenized args matching
- Regex patterns for robust matching
- Normalization helpers for predictable lookups

### 4. [Verify Calls](./04-verify-calls.test.ts)

Introspection and assertions

- Inspect registry call history for exec/spawn
- Assert arguments, ordering, and counts
- Combine with vi.fn spies for end‑to‑end checks

### 5. [Long‑running Processes](./05-long-running.test.ts)

Streams, timing and progress

- Simulate stdout/stderr streaming over time
- Advance time deterministically in tests
- Ensure cleanup of spawned process state

### 6. [Interactive Input](./06-interactive.test.ts)

stdin and prompt workflows

- Write to stdin and resolve on input
- Verify bi‑directional stream behavior
- Ensure isolation between tests

### 7. [ENOENT Behavior](./07-enoent-behavior.test.ts)

When a command isn’t mocked

- Assert the debug output and safe fallbacks
- Guard rails to detect missing mocks early
- Recommended patterns to make tests explicit

## Common Patterns

- Bootstrap first: testkit loads an import‑order‑safe bootstrap that mocks
  `node:child_process` before tests run
- Central registry: register mocks via the registry; assert calls via captured
  metadata
- Spawn vs Exec: choose spawn for streaming/long‑running, exec/execSync for
  simple results
- Deterministic timing: prefer advancing fake timers over real delays

## Running the Examples

These live inside `@template/testkit`. Use any of the repo tasks:

- Test all: run the workspace default test task or filter to the testkit package
- Quick/debug: enable extra logs with `DEBUG_TESTKIT=true`

## Best Practices

1. Keep mocks near the test; avoid global state where possible
2. Prefer explicit registrations over broad regex when feasible
3. Assert both behavior and recorded calls to catch regressions
4. Don’t mix real child processes with the mock in the same test suite
