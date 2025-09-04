# Product Roadmap

> Last Updated: 2025-09-04 Version: 2.0.0 Status: Simplified

## Week 1: Refactor & Ship (5 days)

**Goal:** Refactor quality-check package to facade pattern and ship working
Claude integration **Success Criteria:** Claude hook operational, 80%+
automation rate, <2s processing time

### Day 1-2: Package Refactor

- [x] Create new directory structure (core/, facades/, adapters/) `M`
- [x] Extract CLIFacade from current index.ts `S`
- [x] Create HookFacade for git pre-commit `S`
- [x] Create APIFacade for programmatic use `S`
- [x] Delete unnecessary enforcement files `S`

### Day 3: Add Autopilot

- [ ] Create adapters/autopilot.ts (~100 lines) `M`
- [ ] Define safe auto-fix rules list `S`
- [ ] Implement simple classification logic `S`
- [ ] Add fix verification `S`

### Day 4: Claude Integration

- [ ] Create hooks/claude-hook.js (~50 lines) `S`
- [ ] Test with real Claude Code `M`
- [ ] Update .claude/settings.json `S`
- [ ] Verify silent fixing works `S`

### Day 5: Test & Deploy

- [ ] Test all facades (CLI, hook, pre-commit, API) `M`
- [ ] Monitor automation rate `S`
- [ ] Adjust safe rules based on results `S`
- [ ] Documentation updates `S`

### Dependencies

- Existing quality-check package
- Node.js environment
- ESLint, Prettier, TypeScript already installed

## Week 2: Optimize (If Needed)

**Goal:** Refine based on real usage data **Success Criteria:** Improved
automation rate, reduced false positives

### Optional Improvements

- [ ] Add more safe rules based on usage patterns `S`
- [ ] Basic SQLite pattern tracking `M`
- [ ] Simple metrics dashboard `L`
- [ ] Performance optimizations `S`

### Metrics to Track

- Automation rate (target: 80%+)
- Processing time (target: <2s)
- False positive rate (target: <1%)
- Developer interruptions per day

## Future: Evidence-Based Growth

**Only add when proven necessary:**

### Maybe Later (Based on Evidence)

- **Configuration Files** - If teams need customization
- **Learning System** - If patterns consistently emerge
- **Dashboard UI** - If metrics need visualization
- **Caching Layer** - If performance issues arise
- **Request Router** - If tools need different handling
- **Worker Pool** - If parallel processing needed
- **Circuit Breaker** - If reliability issues occur

### Never Unless Critical

- Complex dependency injection
- Event sourcing
- Microservices architecture
- GraphQL API
- Kubernetes deployment
- Multi-region support

## Implementation Principles

### Core Philosophy

1. **YAGNI** - Don't add it until you need it
2. **Ship Fast** - Working software in 1 week
3. **Measure First** - Add complexity only with evidence
4. **Simple Wins** - 50-line facades over complex patterns

### Success Metrics

- **Week 1**: Working hook with 70%+ automation
- **Week 2**: Refined to 80%+ automation
- **Month 1**: Stable with <1% false positives
- **Month 3**: Patterns identified, maybe add learning

### Anti-Patterns to Avoid

- ❌ Adding routers before needed
- ❌ Over-abstracting with interfaces
- ❌ Premature optimization
- ❌ Complex configuration systems
- ❌ Multi-layer architectures

## Summary

This roadmap prioritizes:

- **Immediate value** - Ship in 1 week
- **Pragmatic choices** - Facades over complex patterns
- **Evidence-based growth** - Complexity only when proven
- **Maintainability** - ~440 lines total, easy to understand

The entire Phase 1 is just **5 days of focused work** resulting in a working
system that solves the actual problem.
