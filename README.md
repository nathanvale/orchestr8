# Bun + Changesets + Commitizen Template

> A GitHub‑ready template that uses **Bun for dev & build** and **Vitest (not
> Bun test) for testing**, **Commitizen + Conventional Commits** for clean
> history, **Commitlint + Husky** for local enforcement, and **Changesets** for
> versioning and automated release PRs. Comes with **GitHub Actions** for CI &
> publishing with npm provenance.

[![Use this template](https://img.shields.io/badge/Use%20this%20template-2ea44f?style=for-the-badge)](https://github.com/<USER_OR_ORG>/<REPO_NAME>/generate)

---

## 📚 Table of Contents

- [🎯 Why this template](#-why-this-template)
- [✨ Features](#-features)
- [⚡ Quick Start](#-quick-start)
  - [🎯 Top 7 Essential Commands](#-top-7-essential-commands)
  - [🚀 Getting Started](#-getting-started)
- [📁 Project Layout](#-project-layout)
- [📦 Scripts](#-scripts)
- [🤖 GitHub Actions Workflows](#-github-actions-workflows)
- [🚀 Release Flow (Changesets)](#-release-flow-changesets)
- [📝 Commit Flow (Commitizen + Commitlint)](#-commit-flow-commitizen--commitlint)
- [⚡ Best‑practice `.bunfig.toml`](#-bestpractice-bunfigtoml)
- [👍 Pros / Cons / Gotchas](#-pros--cons--gotchas)
- [📦 Publishing to npm (with provenance)](#-publishing-to-npm-with-provenance)
- [🏢 Monorepo Notes](#-monorepo-notes)
- [🔧 Troubleshooting](#-troubleshooting)
- [🔒 Security & Supply Chain tips](#-security--supply-chain-tips)
- [❓ FAQ](#-faq)
- [📄 License](#-license)

---

## 🎯 Why this template

- **Speed**: Bun makes installs, dev, and tests snappy.
- **Consistency**: Commitizen + Conventional Commits + Commitlint keep history
  clean.
- **Safety**: Husky prevents sloppy commits. CI checks enforce everything again.
- **Automation**: Changesets opens a **Version Packages** PR that bumps
  versions, writes changelogs, and (optionally) publishes to npm with
  provenance.
- **Agnostic**: Works for **apps** (keep `private: true`) and for **libraries**
  (flip to `private: false` and add proper exports).

---

## 🏗️ Architectural Intents

> Key decisions that shape this template. Full details in
> [`.agent-os/product/decisions.md`](.agent-os/product/decisions.md)

### Core Principles

- **ADHD-Optimized**: Sub-50ms feedback loops, clear visual indicators, reduced
  cognitive load
- **Enterprise-Ready**: Built-in security scanning, supply chain protection,
  compliance features
- **Bun-First**: Native Bun runtime for 3-5x performance gains over Node.js
  equivalents

### Key Design Decisions

- **Vitest over Bun test**: Richer ecosystem, better mocking APIs, familiar to
  developers
- **Single-threaded test mode**: Mitigates worker termination issues (see
  vitest.config.ts)
- **Relaxed complexity thresholds**: Balanced for real-world code while
  maintaining readability
- **Comprehensive scripts**: 200+ named scripts for every scenario,
  ADHD-friendly organization
- **Security by default**: Trivy scanning, npm provenance, SBOM generation
  built-in

### Configuration Philosophy

- **Inline documentation**: Each config file contains brief "why" comments to
  prevent churn
- **Progressive enhancement**: Start simple, scale to monorepo without rewrites
- **Explicit over implicit**: Clear, verbose configurations over magic defaults

---

## ⚙️ Runtime Requirements

> **⚠️ Bun-only Runtime**: This template is designed specifically for the
> [Bun runtime](https://bun.sh/).
>
> - **Development & Build**: Requires Bun 1.1.38 or higher
> - **Node.js Compatibility**: The built output (`dist-node/`) targets Node.js
>   consumers, but development requires Bun
> - **Installation**: [Install Bun](https://bun.sh/docs/installation) before
>   using this template

If you encounter the error "This project requires the Bun runtime", install Bun
first:

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows
powershell -c "irm bun.sh/install.ps1 | iex"
```

---

## ✨ Features

- **Bun for dev & build, Vitest for testing** (fast feedback, rich matcher &
  mocking APIs).
- **Husky** hooks: `pre-commit` (lint/format/typecheck) & `commit-msg`
  (commitlint).
- **Commitizen** (`git cz`) with **cz-git** prompts.
- **Changesets** with GitHub changelog plugin and a Release workflow.
- **CI** workflow that runs lint, typecheck, and tests on PRs and main.
- **Release** workflow that either opens/updates a **Version Packages** PR or
  publishes on merge.
- **Starter** `package.json` and `src/index.ts` (hello world server) included.
- **`setup.sh`** to replace placeholders and install toolchain in one go.

---

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

### 🚀 Getting Started

```bash
# 1) Download this repo (or "Use this template" in GitHub)
# 2) Run setup (replaces placeholders like YOUR_GH_USER/YOUR_REPO; installs deps)
chmod +x setup.sh
./setup.sh

# 3) Sanity check
bun run dev   # starts hello-world server on :3000
bun run commit   # guided commit (Commitizen)
bun run release  # create a changeset
git push         # CI runs; Release workflow opens/updates Version Packages PR
```

If you want to convert this repo itself into a **GitHub Repository Template**
with the `gh` CLI, see: `.github/` actions already in place; then run:

```bash
# assuming you've created and pushed the repo
gh api --method PATCH "repos/<USER_OR_ORG>/<REPO_NAME>" -f is_template=true
```

---

## 📁 Project Layout

```
.github/workflows/
  ci.yml           # lint/typecheck/tests on PRs & pushes
  release.yml      # Changesets “Version Packages” PR, publish on merge
.husky/
  commit-msg       # commitlint
  pre-commit       # format/lint/typecheck + lint-staged
.changeset/
  config.json      # changesets config (GitHub changelog)
  README.md        # how to use changesets
  initial-setup.md # sample changeset (replace PACKAGE_NAME_HERE)
.czrc              # Commitizen config (cz-git)
commitlint.config.mjs
README.template.md
setup.sh
src/index.ts       # Bun server hello-world
package.json       # starter (Bun-first), private by default
```

---

## 📦 Scripts

> **Quick Access**: Use the
> [Top 7 Essential Commands](#-top-7-essential-commands) for daily
> development.  
> Need more? Explore the complete script collection below.

<details>
<summary><strong>🔍 View All Scripts (100+ commands)</strong></summary>

### Script Categories

| Prefix       | Category    | Description                             |
| ------------ | ----------- | --------------------------------------- |
| `dev:*`      | Development | Local development servers and debugging |
| `build:*`    | Building    | Compilation and bundling tasks          |
| `test:*`     | Testing     | Test execution and coverage             |
| `lint:*`     | Linting     | Code quality checks                     |
| `format:*`   | Formatting  | Code style enforcement                  |
| `security:*` | Security    | Vulnerability scanning and auditing     |
| `perf:*`     | Performance | Benchmarking and profiling              |
| `release:*`  | Releasing   | Version management and publishing       |

### Common Scripts

```jsonc
{
  "scripts": {
    // 🚀 Development
    "dev": "bun --watch src/index.ts",
    "dev:debug": "bun --inspect src/index.ts",
    "dev:hot": "bun --hot src/index.ts",
    "dev:smol": "bun --smol --watch src/index.ts",

    // 🏗️ Building
    "build": "bun build src/index.ts --outdir=dist --target=bun",
    "build:all": "bun run build:node && bun run build:types && bun run build",
    "build:node": "tsc -p tsconfig.build.json --outDir dist-node",
    "build:types": "tsc -p tsconfig.types.json",
    "build:watch": "bun build src/index.ts --outdir=dist --target=bun --watch",
    "build:analyze": "bun build src/index.ts --outdir=dist --target=bun --analyze",

    // 🧪 Testing
    "test": "vitest",
    "test:ci": "vitest run --coverage --reporter=dot --reporter=junit",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch",
    "test:changed": "vitest --changed --run",
    "test:debug": "vitest run --reporter=verbose --no-coverage --run",
    "test:ui": "vitest ui",

    // ✨ Quality
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "lint:check": "eslint . --cache --max-warnings 0",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit -p tsconfig.build.json",
    "typecheck:watch": "tsc --noEmit -p tsconfig.build.json --watch",

    // 🔒 Security
    "security:audit": "bun audit || true",
    "security:fix": "bun audit fix",
    "security:sbom": "bunx @cyclonedx/cdxgen -o sbom.json -t js .",

    // ⚡ Performance
    "perf:build": "hyperfine --warmup 1 'bun run build'",
    "perf:startup": "hyperfine --warmup 3 'bun run src/index.ts'",
    "bundle:size": "bunx size-limit",

    // 🚢 Git & Release
    "commit": "git-cz",
    "release": "bunx changeset",
    "release:publish": "bunx changeset publish",
    "release:version": "bunx changeset version",

    // 🎯 Combined Commands
    "validate": "bun run lint:check && bun run format:check && bun run typecheck && bun run validate:types && bun run test:ci",
    "clean:build": "rm -rf dist dist-node dist-types",
    "prepare": "husky",
  },
}
```

**Pro Tips**:

- Use **`bun run commit`** for the Commitizen wizard
- Use **`bun run test:changed`** for ultra-fast changed-file feedback
- Use **`bun run validate`** before pushing to catch all issues

</details>

---

## 🤖 GitHub Actions Workflows

### CI (`.github/workflows/ci.yml`)

- Triggers on PRs and pushes to `main`.
- Steps: checkout → setup Bun → install with `--frozen-lockfile` → lint →
  typecheck → test.
- A second job runs **commitlint** against PR commits to cover squash merges and
  web UI edits that bypass Husky.

### Release (`.github/workflows/release.yml`)

- Triggers on push to `main`.
- Steps: checkout (full history) → setup Bun → install → (optional build) → run
  **changesets/action**.
- Behavior:
  - If there are **pending changesets**, opens/updates a **“Version Packages”**
    PR.
  - When that PR is **merged**, it versions & publishes (if `private: false` &
    `NPM_TOKEN` present).

---

## 🚀 Release Flow (Changesets)

1. Developer runs `bun run release` and selects bumps (patch/minor/major). This
   creates `.changeset/*.md` files.
2. Push → Release workflow finds pending changesets and opens/updates a
   **Version Packages** PR.
3. Merge that PR:
   - `changeset version` updates versions & changelogs.
   - `changeset publish` publishes to npm **if** `private: false` and
     `NPM_TOKEN` is configured (with npm provenance if `id-token: write` +
     `NPM_CONFIG_PROVENANCE=true`).

> The template uses the **`changeset`** binary provided by **`@changesets/cli`**
> (important).

---

## 📝 Commit Flow (Commitizen & Commitlint)

- Run `bun run commit` (or `git cz`) → choose type, scope, subject; Commitizen
  writes a proper Conventional Commit.
- Husky’s `commit-msg` hook runs **commitlint** to enforce the rules locally.
- CI also runs commitlint on PRs to catch commits created via web UI or squash
  merges (they bypass local hooks).

---

## ⚡ Best‑practice `.bunfig.toml`

A sensible default you can drop into the repo root:

```toml
[install]
frozenLockfile = true
exact = true
dedupe = true
saveTextLockfile = true  # commits a human-readable bun.lock alongside bun.lockb

[test]
coverage = true
clearConsole = true
isolate = true

[run]
envFile = ".env"

[experimental]
workspaces = true
```

**Why**: reproducible installs, fewer dupes, consistent test output, and `.env`
loading for `bun run` commands. Keep it minimal and team-friendly.

---

## 👍 Pros / Cons / Gotchas

### ✅ Pros

- **Focused toolchain**: Bun for dev/build + Vitest for testing → fast
  iterations & minimal config drift.
- **Commit hygiene** via Commitizen + commitlint → clean history &
  auto‑generated changelogs read better.
- **Automated release**: Changesets PR → reviewable version bumps & changelog →
  publish on merge.
- **Provenance** optional: add `id-token: write` + `NPM_CONFIG_PROVENANCE=true`
  to get the npm supply‑chain badge.
- **Ready for monorepos**: Changesets works across packages; Bun can link
  workspaces.

### ⚠️ Cons

- **Bun vs Node differences**: some Node‑APM SDKs or native addons may need
  validation; for widely used libs you may add a small Node CI job to
  double‑check.
- **Binary lockfile (`bun.lockb`)**: fast and compact, but less diffable (we
  also commit a text lock using `saveTextLockfile=true`).

### 🧨 Gotchas

- **Wrong CLI package**: The binary is `changeset` (singular) provided by
  `@changesets/cli`. Installing `changesets` (plural) causes “could not
  determine executable” failures.
- **Publishing blocked by `private: true`**: flip to `false` when you're ready
  to publish. The release workflow is disabled by default for private packages.
  To enable automatic releases, uncomment the push trigger in
  `.github/workflows/release.yml`.
- **Commit hooks aren’t absolute**: web UI commits and squash merges bypass
  local Husky; CI commitlint job is essential.
- **Exports for libraries**: if you publish a library, build **Node‑targeted**
  ESM/CJS and set proper `exports`/`types`. Bun‑target output is for Bun
  runtimes only.

---

## 📦 Publishing to npm (with provenance)

1. In `package.json`: set `"private": false`, point `main/types/exports` to your
   built files in `dist/`.
2. Add **Actions secret**: `NPM_TOKEN` (publish rights for your scope).
3. In the Release workflow YAML, keep:
   ```yaml
   permissions:
     contents: write
     id-token: write
   env:
     NPM_CONFIG_PROVENANCE: 'true'
   ```
4. Merge the **Version Packages** PR → publish runs automatically.

> For scoped packages, the **first publish** may require `--access public`. The
> template’s `publishConfig.access=public` takes care of this.

---

## 🏢 Monorepo Notes

- Add `workspaces` to root `package.json`, e.g.:
  ```json
  {
    "workspaces": ["packages/*"]
  }
  ```
- Keep a single `.changeset/config.json` at the root; each changeset file can
  list multiple packages.
- CI can continue to run at the root (Changesets knows which packages changed).

---

## 🔧 Troubleshooting

### “error: could not determine executable to run for package changeset”

- Cause: using `changesets` package instead of **`@changesets/cli`**.
- Fix:
  ```bash
  bun remove changesets || true
  bun add -d @changesets/cli @changesets/changelog-github
  ```

### Release workflow makes a branch `changeset-release/main` then fails

- Usually caused by the same CLI mismatch above or missing devDeps in CI. Ensure
  `bun install --frozen-lockfile` runs and `@changesets/cli` is present.

### Web UI commits bypass commit hooks

- This is expected. The CI job `commitlint` in `ci.yml` checks PR commit
  messages server-side.

### npm publish doesn’t happen

- Check: `private: false`, `NPM_TOKEN` is set, workflow has `id-token: write`,
  and the **Version Packages** PR was merged (not just closed).

### Native addons / APM SDKs

- If you use packages with native bindings (e.g., `sharp`, DB drivers), validate
  under Bun early. If needed, add a Node test matrix in CI to ensure consumer
  compatibility.

---

## 🔒 Security & Supply Chain tips

- Run `bun install --frozen-lockfile` in CI to avoid accidental drift.
- Keep the commitlint job to enforce Conventional Commits end‑to‑end.
- Use npm provenance (`id-token: write` + `NPM_CONFIG_PROVENANCE=true`) for
  tamper‑evident releases.
- Consider a periodic dependency check (`bun outdated`, `bun audit`) as a
  scheduled workflow.

---

## ❓ FAQ

**Q: Can I use this template for an app that will never be published?**  
A: Yes. Keep `"private": true`. You still get clean commits, release notes, and
CI.

**Q: How do I generate changelogs for GitHub releases?**  
A: The template uses `@changesets/changelog-github`, which writes entries into
`CHANGELOG.md` inside the repo when versions are bumped.

**Q: Do I need Node installed if I’m using Bun?**  
A: For most cases no, but if your code must be executed under Node by consumers
(libraries), add a Node job in CI to validate.

**Q: Can I add Playwright for browser E2E?**  
A: Yes. Add `bunx playwright test` (keep unit tests in Vitest). They coexist;
consider a separate `e2e` folder & workflow.

---

## 📄 License

MIT — or choose your own. Add a `LICENSE` file at the repo root.
