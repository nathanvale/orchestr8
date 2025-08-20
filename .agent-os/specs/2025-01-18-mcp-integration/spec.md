# Spec Requirements Document

> Spec: MCP Integration for @orchestr8
> Created: 2025-01-18
> Status: Planning

## Overview

Implement a vendor-neutral Model Context Protocol (MCP) server for @orchestr8, enabling AI assistants to execute and monitor orchestrated workflows through a standardized protocol. This integration provides schema-driven, type-safe access to orchestr8's resilience patterns and execution capabilities via MCP tools and resources.

**Integration Surfaces:** This MCP server is vendor-neutral and serves as the foundation for multiple integration patterns:

- Direct MCP integration via stdio transport (primary)
- Optional Streamable HTTP transport (for hosted scenarios)
- Thin HTTP/Claude adapters (see @.agent-os/specs/2025-01-18-claude-subagents-integration/) that reuse the same contracts

## User Stories

### AI Developer Story

As an AI developer using Claude Code, I want to execute @orchestr8 workflows through MCP tools, so that I can leverage production-grade orchestration without leaving my AI development environment.

**Workflow:**

1. Configure MCP server in Claude settings
2. Invoke orchestr8 tools via natural language
3. Execute workflows with automatic resilience
4. Monitor execution progress with long-polling
5. Receive structured results in normalized format

### Platform Engineer Story

As a platform engineer, I want to expose our orchestr8 workflows via MCP, so that AI assistants can safely execute approved workflows with proper observability.

**Workflow:**

1. Deploy MCP server alongside orchestr8
2. Configure allowed workflows and limits
3. Monitor tool usage via correlation IDs
4. Track costs and resource consumption
5. Audit all AI-initiated executions

### DevOps Engineer Story

As a DevOps engineer, I want standardized protocol access to orchestr8, so that I can integrate workflow execution into various AI-powered tools and automation.

**Workflow:**

1. Start MCP server locally or in container
2. Connect via stdio or HTTP transport
3. Execute workflows programmatically
4. Handle errors with JSON-RPC standards
5. Correlate executions across systems

## Spec Scope

1. **MCP Server Implementation** - TypeScript-based server using official MCP SDK
2. **Core Tool Definitions** - run_workflow, get_status, cancel_workflow with Zod input schemas; outputs are normalized envelopes returned via MCP ToolResult content
3. **Resource Providers** - Workflow definitions (workflow://) and execution journals (execution://)
4. **Capabilities Declaration** - Tools, resources, logging, and notifications support
5. **Transport Layer** - Primary stdio transport with MCP protocol compliance (no stdout logging)
6. **Schema Validation** - Zod-based input validation; outputs use a shared normalized envelope
7. **Long-Polling Support** - Efficient status monitoring via waitForMs parameter with bounded backoff
8. **JSON-RPC Compliance** - Reserve JSON-RPC errors for protocol faults only; tool failures return ToolResult with envelope and isError=true

## Out of Scope

- HTTP REST API endpoints (handled by adaptation layer)
- LLM-specific optimizations (prompt caching, JSON output mode)
- Visual workflow builder integration
- Custom LLM model hosting
- MCP client implementation
- Workflow modification via MCP
- Direct database access
- Authentication/authorization (defer to Phase 5)

## Expected Deliverable

1. Working MCP server exposing orchestr8 tools with Zod input schemas and normalized envelope outputs
2. Validated against MCP specification 2025-06-18
3. stdio transport for local AI assistant integration
4. Resource providers for workflow definitions and execution journals
5. Capabilities declaration with proper notifications support
6. Comprehensive test coverage (>80%)
7. Documentation aligned with MCP best practices

## Spec Documentation

- Tasks: @.agent-os/specs/2025-01-18-mcp-integration/tasks.md
- Technical Specification: @.agent-os/specs/2025-01-18-mcp-integration/sub-specs/technical-spec.md
- **MCP Tools Specification**: @.agent-os/specs/2025-01-18-mcp-integration/sub-specs/mcp-tools-spec.md
- Tests Specification: @.agent-os/specs/2025-01-18-mcp-integration/sub-specs/tests.md
- **Normalized Result Envelope**: @.agent-os/specs/2025-01-18-mcp-integration/sub-specs/normalized-envelope.md
- **Claude/Cloud Code Integration (MVP)**: @.agent-os/specs/2025-01-18-mcp-integration/sub-specs/cloud-code-integration.md

## Related Specifications

- **Claude Subagents Integration**: @.agent-os/specs/2025-01-18-claude-subagents-integration/ - Adaptation layers (HTTP API, Claude SDK) that build on this MCP server foundation

## Adapter Interface Contract

This MCP server defines the canonical interface that all adaptation layers must implement:

- Tool schemas and validation (Zod)
- Normalized result envelope format
- Correlation ID propagation
- Error codes and retryability
- Long-polling behavior with bounded backoff
- No stdout logging in stdio transports (stderr-only for server logs)
