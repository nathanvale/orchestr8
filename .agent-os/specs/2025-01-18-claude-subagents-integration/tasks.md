# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-01-18-claude-subagents-integration/spec.md

> Created: 2025-01-18
> Status: Ready for Implementation

## Tasks

- [ ] 1. Adapter Boundaries Documentation
  - [ ] 1.1 Document thin adapter pattern principles
  - [ ] 1.2 Define what adapters DO and DON'T do
  - [ ] 1.3 Create implementation examples (correct vs incorrect)
  - [ ] 1.4 Document enforcement guidelines for code review
  - [ ] 1.5 Verify adapter boundaries are clearly defined

- [ ] 2. HTTP API Adapter
  - [ ] 2.1 Write tests for HTTP adapter as pass-through layer
  - [ ] 2.2 Import shared Zod schemas from MCP spec
  - [ ] 2.3 Implement thin HTTP adapter forwarding to engine
  - [ ] 2.4 Ensure NO business logic in adapter
  - [ ] 2.5 Verify adapter only validates and forwards

- [ ] 3. HTTP REST Endpoints
  - [ ] 3.1 Write tests for POST /api/workflows/run endpoint
  - [ ] 3.2 Implement endpoint forwarding to MCP server
  - [ ] 3.3 Write tests for GET /api/workflows/status/:id endpoint
  - [ ] 3.4 Implement status endpoint (forward to mcp**orchestr8**get_status)
  - [ ] 3.5 Write tests for POST /api/workflows/cancel/:id endpoint
  - [ ] 3.6 Implement cancel endpoint (forward to mcp**orchestr8**cancel_workflow)
  - [ ] 3.7 Add bearer token authentication
  - [ ] 3.8 Return identical normalized envelopes as MCP
  - [ ] 3.9 Verify all HTTP endpoints pass parity tests

- [ ] 4. Comprehensive Parity Testing
  - [ ] 4.1 Write input validation parity tests
  - [ ] 4.2 Write successful execution parity tests
  - [ ] 4.3 Write error handling parity tests
  - [ ] 4.4 Write correlation ID propagation tests
  - [ ] 4.5 Write long-polling behavior tests
  - [ ] 4.6 Write cancellation parity tests
  - [ ] 4.7 Write envelope structure validation tests
  - [ ] 4.8 Create surface abstraction helpers
  - [ ] 4.9 Verify 100% parity across all surfaces

- [ ] 5. Claude SDK Integration
  - [ ] 5.1 Write tests for Claude SDK adapter
  - [ ] 5.2 Implement thin adapter using Anthropic SDK
  - [ ] 5.3 Add prompt caching with ephemeral cache_control
  - [ ] 5.4 Implement JSON output mode configuration
  - [ ] 5.5 Handle parallel tool calls correctly
  - [ ] 5.6 Track token usage and cache metrics
  - [ ] 5.7 Ensure thinking blocks are not exposed
  - [ ] 5.8 Verify Claude adapter passes parity tests

- [ ] 6. Claude Agent Templates
  - [ ] 6.1 Create TypeScript Pro agent template
  - [ ] 6.2 Create React Pro agent template
  - [ ] 6.3 Create Coordinator agent template
  - [ ] 6.4 Configure agents to use mcp**orchestr8** tools
  - [ ] 6.5 Add allowed tools configuration
  - [ ] 6.6 Test agent collaboration with correlation IDs
  - [ ] 6.7 Verify agents can invoke orchestr8 workflows

- [ ] 7. Cost Optimization and Metrics
  - [ ] 7.1 Implement token usage tracking
  - [ ] 7.2 Add cache hit rate monitoring
  - [ ] 7.3 Measure cost reduction from caching
  - [ ] 7.4 Document 90% token savings
  - [ ] 7.5 Add metrics to normalized envelope
  - [ ] 7.6 Verify cost optimization targets met

- [ ] 8. End-to-End Testing and Validation
  - [ ] 8.1 Write E2E test for workflow execution via HTTP
  - [ ] 8.2 Write E2E test for workflow execution via MCP
  - [ ] 8.3 Write E2E test for workflow execution via Claude SDK
  - [ ] 8.4 Test cancellation across all surfaces
  - [ ] 8.5 Test error recovery across all surfaces
  - [ ] 8.6 Test long-polling behavior parity
  - [ ] 8.7 Run full parity test suite
  - [ ] 8.8 Verify all surfaces return identical envelopes

## Implementation Order Rationale

1. **Adapter Boundaries First**: Must be clearly defined before any implementation
2. **HTTP Adapter**: Thin pass-through layer using shared schemas from MCP
3. **HTTP Endpoints**: REST API forwarding to core engine
4. **Parity Testing**: Essential to ensure identical behavior across surfaces
5. **Claude SDK Integration**: Adds LLM-specific optimizations without affecting core logic
6. **Agent Templates**: Enable multi-agent collaboration patterns
7. **Cost Optimization**: Track and optimize token usage
8. **End-to-End Validation**: Comprehensive testing across all surfaces

## Success Metrics

- ✅ All tests passing with >95% coverage
- ✅ Parity tests show 100% envelope consistency
- ✅ Performance tests confirm <100ms overhead
- ✅ Cache hit rate >80% in typical usage
- ✅ E2E tests demonstrate multi-agent collaboration
- ✅ Documentation complete with examples
