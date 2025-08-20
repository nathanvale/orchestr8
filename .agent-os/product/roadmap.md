# Product Roadmap

> Last Updated: 2025-08-20
> Version: 1.1.0
> Status: MVP cut focused on JSON model, Event Bus (Phase 1), CLI v0, and minimal MCP bootstrap

## MVP Scope at a Glance

Do the least to ship a usable MVP that can:

- Define workflows/agents in JSON and validate them
- Run agents/workflows locally via CLI quickly
- Emit execution events on an in-process event bus (Phase 1)
- Optionally start a minimal MCP server to run agents from any MCP client (e.g., Anthropic Cloud, other LLMs)

Non-goals for MVP: REST API, dashboard, OpenTelemetry, distributed execution, provider adapters.

---

## Phase 0: Already Completed

Foundations done:

- [x] TypeScript strict mode and project refs
- [x] pnpm install/build/test verified
- [x] Vitest test setup across packages
- [x] Core orchestration engine (sequential/parallel)
- [x] Basic resilience composition (retry/timeout/circuit breaker order) — adapters may follow post-MVP
- [x] Error taxonomy and optional structured logging

---

## Phase 1: MVP Cut — Engine + JSON + Event Bus + CLI (Target: 1 week)

Goal: Let developers create, test, and run agents and JSON workflows via the CLI with eventing and a minimal journal.

Success Criteria:

- `o8 create:agent` scaffolds a runnable agent and basic test
- `pnpm o8 test` executes tests successfully (or `o8 test` if installed globally)
- `pnpm o8 run ./examples/hello.json` executes successfully
- `pnpm o8 run --agentId github.pr.monitor` can open a PR and report status
- Event bus publishes lifecycle events; consumers can subscribe
- JSON is validated (Zod + JSON Schema doc) and rejected on invalid input
- Minimal journal can be inspected for a run

### Must-Haves

- [ ] JSON Execution Model (minimal)
  - Zod schema for workflow/agent JSON (centralized in `packages/schema`)
  - JSON Schema generation for docs/validation
  - Runtime parsing + friendly errors
- [ ] In-Process Event Bus — Phase 1
  - Bounded queue with overflow policy (drop-latest + warn)
  - Topics: `execution.started`, `step.started`, `step.completed`, `execution.completed`, `execution.failed`
  - Simple publish/subscribe API; in-memory subscribers only
- [ ] Minimal Execution Journal
  - Append-only in-memory ring buffer by `runId`
  - Export on-demand as JSON (printed by CLI `--inspect`)
- [ ] CLI v0 (fast loop)
  - `o8 init` — create minimal config and example
  - `o8 create:agent` — scaffold tiny agent shell (optional template)
  - `o8 run <workflow.json>` — run and stream events
  - `o8 test` — run unit tests (delegate to `vitest`) and show quick status
  - `o8 inspect <runId>` — dump journal for a run
- [ ] Agents package scaffold
  - Create `packages/agents` monorepo package to host built-in agents
  - Wire into `pnpm-workspace.yaml` and TS project references
  - Provide public export surface with stable agent IDs
  - Place MVP agent here (`github.pr.monitor`)
- [ ] Built-in GitHub PR agent (gh CLI)
  - Agent ID: `github.pr.monitor`
  - Location: `packages/agents`
  - Creates a PR (using `gh pr create`) and continuously polls status checks
  - Emits event bus updates per tick; writes to minimal journal
  - Input: baseBranch, headBranch, title, body?, draft?, pollIntervalMs?, timeoutMs?
  - Output: { prNumber, url, status: 'passed' | 'failed' | 'timeout', checks: Array<{ name, status, url? }>}
- [ ] Examples
  - `hello-world` + `fanout-aggregate` using the JSON model
  - `github-pr-monitor` demonstrating PR creation and check polling
- [ ] Tests (Vitest)
  - Schema happy/invalid paths
  - Event bus bounded queue + topic fan-out
  - CLI `run` happy path (smoke), `inspect` output

### Should-Haves (time-permitting)

- [ ] Journal tail/follow mode in CLI
- [ ] Agent scaffolding templates beyond the minimal shell
- [ ] Retry adapter parity tests

### Out of Scope (deferred)

- REST API, WebSocket server, dashboard, OpenTelemetry
- Persistent journal/datastore; cross-process subscribers

---

## Phase 2: MCP Bootstrap (Target: +1 week)

Goal: Run agents from any MCP-compatible client with a minimal server.

Success Criteria:

- Start a local MCP server and invoke `o8.runWorkflow` with a JSON payload
- Receive basic status/result via MCP response
- Document how to connect from Anthropic Cloud code or any MCP client

### Must-Haves (MCP)

- [ ] Minimal MCP server (stdio) with one command
  - Command: `o8.runWorkflow` accepting normalized envelope + JSON workflow
  - Capability discovery with a minimal manifest
- [ ] Normalized envelope (subset) aligned to spec
  - Reference: [MCP Integration Spec](../specs/2025-01-18-mcp-integration/spec.md)
- [ ] CLI integration
  - `o8 mcp start` — start server
  - Docs: how to point MCP client to the server
- [ ] Tests
  - Contract tests: command availability, payload validation, response shape

### Non-Goals

- Tools/resources sync, streaming deltas, advanced auth
- Multi-tenant isolation, rate limiting, tracing

---

## Phase 3: API & Observability (Post-MVP, optional)

- [ ] REST API: execute, status, journal, cancel
- [ ] WebSocket server for live events
- [ ] Minimal dashboard UI
- [ ] OpenTelemetry (basic spans)
- [ ] Idempotency with TTL

---

## Post-MVP Backlog

- [ ] Provider abstraction + Claude/OpenAI/Ollama adapters
- [ ] Distributed execution
- [ ] AuthN/AuthZ
- [ ] GraphQL API
- [ ] Advanced debugging tools
- [ ] Claude subagents integration (see spec)

### Future Scope (additional ideas)

- [ ] Durable event bus with broker support (Kafka/NATS), backpressure, replayable topics
- [ ] Persistent journal + replay (SQLite/Postgres/S3), retention policies, DLQ handling
- [ ] Scheduling & triggers: cron, webhooks, GitHub webhooks to start workflows/agents
- [ ] Secrets management: Vault/AWS Secrets/GCP Secrets; redaction and scoped mounts per agent
- [ ] Sandbox/isolation: OCI/Firecracker sandboxes with CPU/memory/time quotas and FS policies
- [ ] Remote executors: worker pool with autoscaling, work-stealing, and priority queues
- [ ] Cost/token accounting: per-run cost, budgets, alerts, per-agent/token rate caps
- [ ] Versioned workflow registry: immutable versions, migrations, changelogs, rollback
- [ ] TUI for CLI: interactive event stream, filters, state inspection, cancellations
- [ ] Kubernetes operator: CRDs for workflows, status surfaces, GitOps integration (Argo/Flux)

---

## Timeline (lean)

- Week 1: Phase 1 complete (JSON, Event Bus P1, CLI v0, examples, tests)
- Week 2: Phase 2 MCP bootstrap (single command, envelope subset, docs)

---

## Acceptance Tests (high level)

- JSON Schema: invalid workflow rejected with helpful error path
- Event Bus: publish 1k events with capacity 100 — no crash, overflow warnings
- CLI: `o8 run examples/hello.json` prints started/completed and exit code 0
- Journal: `o8 inspect <runId>` shows steps with timestamps
- MCP: client can call `o8.runWorkflow` and receive result
- MCP (Cloud Code): manual acceptance follows `../specs/2025-01-18-mcp-integration/sub-specs/cloud-code-integration.md` and must pass

---

## Quality Gates (lean)

- All tests passing; coverage ≥60% in core packages (`schema`, `core`)
- Memory stable for typical runs; no unbounded growth
- Lint + typecheck clean

---

## References

- MCP Integration Spec: `../specs/2025-01-18-mcp-integration/spec.md`
- Product Technical Spec: `./technical-spec.md`
