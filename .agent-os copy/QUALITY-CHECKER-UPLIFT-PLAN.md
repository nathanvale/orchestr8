# Quality Checker Uplift Plan (YAGNI, Turborepo-friendly)

**Owner:** Nathan • **Date:** 2025-09-06 • **Scope:** Replace shell-based checks
with fast, file-scoped engines, leverage TS 5.7+ incremental cache, keep config
surface tiny.

---

## 0) Objectives

- ⚡ **Speed**: sub-300ms re-runs for unchanged files; no cold `npx` overhead.
- 🎯 **File-Scoped TS**: check exactly the files passed (and their imports via
  the compiler) — not the entire project.
- 🧰 **YAGNI**: no project references orchestration, no solution builder, no
  background daemons.
- 🧪 **Deterministic CI**: JSON reporter + non-zero exit when issues present.
- 🔎 **Observability**: per-check timings, cache dir, and counts logged via
  `@orchestr8/logger`.

---

## 1) Risks / Current Issues

- `execSync('npx ...')` introduces **process startup overhead**, version
  ambiguity, and noisy stderr parsing.
- `tsc --noEmit` at project root is **project-wide** and **non-incremental** in
  this flow.
- ESLint output parsing via CLI JSON is brittle; better to use the **ESLint Node
  API**.
- Lack of **stable cache directory** for TS compile metadata.
- Mixed relative vs absolute file comparisons can drop diagnostics.
- Prettier uses CLI; Node API is available (you partly use it in other project).

---

## 2) Target Architecture (minimal)

- **ESLint**: Node API (`new ESLint()`), format with `stylish` or `json` based
  on options. Optional `--fix` via API.
- **Prettier**: Node API (`check`/`format`), respect repo config with
  `resolveConfig`.
- **TypeScript**: `createIncrementalProgram` with `incremental: true`,
  `noEmit: true`, `tsBuildInfoFile: <cacheDir>/qc.tsbuildinfo`. Root = **target
  files** only. Diagnostics **filtered to target files** (normalize with
  `path.resolve`).

**Cache directory**: default `os.tmpdir()/quality-check-ts-cache`; override with
`QC_TS_CACHE_DIR` or option.

---

## 3) Migration Plan (3 phases)

### Phase 1 — Drop-in perf wins

1. Add a small helper `src/checkers/typescript-file-scope-yagni.ts` (below).
2. Replace `runTypeScript()` with file-scoped incremental version.
3. Replace ESLint shell call with ESLint Node API (keeps stylish output).
4. Keep Prettier as-is short-term (CLI) if desired, but prefer Node API for
   consistency.

### Phase 2 — Config & DX

1. Add options:
   - `typescript: { cacheDir?: string }`
   - `format?: 'stylish' | 'json'` (global output mode)
   - `maxWarnings?: number`
2. Add `--staged` / `--since <ref>` at the CLI layer (use existing
   `GitIntegration`).

### Phase 3 — CI & Bench

1. Add JSON reporter (aggregate per-checker issues).
2. Write a tiny benchmark harness printing warm vs cold times.
3. Add CI job using `--since origin/main` for PRs.

---

## 4) Code — TypeScript (file-scoped, incremental)

Create **`src/checkers/typescript-file-scope-yagni.ts`**:

```ts
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import ts from 'typescript'

export interface TSCheckOptions {
  project?: string // tsconfig path or dir
  cacheDir?: string // default: OS tmpdir
}

export interface TSIssue {
  filePath?: string
  line: number
  column: number
  message: string
  code: string // e.g., TS2307
  severity: 'error' | 'warning'
}

export async function checkFile(targetFile: string, opts: TSCheckOptions = {}) {
  const cwd = process.cwd()
  const cacheDir =
    opts.cacheDir ?? path.join(os.tmpdir(), 'quality-check-ts-cache')
  fs.mkdirSync(cacheDir, { recursive: true })

  // Allow loaders that honor this to reuse compiled output
  process.env.NODE_COMPILE_CACHE = cacheDir

  const tsconfigPath = resolveTsconfig(opts.project, cwd)
  const parsed = loadTsConfig(tsconfigPath)

  const options: ts.CompilerOptions = {
    ...parsed.options,
    noEmit: true,
    incremental: true,
    tsBuildInfoFile: path.join(cacheDir, 'qc.tsbuildinfo'),
    skipLibCheck: parsed.options.skipLibCheck ?? true,
    strict: parsed.options.strict ?? true,
  }

  const host = ts.createIncrementalCompilerHost(options)
  const program = ts.createIncrementalProgram({
    rootNames: [path.resolve(targetFile)],
    options,
    host,
  })

  const issues = collectIssues(program, path.resolve(targetFile))
  const success = issues.every((i) => i.severity !== 'error')
  return { success, issues }
}

function collectIssues(
  program: ts.EmitAndSemanticDiagnosticsBuilderProgram,
  targetAbs: string,
): TSIssue[] {
  const mk = (
    ds: readonly ts.Diagnostic[],
    severity: 'error' | 'warning',
  ): TSIssue[] =>
    ds.map((d) => {
      const message = ts.flattenDiagnosticMessageText(d.messageText, '\n')
      const code = `TS${d.code ?? ''}`
      if (!d.file)
        return {
          filePath: undefined,
          line: 1,
          column: 1,
          message,
          code,
          severity,
        }
      const { line, character } = d.file.getLineAndCharacterOfPosition(
        d.start ?? 0,
      )
      return {
        filePath: path.resolve(d.file.fileName),
        line: line + 1,
        column: character + 1,
        message,
        code,
        severity,
      }
    })

  const syntactic = mk(program.getSyntacticDiagnostics(), 'error')
  const semantic = mk(program.getSemanticDiagnostics(), 'error')
  const optionDiags = mk(program.getOptionsDiagnostics(), 'warning')

  return [...syntactic, ...semantic, ...optionDiags].filter(
    (i) => !i.filePath || i.filePath === targetAbs,
  )
}

function resolveTsconfig(specified: string | undefined, cwd: string) {
  if (specified) {
    const p = path.resolve(cwd, specified)
    return fs.existsSync(p) && fs.statSync(p).isDirectory()
      ? path.join(p, 'tsconfig.json')
      : p
  }
  let dir = cwd
  while (dir !== path.dirname(dir)) {
    const p = path.join(dir, 'tsconfig.json')
    if (fs.existsSync(p)) return p
    dir = path.dirname(dir)
  }
  return path.join(cwd, 'tsconfig.json')
}

function loadTsConfig(tsconfigPath: string) {
  const conf = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
  if (conf.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(conf.error.messageText, '\n'),
    )
  return ts.parseJsonConfigFileContent(
    conf.config,
    ts.sys,
    path.dirname(tsconfigPath),
    {},
    tsconfigPath,
  )
}
```

Patch **`runTypeScript`** in your class:

```ts
private async runTypeScript(files: string[]): Promise<CheckerResult> {
  if (files.length === 0) return { success: true, fixable: false };
  const start = performance.now();
  try {
    // only check each file individually (YAGNI)
    const { checkFile } = await import('../checkers/typescript-file-scope-yagni.js');
    const cacheDir = process.env.QC_TS_CACHE_DIR;
    const errors: string[] = [];

    for (const f of files) {
      if (!/\.(ts|tsx)$/.test(f)) continue;
      const { success, issues } = await checkFile(f, { cacheDir });
      for (const i of issues) {
        errors.push(`${i.filePath ?? '<config>'}:${i.line}:${i.column} - ${i.message} (${i.code})`);
      }
    }

    return {
      success: errors.length === 0,
      errors: errors.length ? errors : undefined,
      fixable: false,
      duration: Math.round(performance.now() - start),
    };
  } catch (e) {
    return {
      success: false,
      errors: [`TypeScript check failed: ${e instanceof Error ? e.message : String(e)}`],
      fixable: false,
      duration: Math.round(performance.now() - start),
    };
  }
}
```

---

## 5) Code — ESLint (Node API, stylish/json)

Replace CLI usage with API:

```ts
private async runESLint(files: string[]): Promise<CheckerResult> {
  const started = performance.now();
  try {
    const ESLintModule = await import('eslint').catch(() => null);
    if (!ESLintModule) {
      return { success: true, errors: [], warnings: ['ESLint not found - skipping'], fixable: true, duration: Math.round(performance.now() - started) };
    }
    const { ESLint } = ESLintModule;
    const eslint = new ESLint({ fix: this.options.fix, cwd: process.cwd() });
    const results = await eslint.lintFiles(files);

    if (this.options.fix) await ESLint.outputFixes(results);

    const formatter = await eslint.loadFormatter(this.options.format === 'json' ? 'json' : 'stylish');
    const output = await formatter.format(results);
    if (output.trim()) console.error(output);

    const errorCount = results.reduce((s, r) => s + r.errorCount, 0);
    const warnCount = results.reduce((s, r) => s + r.warningCount, 0);

    const messages: string[] = [];
    for (const r of results) {
      for (const m of r.messages) {
        messages.push(`${r.filePath}:${m.line}:${m.column} - ${m.message} (${m.ruleId ?? 'eslint'})`);
      }
    }

    return {
      success: errorCount === 0,
      errors: messages.length ? messages : [],
      warnings: [],
      autofixes: this.options.fix ? ['ESLint autofixes applied (if any)'] : [],
      duration: Math.round(performance.now() - started),
      fixable: true,
    };
  } catch (e) {
    return { success: false, errors: [`ESLint error: ${e instanceof Error ? e.message : String(e)}`], warnings: [], autofixes: [], duration: Math.round(performance.now() - started), fixable: true };
  }
}
```

---

## 6) Code — Prettier (Node API)

You already have a Node-API version in another project; replicate here:

```ts
private async runPrettier(files: string[]): Promise<CheckerResult> {
  const started = performance.now();
  try {
    const prettier = await import('prettier').catch(() => null);
    if (!prettier) {
      return { success: true, errors: [], warnings: ['Prettier not found - skipping'], autofixes: [], duration: Math.round(performance.now() - started), fixable: true };
    }

    const errors: string[] = [];
    const autofixes: string[] = [];
    for (const filePath of files) {
      const content = await (await import('node:fs/promises')).readFile(filePath, 'utf8');
      const cfg = await prettier.resolveConfig(filePath);
      const ok = await prettier.check(content, { ...cfg, filepath: filePath });
      if (!ok) {
        if (this.options.fix) {
          const formatted = await prettier.format(content, { ...cfg, filepath: filePath });
          await (await import('node:fs/promises')).writeFile(filePath, formatted, 'utf8');
          autofixes.push(`Prettier formatted: ${filePath}`);
        } else {
          errors.push(`${filePath}: needs formatting`);
        }
      }
    }
    return {
      success: errors.length === 0,
      errors,
      warnings: [],
      autofixes,
      duration: Math.round(performance.now() - started),
      fixable: true,
    };
  } catch (e) {
    return { success: false, errors: [`Prettier error: ${e instanceof Error ? e.message : String(e)}`], warnings: [], autofixes: [], duration: Math.round(performance.now() - started), fixable: true };
  }
}
```

---

## 7) Options / Config

Add minimal options to `QualityCheckOptions`:

```ts
export interface QualityCheckOptions {
  parallel?: boolean
  fix?: boolean
  eslint?: boolean
  prettier?: boolean
  typescript?: boolean
  format?: 'stylish' | 'json'
  typescriptCacheDir?: string // optional
}
```

Wire `typescriptCacheDir` to
`checkFile(..., { cacheDir: this.options.typescriptCacheDir || process.env.QC_TS_CACHE_DIR })`.

---

## 8) CLI & CI guidance

- **Pre-commit**: `qc --staged --format stylish`
- **PR CI**: `qc --since origin/main --format json` → parse JSON, annotate PR
- Turborepo: keep as a **single-task step**; rely on Turbo cache for unchanged
  files (your internal file-scoped cache further accelerates interactive runs).

---

## 9) Bench checklist

1. Cold run: remove `<tmp>/quality-check-ts-cache`, run against 1–3 files.
2. Warm run: repeat the same command; expect **50–80%** time reduction.
3. Vary file sizes (small, medium, large).

Log to `@orchestr8/logger`:

- `{ component: 'ts', durationMs, cacheDir, fileCount, errorCount }`
- `{ component: 'eslint', durationMs, errorCount, warningCount }`
- `{ component: 'prettier', durationMs, formattedCount }`

---

## 10) Done Criteria

- ✅ No `npx` calls in steady state.
- ✅ File-scoped TS checks with incremental cache.
- ✅ ESLint/Prettier via Node APIs.
- ✅ Stylish + JSON outputs.
- ✅ CI job added with JSON parsing.
