# Anthropic Cloud Code / Claude Code Integration (MVP)

> Last updated: 2025-08-20
> Scope: Minimal MCP bootstrap to trigger orchestr8 agents/workflows from any MCP client (e.g., Claude Code, Anthropic Cloud Code)

## What works in MVP

- Start an orchestr8 MCP stdio server via CLI
- Discover a single tool exposed by the server and invoke it from an MCP client
- Trigger an existing orchestr8 agent or a pre-registered workflow by ID and receive the result

Important constraint (MVP): clients cannot send arbitrary ad-hoc JSON workflows over MCP. Only registered agents/workflows defined inside orchestr8 can be invoked by ID. Ad-hoc JSON over MCP is deferred for post-MVP (behind allowlists and limits).

## Tool contract (MVP)

- Server name: `orchestr8`
- Tool name: `run_work`
- Fully-qualified tool (for allow-lists): `mcp__orchestr8__run_work`

Request shape:

- One of the following selectors must be provided
  - `agentId: string` — run a registered agent
  - `workflowId: string` — run a pre-registered workflow
- Optional input payload passed to the agent/workflow
  - `input: Record<string, unknown>`
- Optional execution options
  - `runId?: string` (if omitted, server generates one)
  - `timeoutMs?: number`

Response shape:

- `runId: string`
- `status: 'completed' | 'failed'`
- `output?: unknown` (present on completed)
- `error?: { code: string; message: string }` (present on failed)

Events are also emitted on the in-process event bus (Phase 1) for local consumers; streaming over MCP is out of scope for MVP.

## Prerequisites

- orchestr8 workspace set up (`pnpm install` passes)
- CLI v0 available (see roadmap) with `o8 mcp start`
- Claude Code or Anthropic Cloud Code with MCP enabled

## Start the orchestr8 MCP server

- Start the stdio server locally:
  - `o8 mcp start` (stdio)
- The server exposes the `run_work` tool and reports capability metadata

## Connect from Claude Code / Cloud Code

Option A — Add via CLI (project scope):

- `claude mcp add orchestr8 -- o8 mcp start`
- Verify: `claude mcp get orchestr8` and `claude mcp list`

Option B — Check in a project `.mcp.json`:

```json
{
  "mcpServers": {
    "orchestr8": {
      "command": "o8",
      "args": ["mcp", "start"],
      "env": {}
    }
  }
}
```

Allow the tool when launching agents from Claude CLI (if running non-interactive mode):

- `--allowedTools "mcp__orchestr8__run_work"`

From Claude Code UI, you can also manage this via the `/mcp` menu.

## Trigger from a sub-agent (example flows)

Claude CLI (non-interactive) example allowing the orchestr8 tool:

- `claude -p "Run the research-agent with topic 'X'" --mcp-config .mcp.json --allowedTools "mcp__orchestr8__run_work"`

Inside the conversation, a Claude sub-agent can call the tool with payload:

```json
{
  "tool": "mcp__orchestr8__run_work",
  "input": {
    "agentId": "research-agent",
    "input": { "topic": "X" }
  }
}
```

To invoke a workflow by ID instead:

```json
{
  "tool": "mcp__orchestr8__run_work",
  "input": {
    "workflowId": "fanout-aggregate",
    "input": { "query": "Y" }
  }
}
```

The tool returns `{ runId, status, output? }`. You can later inspect the run locally via `o8 inspect <runId>`.

## Security and guardrails

- No ad-hoc JSON workflows over MCP in MVP
- Only agent/workflow IDs recognized by orchestr8 are allowed
- Server enforces a minimal payload size limit and optional timeout
- Event bus remains in-process; no external subscribers in MVP

## Future (post-MVP)

- Optional support for ad-hoc JSON workflows via MCP behind an allowlist and size limits
- Streaming event forwarding over MCP
- Multi-tenant isolation and auth
- Rich capability discovery and multiple tools (e.g., `list_agents`, `get_run_status`)

## References

- Roadmap: `../../../../product/roadmap.md`
- MCP Integration Spec: `../spec.md`
- Normalized Envelope: `./normalized-envelope.md` (post-MVP when enabling JSON workflows)

## MVP test plan (acceptance)

The following acceptance tests must pass for MVP sign-off. These map to automated tests in the MCP server package and a short manual verification via Claude Code/Cloud Code.

Automated (Vitest, jsdom not required):

- Tool discovery exposes a single `run_work` tool with schema
- Invocation by `agentId` returns `{ runId, status, output? }`
- Invocation by `workflowId` returns `{ runId, status, output? }`
- Rejection of ad-hoc JSON workflow payloads over MCP (enforced by schema)
- Rejection of unknown `agentId`/`workflowId`
- Enforcement of `timeoutMs` bounds and payload size limit
- Event bus emits local events for the run (no MCP streaming)

Manual (Claude CLI or Claude Code UI):

1. Start server: `o8 mcp start`
2. Register MCP server via CLI (`claude mcp add orchestr8 -- o8 mcp start`) or add project `.mcp.json` with the orchestr8 command
3. Allow the tool: `--allowedTools "mcp__orchestr8__run_work"`
4. From Claude, call the tool to run a known agent: `{ "tool": "mcp__orchestr8__run_work", "input": { "agentId": "hello-world", "input": { "name": "Ada" } } }`
5. Observe a response with `status: "completed"` and a `runId`
6. Locally verify journal: `o8 inspect <runId>` shows the same output

Traceability: automated counterparts live under `packages/mcp-server/__tests__/acceptance/cloud-code.test.ts` and protocol compliance under `packages/mcp-server/__tests__/integration/protocol.test.ts`.
