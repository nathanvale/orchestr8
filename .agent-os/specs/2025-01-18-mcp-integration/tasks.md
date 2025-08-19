# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-01-18-mcp-integration/spec.md

> Created: 2025-01-18
> Status: Ready for Implementation

## Tasks

- [ ] 1. Setup MCP Server Package
  - [ ] 1.1 Write tests for package initialization
  - [ ] 1.2 Create packages/mcp-server directory structure
  - [ ] 1.3 Configure package.json with MCP SDK dependency
  - [ ] 1.4 Setup TypeScript configuration extending root tsconfig
  - [ ] 1.5 Create index.ts entry point
  - [ ] 1.6 Verify all package setup tests pass

- [ ] 2. Implement Core MCP Server
  - [ ] 2.1 Write tests for server initialization
  - [ ] 2.2 Create Orchestr8MCPServer class
  - [ ] 2.3 Implement server initialization with capabilities
  - [ ] 2.4 Setup stdio transport (primary)
  - [ ] 2.5 Implement correlation tracking Map
  - [ ] 2.6 Add tool naming with mcp**orchestr8** prefix
  - [ ] 2.7 Verify all server core tests pass

- [ ] 3. Define Input Schemas with Zod
  - [ ] 3.1 Write tests for schema validation
  - [ ] 3.2 Create RunWorkflowSchema with all constraints
  - [ ] 3.3 Create GetStatusSchema with validation
  - [ ] 3.4 Create CancelWorkflowSchema
  - [ ] 3.5 Define NormalizedEnvelope interface
  - [ ] 3.6 Verify all schema validation tests pass

- [ ] 4. Implement mcp**orchestr8**run_workflow Tool
  - [ ] 4.1 Write tests for mcp**orchestr8**run_workflow tool
  - [ ] 4.2 Register tool with full MCP naming convention
  - [ ] 4.3 Add input validation with Zod
  - [ ] 4.4 Implement workflow execution via engine
  - [ ] 4.5 Add long-polling support with waitForMs
  - [ ] 4.6 Implement correlation ID generation/tracking
  - [ ] 4.7 Format responses as normalized envelope
  - [ ] 4.8 Verify all run_workflow tests pass

- [ ] 5. Implement get_status Tool
  - [ ] 5.1 Write tests for get_status tool
  - [ ] 5.2 Implement status retrieval from engine
  - [ ] 5.3 Add long-polling for status changes
  - [ ] 5.4 Map execution states to MCP status
  - [ ] 5.5 Include logs and error details in response
  - [ ] 5.6 Verify all get_status tests pass

- [ ] 6. Implement cancel_workflow Tool
  - [ ] 6.1 Write tests for cancel_workflow tool
  - [ ] 6.2 Implement cancellation via engine
  - [ ] 6.3 Handle cancellation reasons
  - [ ] 6.4 Return proper success/error envelopes
  - [ ] 6.5 Verify all cancel_workflow tests pass

- [ ] 7. Implement Resource Providers
  - [ ] 7.1 Write tests for workflow resource provider
  - [ ] 7.2 Implement workflow:// resource handler
  - [ ] 7.3 Write tests for execution resource provider
  - [ ] 7.4 Implement execution:// resource handler
  - [ ] 7.5 Add resource caching with TTL
  - [ ] 7.6 Verify all resource provider tests pass

- [ ] 8. Add Error Handling
  - [ ] 8.1 Write tests for error formatting
  - [ ] 8.2 Implement JSON-RPC error codes
  - [ ] 8.3 Create error mapping from engine errors
  - [ ] 8.4 Add retryable error detection
  - [ ] 8.5 Implement error response formatting
  - [ ] 8.6 Verify all error handling tests pass

- [ ] 9. Create Integration Tests
  - [ ] 9.1 Write MCP protocol compliance tests
  - [ ] 9.2 Create end-to-end workflow execution tests
  - [ ] 9.3 Add parity tests between MCP and HTTP
  - [ ] 9.4 Implement performance benchmark tests
  - [ ] 9.5 Add security validation tests
  - [ ] 9.6 Verify all integration tests pass

- [ ] 10. Add MCP Configuration
  - [ ] 10.1 Create .mcp.json configuration schema
  - [ ] 10.2 Add orchestr8 server to .mcp.json
  - [ ] 10.3 Configure environment variables
  - [ ] 10.4 Add startup script for MCP server
  - [ ] 10.5 Test MCP server with Claude Code
  - [ ] 10.6 Verify configuration works correctly

- [ ] 11. Documentation and Examples
  - [ ] 11.1 Write MCP server README
  - [ ] 11.2 Create usage examples for each tool
  - [ ] 11.3 Document configuration options
  - [ ] 11.4 Add troubleshooting guide
  - [ ] 11.5 Create Claude persona examples
  - [ ] 11.6 Verify documentation completeness

## Estimated Effort

- **Total Tasks:** 11 major tasks, 61 subtasks
- **Estimated Time:** 3-5 days (L)
- **Complexity:** Medium-High (requires MCP protocol knowledge)
- **Dependencies:** @orchestr8/core must be functional

## Success Criteria

- [ ] MCP server starts and connects successfully
- [ ] All three tools (run_workflow, get_status, cancel_workflow) functional
- [ ] Resources accessible via workflow:// and execution:// URIs
- [ ] Long-polling reduces network roundtrips by >50%
- [ ] Test coverage >80% for mcp-server package
- [ ] Parity tests confirm identical envelopes with HTTP API
- [ ] Claude Code can execute workflows via MCP tools
