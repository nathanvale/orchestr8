# Quality Checker — Product Specification (TypeScript + ESLint v9 Flat Config + Prettier)
**Version:** 1.0 • **Owner:** Nathan • **Date:** 2025-09-06  
**Project:** Quality Checker uplift (YAGNI, Turbo-friendly)

---

## 1) Summary
Quality Checker provides fast, file-scoped validation using:
- **TypeScript 5.7+** file-scoped incremental type checks (no project-wide `tsc`).
- **ESLint v9 (flat config)** via the Node API with cache + optional autofix.
- **Prettier** via the Node API with `resolveConfig()` + `getFileInfo()` ignores.

Designed for **sub-300ms warm feedback** and **simple integration** in Turborepo.

---

## 2) Goals
- ⚡ **Speed-first**: incremental caching for TS; programmatic ESLint/Prettier (no `npx`).
- 🧭 **File scope**: validate the files passed in (and their imports evaluated by TS).
- 🧰 **YAGNI**: no project references orchestration; no solution builders.
- 🧪 **Deterministic CI**: JSON mode + exit codes for gating.
- 🔎 **Observability**: structured logs and counters (per tool + aggregate).

## 3) Non-Goals
- Managing multi-project TS references/solution builds.
- Replacing ESLint/Prettier ecosystems (we orchestrate, not reinvent).
- IDE/editor plugin development.

## 4) Users & Key Scenarios
- **Local dev**: `qc src/foo.ts` → stylish output; `--fix` to apply ESLint/Prettier fixes.
- **Pre-commit**: `qc --staged` → very fast checks on staged files only.
- **CI (PR)**: `qc --since origin/main --format json` → machine-readable for annotations.

## 5) Functional Requirements
- Run **TS**, **ESLint**, **Prettier** for provided files.
- Options:
  - `--staged`, `--since <ref>`
  - `--fix` (ESLint/Prettier only)
  - `--format stylish|json` (default: stylish)
  - `--typescript-cache-dir <path>` or env `QC_TS_CACHE_DIR`
- Respect `.gitignore` and Prettier ignore behavior.
- Exit codes: `0=ok`, `1=issues`, `2=internal error`.

## 6) Non-Functional Requirements
- **Performance**: cold < 2s for a handful of files; warm < 300ms typical.
- **Reliability**: degrade gracefully if a tool is missing (skip with warning).
- **Security**: never log API keys; redact secrets; optional path redaction mode.
- **Compatibility**: Node 18+; Turborepo friendly; Bun/Node shells OK.

## 7) Output & Reporting
Two output modes:
- **Stylish** (human): ESLint “stylish”-like with `path:line:col - message (rule)`.
- **JSON** (CI): aggregated result with per-issue objects: `{tool,file,line,col,code,severity,message}`.

## 8) Success Metrics
- Median warm TS check ≤ 300ms.
- CI flake rate < 1% over 100 runs.
- No increase in false negatives on representative fixture repos.

## 9) Constraints & Assumptions
- Single-root `tsconfig.json` hierarchy; project references not required.
- ESLint v9 (flat config) is adopted in repo root.
- Prettier config lives in repo; `.prettierignore` is respected.

## 10) Release Plan
- **v1.0**: TS file-scoped incremental + ESLint/Prettier Node APIs + stylish/json.
- **v1.1**: `--since`/`--staged` discovery utilities & CI examples.
- **v1.2**: Optional include-imports mode for TS; perf telemetry command.

## 11) Open Questions
- Treat TS suggestion diagnostics as warnings by default?
- Offer `--include-imports` to surface direct-import errors too (default off)?
