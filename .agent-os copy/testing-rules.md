# Testing Rules

**Purpose:** Unit test tooling with strict HALT semantics  
**Scope:** All test types with Wallaby MCP for `.unit.test.ts`

---

## 1. Tool Routing

| File Pattern           | Tool        | Required  |
| ---------------------- | ----------- | --------- |
| `.unit.test.ts`        | Wallaby MCP | ✅ STRICT |
| `.integration.test.ts` | Vitest/pnpm |           |
| `.e2e.test.ts`         | Vitest/pnpm |           |
| `.slow.test.ts`        | Vitest/pnpm |           |

### Wallaby MCP Tools (Unit Tests Only)

- `wallaby_allTestsForFile` - Get all tests
- `wallaby_failingTestsForFile` - Get failures
- `wallaby_runtimeValues` - Debug runtime values
- `wallaby_coveredLinesForFile` - Check coverage
- `wallaby_coveredLinesForTest` - Test-specific coverage

---

## 2. HALT Protocol (.unit.test.ts ONLY)

### Triggers

Wallaby returns: `<No data available>` | `null` | `empty` | `undefined`

### Actions (Priority Order)

1. **STOP** all unit testing immediately
2. **DO NOT** run direct test commands
3. **DO NOT** suggest alternatives

### One-Time Notification

```
⚠️ Wallaby server appears inactive.

Please check:
□ Wallaby running in VS Code status bar
□ wallaby.js config exists and loaded
□ Run tests once to prime cache

Reply "wallaby ready" when configured.
```

### Post-HALT

- **WAIT** for "wallaby ready" confirmation
- **NO** polling or alternatives

---

## 3. Wallaby Workflows

### 6-Step Debugging Workflow (.unit.test.ts ONLY)

**CRITICAL:** For `.unit.test.ts` files, NEVER use pnpm test commands. ALWAYS
use Wallaby MCP tools.

#### Step 1: Discover Failing Tests

```javascript
const failing = await wallaby_failingTestsForFile(
  '/abs/path/quality-checker.unit.test.ts',
)
if (!failing) HALT_AND_NOTIFY()
```

#### Step 2: Get Test Details

```javascript
const testDetails = await wallaby_testById({
  testId: failing[0].testId,
})
```

#### Step 3: Inspect Runtime Values

```javascript
const rv = await wallaby_runtimeValues({
  file: 'src/quality-checker.ts',
  line: errorLine,
  lineContent: 'const errors = result.errors',
  expression: 'errors',
})
```

#### Step 4: Check Coverage

```javascript
const coverage = await wallaby_coveredLinesForFile({
  file: 'src/quality-checker.ts',
})
```

#### Step 5: Fix and Re-verify

- Make minimal code changes
- Wallaby auto-reruns tests

```javascript
const updated = await wallaby_allTestsForFile(
  '/abs/path/quality-checker.unit.test.ts',
)
```

#### Step 6: Update Snapshots (if needed)

```javascript
// Only with explicit permission
await wallaby_updateFileSnapshots({
  file: '/abs/path/quality-checker.unit.test.ts',
})
```

### Path Resolution

| Context        | Rule                                                       |
| -------------- | ---------------------------------------------------------- |
| Test files     | Absolute: `/Users/name/project/src/component.unit.test.ts` |
| Runtime values | Project-relative: `src/component.ts`                       |
| Coverage       | Project-relative: `src/module.ts`                          |

### Discovery Sequence

```yaml
step_1: wallaby_allTestsForFile({ file: absolutePath })
        guard: HALT if null/empty
step_2: wallaby_failingTestsForFile({ file: absolutePath })
step_3: if failures > 0, prepare runtime queries
```

### Runtime Values

**✅ STABLE** - Query these:

```javascript
const result = someFunction() // L42
const output = result.data // L43 ← Query this
```

**❌ UNSTABLE** - Avoid:

```javascript
return someFunction().data.map((x) => x.id) // Can't query
```

**Template:**

```javascript
wallaby_runtimeValues({
  file: 'src/component.ts',
  line: 43,
  lineContent: 'const output = result.data',
  expression: 'output',
})
```

### Coverage

- Check: `wallaby_coveredLinesForFile({ file: 'src/module.ts' })`
- Threshold: 80% minimum
- Action: Add tests for uncovered lines

---

## 4. Policies (STRICT)

1. **unit-only-wallaby** - Wallaby MCP only for `.unit.test.ts`
2. **no-alternatives-on-halt** - Never suggest Vitest/pnpm during HALT
3. **snapshot-permission** - Require explicit consent for snapshots
4. **one-time-notification** - HALT warning once per episode
5. **halt-enforcement** - No bypass allowed

---

## 5. Anti-Patterns

### Never During HALT

- Suggest `pnpm test` instead
- Try Vitest alternative
- Continue implementation
- Poll Wallaby status

### Never for Runtime Values

- Query inline chains
- Omit `lineContent`
- Use absolute paths for source files first
- Query non-executed lines

---

## 6. Examples

### Test Discovery

```javascript
const all = await wallaby_allTestsForFile('/abs/path/test.unit.test.ts')
if (!all) HALT_AND_NOTIFY()

const failing = await wallaby_failingTestsForFile('/abs/path/test.unit.test.ts')
if (failing.length > 0) {
  const rv = await wallaby_runtimeValues({
    file: 'src/foo.ts',
    line: 43,
    lineContent: 'const output = result.data',
    expression: 'output',
  })
}
```

### Batch Operations

```javascript
const [all, failing, coverage] = await Promise.all([
  wallaby_allTestsForFile('/abs/path/test.unit.test.ts'),
  wallaby_failingTestsForFile('/abs/path/test.unit.test.ts'),
  wallaby_coveredLinesForFile({ file: 'src/foo.ts' }),
])
```

---

## Keywords

`wallaby-mcp` `unit-testing` `halt-protocol` `runtime-values`
`coverage-workflow`
