# File System Test Utilities (fs)

Utilities for creating and managing isolated temporary directories in tests.
They provide:

- Deterministic, isolated scratch space per test or scope
- Rich helper methods (write/read files, nested structure creation, existence
  checks)
- Automatic cleanup via lifecycle hooks to prevent temp directory leaks
- Bulk creation and scoped helpers for complex scenarios

## When to Use

Use these helpers any time your test needs to interact with the filesystem but
should remain hermetic and leave no residue (e.g., generating config files,
creating transient project layouts, simulating tool output, writing compiled
artifacts).

## Primary APIs

```ts
import {
  createTempDirectory,
  createNamedTempDirectory,
  createMultipleTempDirectories,
  cleanupMultipleTempDirectories,
  useTempDirectory,
  useMultipleTempDirectories,
  createManagedTempDirectory,
  cleanupTempDirectory,
  cleanupAllTempDirectories,
  getTempDirectoryCount,
  withTempDirectoryScope,
  type TempDirectory,
  type TempDirectoryOptions,
  type DirectoryStructure,
} from '@template/testkit/fs'
```

### `createTempDirectory(options?)`

Creates a single temp directory and returns a `TempDirectory` object with helper
methods. You are responsible for calling `cleanup()` unless you use a managed
variant.

### `useTempDirectory(options?)`

Vitest hook that provisions a fresh temp directory **before each test** and
cleans it **after each test**. Returns a getter you call inside tests.

### `useMultipleTempDirectories(count, options?)`

Same pattern as `useTempDirectory` but provisions `count` directories.

### `createManagedTempDirectory(options?)`

Allocates a directory now and automatically cleans it up at the end of the test
file (afterAll). Useful when you don't want per-test churn.

### `withTempDirectoryScope(fn)`

Creates an isolated scope where every directory you create via the provided
`createTemp` helper is automatically cleaned when the scope resolves—ideal for
nested orchestration or multi-phase setup.

### `getTempDirectoryCount()`

Debug helper to assert you are not leaking directories.

## TempDirectory Helper Methods

Each `TempDirectory` exposes:

- `path` (absolute string path)
- `writeFile(relativePath, content)` – auto‑creates parent folders
- `mkdir(relativePath)` – recursive mkdir
- `getPath(relativePath)` – resolve absolute path
- `readFile(relativePath)` – UTF‑8 read
- `exists(relativePath)` – boolean existence check
- `readdir(relativePath?)` – list directory entries
- `copyFileIn(sourcePath, destRelativePath)` – import external fixture
- `createStructure(structure)` – batch create nested directories/files
- `cleanup()` – remove directory recursively

`createStructure` consumes an object tree:

```ts
await temp.createStructure({
  'src': {
    'index.ts': 'export const answer = 42',
    'lib': {
      'util.ts': 'export function double(n:number){return n*2}',
    },
  },
  'package.json': '{"name":"demo"}',
})
```

## Example

See: `packages/testkit/examples/fs/01-basic-temp-dir.test.ts`

```ts
import { createTempDirectory } from '@template/testkit/fs'

it('writes and reads files', async () => {
  const temp = await createTempDirectory({ prefix: 'example-' })
  await temp.writeFile('nested/hello.txt', 'hi')
  expect(await temp.readFile('nested/hello.txt')).toBe('hi')
  await temp.cleanup()
})
```

## Patterns & Recommendations

1. Prefer `useTempDirectory()` for simple stateless tests needing ephemeral
   space.
2. Use `createManagedTempDirectory()` when a suite performs incremental work
   across multiple tests and cleanup at the end suffices.
3. Lean on `withTempDirectoryScope` for functions that orchestrate their own
   internal scratch space—keeps callers from juggling cleanup.
4. Always assert key behavioral outcomes via file contents or structure, not
   internal paths.
5. If debugging leaks, assert `getTempDirectoryCount() === 0` in an `afterAll`
   block to enforce constraints.

## No Extra Setup Required

These utilities require no external services or environment flags. They rely
solely on the host OS temp directory. Works in CI, local, and containerized
runs.

## Future Extensions (Potential)

- In‑memory (memfs) adapter for even faster IO
- Auto snapshot of directory structure for debugging on failure
- Size/time budgets with automatic pruning

Contributions welcome—keep APIs minimal and composable.
