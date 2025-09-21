# Copilot instructions for this repo

Short version: pnpm + Turborepo monorepo with a shared tsup build, unified
Vitest workspace, and an internal fix‑first quality pipeline. Default to fast
feedback and consistent patterns.

## Mental model and layout

- Monorepo (pnpm workspaces): `apps/*`, `packages/*` (see
  `pnpm-workspace.yaml`).
- Key packages: `packages/utils`, `packages/quality-check` (fix‑first quality
  pipeline), `packages/testkit` (shared test setup), `packages/voice-vault`.
- App: `apps/vite` (React + Vite). Example package scripts follow a 4‑command
  pattern: `build`, `test`, `lint`, `typecheck`.
- Build orchestration: Turborepo (`turbo.json`). `build` depends on `^build`;
  `test` depends on `^build`. Cache outputs: `dist/**`, `dist-types/**`,
  `dist-node/**`.

## Day‑to‑day workflows (pnpm)

- Build everything: `pnpm build` • Dev all: `pnpm dev` • Clean: `pnpm clean`
- Test once: `pnpm test` • Watch: `pnpm test:watch` • Coverage:
  `pnpm test:coverage`
- Fast/targeted tests: `pnpm test:quick` (threads), `pnpm test:focused` (changed
  files)
- Lint/typecheck/validate: `pnpm lint`, `pnpm typecheck`, `pnpm validate`
- Per‑package tests: `pnpm --filter @template/utils test` (see
  `.vscode/tasks.json` for presets)
- Useful envs (see README): `VITEST_SILENT=true` to reduce noise;
  `MEMORY_DEBUG=true` to print memory; CI auto‑tunes timeouts.

## Testing and TDD

- Single source of truth: `vitest.workspace.ts` configures all projects (root,
  testkit, utils, quality‑check). Shared setup lives in
  `packages/testkit/src/setup.ts` (+ optional `register.ts`).
- Environments: Node by default; `packages/testkit` uses `happy-dom`. Timeouts
  and thread pools adapt to CI and Wallaby via env detection.
- Wallaby: `wallaby.cjs` auto‑detects Vitest, runs on save, and excludes
  slow/perf/integration tests. Detect with `WALLABY_WORKER`. Prefer Wallaby for
  tight inner loop.

## Builds and TypeScript

- Packages share a tsup base: `tooling/build/tsup.base.ts` (see each
  `packages/*/tsup.config.ts`). Keep builds minimal and consistent.
- TypeScript: strict top‑level `tsconfig.json` with `moduleResolution: node16`,
  `checkJs: true`, `paths` like `@/*`. Emit d.ts + sourcemaps by default.

## Code quality and hooks

- ESLint: single root config `eslint.config.mjs` (React rules for apps,
  monorepo/turbo rules, reduced noise warnings). Prettier via
  `pnpm format`/`format:check`.
- Quality pipeline: `packages/quality-check` provides a CLI (bin:
  `quality-check`) that auto‑fixes first then reports. Examples:
  - `npx quality-check --staged` • `npx quality-check --file src/foo.ts --fix`
- Hooks: Husky is enabled (`prepare: husky`) and commonly runs quality‑check on
  staged files (see CLAUDE.md for flow). Use conventional commits.

## Releases

- Changesets flow (see `.changeset/README.md`): `pnpm changeset` → push →
  “Version Packages” PR → merge → `pnpm release` publishes (after `pnpm build`).

## Conventions to follow here

- Keep to the 4‑command package script pattern and tsup build shape.
- Put tests in `src/**/*.test.ts(x)` or `tests/**`. Use RTL + `screen` in React
  code. Favor realistic user flows; avoid flaky timing (use `waitFor`).
- Use `pnpm` for all tasks (no npm/yarn). Respect Turborepo task deps; don’t
  bypass `^build` when adding tests.
- For monorepo‑wide changes, update `vitest.workspace.ts`, not per‑package
  configs.

If anything above is unclear (e.g., quality‑check CLI expectations, Wallaby
usage, or package script patterns), tell me what you’re changing and I’ll
tighten this guidance.
