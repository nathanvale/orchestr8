## Agent OS Documentation

### Product Context

- **Mission & Vision:** @.agent-os/product/mission.md
- **Technical Architecture:** @.agent-os/product/tech-stack.md
- **Development Roadmap:** @.agent-os/product/roadmap.md
- **Decision History:** @.agent-os/product/decisions.md

### Development Standards

<!-- - **Code Style:** @~/.agent-os/standards/code-style.md
- **Best Practices:** @~/.agent-os/standards/best-practices.md -->

## ⚡ Quick Start

### 🎯 Top 7 Essential Commands

| Command          | Description              | When to Use               |
| ---------------- | ------------------------ | ------------------------- |
| `bun test`       | Run tests once           | Before committing changes |
| `bun test:watch` | Watch mode testing       | During development        |
| `bun dev`        | Start development server | Begin coding session      |
| `bun build:all`  | Build everything         | Prepare for production    |
| `bun lint:fix`   | Auto-fix all issues      | Clean up code             |
| `bun commit`     | Guided commit wizard     | Ready to commit           |
| `bun validate`   | Full validation suite    | Final check before push   |

> 💡 **ADHD Tip**: These 7 commands cover 90% of daily development. Bookmark
> this section!

### Project Management

- **Active Specs:** @.agent-os/specs/
- **Spec Planning:** Use `@~/.agent-os/instructions/create-spec.md`
- **Tasks Execution:** Use `@~/.agent-os/instructions/execute-tasks.md`

## Workflow Instructions

When asked to work on this codebase:

1. **First**, check @.agent-os/product/roadmap.md for current priorities
2. **Then**, follow the appropriate instruction file:
   - For new features: @.agent-os/instructions/create-spec.md
   - For tasks execution: @.agent-os/instructions/execute-tasks.md
3. **Always**, adhere to the standards in the files listed above

## Important Notes

- Product-specific files in `.agent-os/product/` override any global standards
- User's specific instructions override (or amend) instructions found in
  `.agent-os/specs/...`
- Always adhere to established patterns, code style, and best practices
  documented above.

## AI Agent Coding Rules (STRICT)

Purpose: Minimize human rework by generating code that passes ESLint, TypeScript
checks, Vitest rules, and Prettier formatting on first attempt. Follow these in
every edit unless a spec explicitly overrides.

### 1. TypeScript & Types

- No `any` (rule: `@typescript-eslint/no-explicit-any`). If unavoidable, explain
  in a trailing comment and prefer a branded or union type.
- No non‑null assertions (`!`). Refactor to explicit guards or use optional
  chaining + nullish coalescing (`?.`, `??`).
- Always add explicit return types for exported functions & public APIs
  (internal concise arrow callbacks may rely on inference).
- Use `import type { Foo } from '...'` for all type imports (rule:
  `consistent-type-imports`).
- Prefer `Array<T>` over `T[]` (house style) & meaningful generic names
  (`ResultType`, not `T`).
- Use discriminated unions instead of boolean parameter flags.
- Surface errors via `Error` subclasses – never throw string literals.

### 2. Async & Promises

- No floating promises (`no-floating-promises` / `no-misused-promises`). Always
  `await` or explicitly handle with `.then().catch()` + comment.
- Use top‑level `await` only in build/dev setup files
  (unicorn/prefer-top-level-await).
- For parallel awaits, use `Promise.all` with descriptive variable names; ensure
  independent operations only.

### 3. Control Flow & Complexity

- Keep functions: ≤75 LOC (≤200 in tests), complexity ≤15 (≤30 in tests), max 3
  nesting depth, max 4 parameters (else object param), per ESLint config.
- Extract inner logic to pure helpers if crossing limits.
- Duplicate string literal appears ≥3 times → lift to `const` (sonarjs / magic
  string rule intent).

### 4. Imports & Module Boundaries

- Do not introduce circular deps; if adding a new cross‑package import, confirm
  direction (utils → core is forbidden; core may import utilities).
- Keep import groups ordered: builtin, external, internal workspace packages,
  relative; no blank line at file end (Prettier fixes spacing—don’t fight it).
- Never deep import another package's internal path (only public exports).

### 5. Style & Formatting

- Single quotes, no semicolons, trailing commas where valid (Prettier).
- Named function declarations for React components (not anonymous arrows).
- Avoid inline logical render patterns like `{flag && <X />}`; use ternary
  `flag ? <X /> : null` for clarity (house rule).
- Prefix intentionally unused params / vars with `_` to satisfy no‑unused‑vars.

### 6. Security & Safety

- No use of `eval`, dynamic `Function` – rules enforce but avoid generating.
- Validate external input early; narrow types before use.
- Avoid constructing file system paths from untrusted pieces without
  normalization.

### 7. Logging

- Production code: prefer `console.error`, `console.warn`, `console.info` only.
  No `console.log` unless inside tests or temporary migration scripts (will
  trigger warning).
- Provide actionable context: structured objects not concatenated strings.

### 8. Testing (Vitest)

- ALWAYS use `test()` (rule `vitest/consistent-test-it`). Do not commit `.only`
  or `.skip`—will fail CI (`no-focused-tests`, `no-disabled-tests`).
- Prefer `describe` blocks for related groups; keep each test <30 LOC where
  possible (readability guard, not enforced by rule).
- Use `await` with all async expectations; use `expect.assertions(n)` if the
  path is conditional.
- Use Testing Library queries (`screen.findBy...` for async). No direct DOM
  traversal (avoid `container.querySelector`).
- Avoid testing implementation details (no spying on internal pure helpers—test
  public surface). Snapshot tests only for stable, low‑variance output.
- Coverage source of truth comes from `vitest run --coverage`—ensure new code is
  reachable or justify with comment.

### 9. Test Data & Mocks

- Prefer real values over broad mocks; keep mocks minimal & reset with
  `vi.resetAllMocks()` in `beforeEach` if spying.
- Use inline factory helpers for repeated objects instead of global mutable
  fixtures.

### 10. Error Handling

- Return typed `Result` objects or throw errors—do not mix patterns in same
  function. For new API surface, prefer exceptions for truly exceptional states;
  otherwise return `{ ok: false, error }` with discriminant.
- Always include original cause: `new SomeError('message', { cause: err })`.

### 11. File & Package Hygiene

- Never edit generated outputs: `dist*`, coverage, or lock files outside normal
  tooling commands.
- If adding a package: update root `workspaces`, add TS project ref, and ensure
  build task outputs to `dist` / `dist-node` / `dist-types` pattern.

### 12. Performance Considerations

- Avoid unnecessary object spread in tight loops; preallocate arrays where size
  known. Use pure functions in utilities (no side effects, no date/time I/O).
- Early return over deeply nested conditionals.

### 13. React / JSX (when present)

- Named function components with explicit prop interfaces.
- Derive minimal state; compute derived values inline.
- No side effects in render path; hooks at top level only.

### 14. Prompt / Spec Alignment

- If a spec contradicts a rule, add a brief `// deviation: reason` comment and
  keep deviation localized.
- Summarize multi-file changes before applying large edits.

### 15. Example (Good)

```typescript
// utilities/src/math-utils.ts
export interface SumOptions {
  clampMin?: number
  clampMax?: number
}

export function safeSum(
  a: number,
  b: number,
  options: SumOptions = {},
): number {
  const total = a + b
  const { clampMin, clampMax } = options
  if (clampMin !== undefined && total < clampMin) return clampMin
  if (clampMax !== undefined && total > clampMax) return clampMax
  return total
}

// tests/math-utils.test.ts
import { safeSum } from '@bun-template/utilities'

test('clamps above max', () => {
  expect(safeSum(5, 10, { clampMax: 12 })).toBe(12)
})
```

### 16. Common Agent Pitfalls (DO NOT)

- Generating code with implicit `any` from missing generics.
- Adding `!` to satisfy type errors instead of refining.
- Using deep relative paths between packages.
- Leaving floating promises in fire‑and‑forget utilities.
- Writing tests with `.only` or forgetting `await` before async calls.
- Creating large multi‑purpose functions to "save files"—prefer small focused
  ones.

If unsure: produce a minimal diff and request clarification instead of guessing.
