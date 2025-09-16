# Test Tasks for Context Fetcher

## Parent Task: Test Context Fetcher Subagent

### Sub-task 1: Test Basic Loading

- [ ] USE: @agent:context-fetcher
- [ ] REQUEST: "Load code-style.md"
- [ ] VERIFY: Content loaded successfully

### Sub-task 2: Test Cache Hit

- [ ] USE: @agent:context-fetcher
- [ ] REQUEST: "Load code-style.md" (again)
- [ ] VERIFY: Response says "already in context" or "using cached"

### Sub-task 3: Test Semantic Search

- [ ] USE: @agent:context-fetcher
- [ ] REQUEST: "Find authentication patterns"
- [ ] VERIFY: Finds auth-related content from multiple files

### Sub-task 4: Test Compression

- [ ] Create large test file (>5000 chars)
- [ ] USE: @agent:context-fetcher
- [ ] REQUEST: "Load large-test-file.md"
- [ ] VERIFY: Returns compressed version

### Sub-task 5: Test Session Registry

- [ ] Load 5 different files via context-fetcher
- [ ] REQUEST: "Show session registry"
- [ ] VERIFY: All 5 files tracked in registry
