# Product Roadmap

> Last Updated: 2025-08-18
> Version: 1.0.1
> Status: Week 1 of 4-Week MVP Sprint (Core engine mostly complete)

## Phase 0: Already Completed

The following foundational work has been implemented:

- [x] TypeScript configuration with strict mode
- [x] Project initialization and git setup
- [x] Configure TypeScript with strict mode and project references
- [x] Setup Vitest for testing across packages
- [x] Verify pnpm install, build, and test commands work

## Phase 1: MVP Core (Week 1 - Current)

**Goal:** Deliver working orchestration engine with basic resilience
**Success Criteria:** Can execute multi-step workflows with retry/timeout/circuit breaker

### Must-Have Features (Phase 1)

- [x] Core orchestration engine implementation - Sequential and parallel execution `L`
- [ ] Complete resilience patterns - Retry with jitter, circuit breaker, timeout composition (adapter implementation pending) `M`
- [ ] Workflow schema validation (TypeScript AST in place; Zod validation planned) `M`
- [ ] In-process event bus - Bounded queue with overflow policy `M`
- [x] Basic execution context - Correlation ID, cancellation support `S`

### Should-Have Features (Phase 1)

- [x] AbortSignal propagation through execution chain `M`
- [ ] Memory-safe execution journal `M`
- [x] Structured error taxonomy `S`
- [x] Structured logging (opt-in, no-op by default) `S`

### Dependencies (Phase 1)

- TypeScript strict mode configuration
- Vitest test setup

## Phase 2: Framework & CLI (Week 2)

**Goal:** Provide developer tools and agent framework
**Success Criteria:** Developers can create, test, and run agents via CLI

### Must-Have Features (Phase 2)

- [ ] BaseAgent abstract class with validation hooks `M`
- [ ] Agent test harness with MSW integration `M`
- [ ] CLI tool with core commands (init, create, run, test, inspect) `L`
- [ ] Workflow execution via CLI `M`
- [ ] Journal inspection capability `S`

### Should-Have Features (Phase 2)

- [ ] Agent scaffolding templates `S`
- [ ] Test coverage reporting `S`
- [ ] Chain of Thought support in BaseAgent `M`

### Dependencies (Phase 2)

- Core orchestration engine completed
- Resilience patterns working

## Phase 3: API & Observability (Week 3)

**Goal:** Enable monitoring and REST API access
**Success Criteria:** Can monitor executions via API and dashboard

### Must-Have Features (Phase 3)

- [ ] REST API with 4 core endpoints (execute, status, journal, cancel) `M`
- [ ] WebSocket server for real-time updates `M`
- [ ] React dashboard with live monitoring `L`
- [ ] OpenTelemetry integration (minimal mode) `M`
- [ ] Idempotency support with TTL `S`

### Should-Have Features (Phase 3)

- [ ] ETag support for caching `S`
- [ ] Dashboard metrics visualization `M`
- [ ] Performance monitoring `S`

### Dependencies (Phase 3)

- CLI and agent framework functional
- Execution journal implemented

## Phase 4: Documentation & Polish (Week 4)

**Goal:** Production-ready MVP with documentation
**Success Criteria:** Complete documentation, examples, and CI/CD pipeline

### Must-Have Features

- [ ] Comprehensive documentation `L`
- [ ] 3+ working examples (hello-world, multi-agent, research agent) `M`
- [ ] CI/CD pipeline with GitHub Actions `M`
- [ ] Test coverage >80% for core packages `L`
- [ ] npm package publishing setup `S`

### Should-Have Features

- [ ] Performance benchmarks `S`
- [ ] Troubleshooting guide `S`
- [ ] API documentation `M`

### Dependencies (Phase 4)

- All core functionality complete
- Dashboard operational

## Phase 5: Multi-Provider & Enterprise (Post-MVP)

**Goal:** Add LLM provider abstraction and enterprise features
**Success Criteria:** Support for multiple LLM providers including local models

### Planned Features

- [ ] Provider abstraction interface `L`
- [ ] Claude, OpenAI, Ollama adapters `XL`
- [ ] Authentication and authorization `L`
- [ ] Distributed execution support `XL`
- [ ] GraphQL API `L`
- [ ] Advanced debugging tools `L`

### Dependencies

- MVP fully deployed and stable
- User feedback incorporated

## Effort Scale

- `XS`: < 4 hours
- `S`: 4-8 hours
- `M`: 1-2 days
- `L`: 3-5 days
- `XL`: 1+ weeks

## Success Metrics

### MVP Targets (End of Week 4)

- ✅ CLI executes workflows successfully
- ✅ REST API serves all 4 endpoints
- ✅ Basic resilience patterns functional
- ✅ Dashboard displays real-time updates
- ✅ 80% test coverage on core packages
- ✅ <100ms orchestration overhead (p95)
- ✅ Documentation complete on Docusaurus

### Quality Gates

- All tests passing
- No critical security vulnerabilities
- Memory usage <200MB for typical workflows
- API response times <500ms (p95)
- Zero data loss in execution journal
