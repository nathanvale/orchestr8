# Examples

## PR auto-fix (gh CLI)

A minimal orchestr8 workflow that:

- Applies a patch (code.gen)
- Runs tests/CI (shell.exec)
- Opens a PR with GitHub CLI (github.pr)

Resilience:

- patch: retry (3x exponential, full-jitter)
- tests: timeout (15m)
- pr.open: circuit breaker (3/5, 60s recovery)

Inputs (variables):

- repo: path to local git repo (default: cwd)
- branch: feature branch name (default: `auto-fix/YYYY-MM-DD`)
- plan: textual change plan
- analysisSummary: optional summary text
- base: base branch (default: main)
- testCommand: command to run tests (default: `pnpm -s check`)
- dryRun: 'true'|'false' (default: 'true')

Env:

- GITHUB_TOKEN: optional if not already authenticated with `gh`

Run:

```bash
# from repo root
pnpm tsx scripts/examples/pr-auto-fix-gh.ts

# customize
REPO=$(pwd) \
BRANCH=auto-fix/demo \
PLAN='Update deps and fix lint' \
SUMMARY='Automated fix' \
BASE=main \
TEST_CMD='pnpm -s check' \
DRY_RUN=false \
GITHUB_TOKEN=ghp_xxx \
pnpm tsx scripts/examples/pr-auto-fix-gh.ts
```

Output: prints `PR URL: https://github.com/owner/repo/pull/123` on success.

Notes:

- Requires `git` and `gh` installed and authenticated (`gh auth login`) or `GITHUB_TOKEN` set.
- The example writes `.autofix/plan.md`, commits, and pushes when `DRY_RUN=false`.
- Safe defaults use dry-run to avoid side effects.

## PR lifecycle (gh CLI)

End-to-end flow: open PR → wait for checks → policy gate → label → merge or comment → notify.

Inputs (variables):

- repo: repo path (default: cwd)
- base: base branch (default: main)
- branch: feature branch (default: auto-pr/YYYY-MM-DD)
- title/body: PR metadata
- requiredContexts: comma-separated contexts (env: REQUIRED_CONTEXTS)
- minApprovals: required reviewer approvals (default: 1)
- maxChangedFiles: upper bound for change size (default: 200)
- mergeMethod: merge|squash|rebase (default: squash)
- dryRun: 'true'|'false' (default: 'true')

Env:

- GITHUB_TOKEN (if `gh` isn’t already authed)

Run:

```bash
# from repo root
pnpm tsx scripts/examples/pr-lifecycle-gh.ts

# customize
REPO=$(pwd) \
BASE=main \
BRANCH=auto-pr/demo \
TITLE='Automated PR' \
BODY='Demo change' \
REQUIRED_CONTEXTS='build,tests' \
MIN_APPROVALS=1 \
MAX_CHANGED_FILES=200 \
MERGE_METHOD=squash \
DRY_RUN=false \
GITHUB_TOKEN=ghp_xxx \
pnpm tsx scripts/examples/pr-lifecycle-gh.ts
```

Notes:

- Uses `gh pr view --json` to evaluate statuses, reviews, and files.
- Gate computes reasons and posts a comment if not passing; otherwise merges.
- Labels PR with `automerge-ready` or `needs-attention`.

## Multi-LLM fan-out + Grok aggregation

Call OpenAI, Anthropic (Claude), and a local OpenAI-compatible endpoint concurrently, then ask Grok to synthesize the final answer from all three.

Env:

- OPENAI_API_KEY
- ANTHROPIC_API_KEY
- XAI_API_KEY (for Grok)
- LOCAL_OPENAI_BASE_URL (e.g., <http://localhost:1234/v1>)
- LOCAL_OPENAI_API_KEY (optional)

Inputs (variables):

- prompt: user prompt
- openaiModel (default gpt-4o-mini)
- claudeModel (default claude-3-5-sonnet-20241022)
- localModel (default local-model)
- grokModel (default grok-beta)
- temperature (default 0.2)

Run:

```bash
PROMPT='Summarize pros/cons of Postgres vs MySQL' \
OPENAI_API_KEY=sk-... \
ANTHROPIC_API_KEY=sk-ant-... \
XAI_API_KEY=sk-xai-... \
LOCAL_OPENAI_BASE_URL=http://localhost:1234/v1 \
pnpm tsx scripts/examples/multi-llm-fanout-aggregate.ts
```

Notes:

- Local endpoint should be OpenAI-compatible (LM Studio, Ollama proxy, etc.).
- Aggregation asks Grok to return strict JSON and we print `final`.

## Convex data seed/init

A simple orchestr8 workflow to seed data via Convex actions, verify counts, and notify.

Steps:

- seed: runs your seed script (idempotent) with retries
- verify: runs a script that must print JSON like `{ ok: true, counts: { users: 10 } }`
- notify: prints a summary message (or failure details)

Resilience:

- seed: retry (3x exponential, full-jitter)
- verify: timeout (10m)

Inputs (variables):

- repo: path to project (default: cwd)
- seedScript: path to seed script (default: `scripts/seed.ts`)
- seedArgs: optional args
- verifyScript: path to verify script (default: `scripts/verify.ts`)
- verifyArgs: optional args

Env (whitelisted and forwarded):

- CONVEX_DEPLOY_KEY, CONVEX_URL, CONVEX_DEPLOYMENT, CONVEX_ADMIN_KEY

Run:

```bash
# from repo root
pnpm tsx scripts/examples/convex-seed-init.ts

# customize
REPO=$(pwd) \
SEED_SCRIPT=scripts/seed.ts \
SEED_ARGS='--force' \
VERIFY_SCRIPT=scripts/verify.ts \
VERIFY_ARGS='' \
CONVEX_URL=https://example.convex.cloud \
CONVEX_DEPLOYMENT=dev:my-deployment \
CONVEX_DEPLOY_KEY=convex_xxx \
CONVEX_ADMIN_KEY=convex_admin_xxx \
pnpm tsx scripts/examples/convex-seed-init.ts
```

Notes:

- Your seed and verify scripts should be runnable via `pnpm tsx <file>` and handle Convex auth.
- The verify step must exit with code 0 and print JSON; set `ok: false` to trigger the failure notifier.
