# Spec Requirements Document

> Spec: Claude Subagents Integration
> Created: 2025-01-18
> Status: Planning

## Overview

Implement adaptation layers for orchestr8 integration, including HTTP REST API for CI/CD deployment and Claude-specific optimizations. This spec focuses on thin adapters that forward requests to the core MCP server, ensuring parity across all integration surfaces while enabling LLM-specific features like prompt caching and JSON output mode. Claude-specific features live only in the Claude adapter; the MCP server remains vendor-neutral.

**Foundation**: This spec defines adaptation layers that build upon the core MCP server:

- **MCP Server**: @.agent-os/specs/2025-01-18-mcp-integration/ (canonical implementation)
- **Tool Schemas**: Defined in MCP spec, reused by all adapters
- **Normalized Envelope**: Defined in MCP spec, returned by all surfaces (in MCP via ToolResult content; in HTTP as response body)

## User Stories

### Development Agent Orchestration

As a developer using Claude Code, I want to invoke orchestr8 workflows from within Claude subagents, so that I can leverage production-grade resilience patterns and structured execution for complex development tasks.

The workflow involves Claude subagents using orchestr8 tools (via MCP integration) to run workflows with full resilience support. Subagents provide rationale-lite summaries for transparency without exposing internal reasoning, while orchestr8 handles deterministic execution. The integration leverages Claude-specific optimizations like prompt caching and JSON output mode, and ensures parallel tool calls are handled correctly by grouping tool_result blocks in a single user message (per Anthropic guidance).

### Dual Deployment Flexibility

As a platform engineer, I want to deploy the same orchestr8 workflows via both Claude Code (MCP) and CI/CD pipelines (HTTP API), so that I have consistent behavior across interactive and automated environments.

The system provides identical contracts and result envelopes whether invoked through Claude Code or via HTTP API in headless environments. Both surfaces use identical validation schemas and return normalized result envelopes with correlation tracking, ensuring consistent behavior across development and production deployments.

### Collaborative Agent Coordination

As an AI engineer, I want multiple Claude personas to collaborate through shared orchestr8 tool access, so that specialized agents can work together on complex tasks while maintaining execution traceability.

Multiple personas in `.claude/agents/` can share the same orchestr8 tool configuration, using correlation IDs to maintain context across handoffs. The coordinator persona invites specialized agents (TypeScript Pro, React Pro) by name, while orchestr8 provides structured state management through execution tracking. This enables complex multi-agent workflows where each agent focuses on its expertise.

## Spec Scope

1. **HTTP API Adapter** - REST endpoints that forward to MCP server for CI/CD deployment
2. **Claude SDK Integration** - Anthropic SDK adapter with prompt caching and JSON output mode
3. **Claude Agent Templates** - Reusable subagent configurations using the short tool names defined by the MCP server (`run_workflow`, `get_status`, `cancel_workflow`)
4. **Adapter Boundaries** - Clear separation between adapters and orchestration engine
5. **Parity Testing** - Comprehensive tests ensuring identical behavior across surfaces
6. **Cost Optimization** - Prompt caching strategy for 90% token reduction

## Out of Scope

- MCP server implementation (see @.agent-os/specs/2025-01-18-mcp-integration/)
- Tool schemas and validation (defined in MCP spec)
- Normalized envelope definition (defined in MCP spec)
- Orchestration engine logic (handled by @orchestr8/core)
- Visual workflow builders or GUI components
- Direct Claude-to-Claude agent communication
- Custom LLM provider implementations beyond Claude
- Distributed execution across multiple instances
- Authentication beyond bearer tokens (MVP scope)

## Expected Deliverable

1. **HTTP API adapter** exposing REST endpoints that forward to MCP server
2. **Claude agent templates** (`.claude/agents/`) using short tool names (`run_workflow`, `get_status`, `cancel_workflow`)
3. **Anthropic SDK integration** with prompt caching and JSON output mode
4. **Adapter boundaries documentation** defining thin pass-through pattern
5. **Comprehensive parity tests** verifying identical behavior across surfaces
6. **Cost metrics** demonstrating 90% token reduction via caching

## Spec Documentation

- Tasks: @.agent-os/specs/2025-01-18-claude-subagents-integration/tasks.md
- Technical Specification: @.agent-os/specs/2025-01-18-claude-subagents-integration/sub-specs/technical-spec.md
- HTTP API Specification: @.agent-os/specs/2025-01-18-claude-subagents-integration/sub-specs/api-spec.md
- Tests Specification: @.agent-os/specs/2025-01-18-claude-subagents-integration/sub-specs/tests.md
- Prompt Templates: @.agent-os/specs/2025-01-18-claude-subagents-integration/sub-specs/prompt-templates.md
- Subagent Format: @.agent-os/specs/2025-01-18-claude-subagents-integration/sub-specs/subagent-format.md
- **NEW - Adapter Boundaries**: @.agent-os/specs/2025-01-18-claude-subagents-integration/sub-specs/adapter-boundaries.md
- **NEW - Parity Tests**: @.agent-os/specs/2025-01-18-claude-subagents-integration/sub-specs/parity-tests.md
- **NEW - Agent Loop**: @.agent-os/specs/2025-01-18-claude-subagents-integration/sub-specs/agent-loop-spec.md
- **NEW - Streaming**: @.agent-os/specs/2025-01-18-claude-subagents-integration/sub-specs/streaming-spec.md

## Key Technical Requirements

### Agent Loop Controls

Agent loops MUST implement safeguards to prevent runaway execution:

- **Maximum Iterations**: 10-15 iterations per conversation turn
- **Timeout Handling**: 30-second default timeout with configurable overrides
- **Continuation Support**: Handle `pause_turn` responses for multi-step operations
- **State Preservation**: Maintain conversation context across loop iterations

### Parallel Tool Calls

When Claude makes multiple tool_use blocks in a single assistant turn, all corresponding tool_result blocks MUST be grouped in a single subsequent user message to maintain parallel execution semantics as per Anthropic guidelines.

### JSON Output Mode

Structured outputs from subagents MUST use `response_format: { type: 'json_object' }` for deterministic JSON generation, with optional JSON schema constraints for critical flows. Do not rely on model-side validation when using fine-grained tool streaming.

### Streaming Support

Fine-grained tool streaming (`fine-grained-tool-streaming-2025-05-14` beta) requires:

- **Client-side validation**: Server validation disabled in streaming mode
- **Partial JSON assembly**: Handle `input_json_delta` events
- **Error recovery**: Graceful handling of incomplete JSON streams
- **WebSocket/SSE integration**: Real-time progress updates

### Thinking Block Safety

Internal reasoning (thinking blocks) MUST NOT be logged, stored in envelopes, or exposed to users. Only rationale-lite summaries should be included in responses.

### Tool Choice Strategy

Implement deterministic tool selection based on context:

- **`auto`**: Default mode - Claude decides tool usage
- **`any`**: Force tool use when action required
- **`none`**: Prevent tools for information-only queries
- **`specific`**: Force particular tool for deterministic flows

## Dependencies

This specification builds upon and requires:

- **MCP Server**: @.agent-os/specs/2025-01-18-mcp-integration/ - Core MCP server implementation
- **Tool Schemas**: @.agent-os/specs/2025-01-18-mcp-integration/sub-specs/mcp-tools-spec.md - Tool definitions
- **Normalized Envelope**: @.agent-os/specs/2025-01-18-mcp-integration/sub-specs/normalized-envelope.md - Response format
- **Orchestr8 Engine**: @orchestr8/core - Workflow execution engine

## Adapter Architecture Principle

All adapters (HTTP, Claude SDK) are thin pass-through layers that:

1. Validate inputs using shared Zod schemas from MCP spec
2. Forward requests to the orchestr8 engine
3. Return normalized envelopes without modification (no enrichment)
4. Contain NO business logic, resilience, or state management

## Server identity and naming conventions

- Server identity: This is the orchestr8 MCP server. Use a DNS-style serverId
  to avoid collisions across clients, e.g., `io.orchestr8` (or your actual
  domain).
- Tool registration: Register short tool names only on the server:
  `run_workflow`, `get_status`, `cancel_workflow`.
- Host-composed labels: MCP hosts (e.g., Claude) compose display names as
  `mcp__{serverId}__{toolName}`. Example: `mcp__io.orchestr8__run_workflow`.
- Do not hardcode the `mcp__` prefix or composed names in server code, schemas,
  or adapters; it is a client-side convention.
- Agent templates may show the composed label for Claude clarity, but the
  underlying contract remains the short tool names on the server.

### Example (Claude MCP entry)

```json
{
  "mcpServers": {
    "io.orchestr8": {
      "command": "node",
      "args": ["./packages/mcp-server/dist/index.js"],
      "type": "stdio"
    }
  }
}
```
