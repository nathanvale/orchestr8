# Contributing (Ultra‑Short Version)

Focus rules: keep it fast, simple, and consistent. This template is tuned for an
ADHD‑friendly flow.

## Core Commands

| Task                                      | Command                |
| ----------------------------------------- | ---------------------- |
| Install deps                              | `bun install`          |
| Dev server                                | `bun run dev`          |
| Run tests (watch)                         | `bun run test:watch`   |
| Fast changed tests                        | `bun run test:changed` |
| Lint + format + types + tests (CI parity) | `bun run validate`     |
| Create a changeset                        | `bun run release`      |
| Interactive commit (Commitizen)           | `bun run commit`       |
| Build (Bun target)                        | `bun run build`        |
| Build (Node target)                       | `bun run build:node`   |
| Build both                                | `bun run build:all`    |

## Branch / Commit Hygiene

1. Branch from `main` (feature/short-slug).
2. Use `bun run commit` for Conventional Commit prompts.
3. One logical change per commit; small commits welcome.

## Adding Features

1. Add code + tests.
2. Run `bun run validate` (fix issues).
3. Add a changeset: `bun run release` (choose version bump type).
4. Push & open PR; CI must be green.

## Tests

- Prefer `test:changed` while iterating, `test:ci` before pushing.
- Use `tests/utils/test-utils.tsx` helpers; avoid duplicating setup.
- Add MSW handlers in test scope via `server.use(...)`.

## Coverage

Thresholds: 80% global (branches/functions/lines/statements). Raise per-file
thresholds only when stable.

## Releasing

- Merge the automated "Version Packages" PR when ready.
- For publishing (future): set `private:false` + `NPM_TOKEN`.

## Performance Profiling (Optional)

- Build timing: `bun run perf:build`
- Startup timing: `bun run perf:startup`

## Style & Lint

- ESLint enforces complexity & function length—refactor early.
- Prefer pure functions; limit side effects to entrypoints.

## When Unsure

Keep it boring. Add a TODO with a short rationale—future you can revisit.

---

Happy hacking! Keep feedback loops tight and distractions low.
