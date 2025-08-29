# Spec Tasks

These are the tasks to be completed for the spec detailed in
@.agent-os/specs/2025-08-29-runtime-adapter-vitest-unification/spec.md

> Created: 2025-08-29 Status: Ready for Implementation

## Tasks

- [x] 1. Create Runtime Abstraction Layer
  - [x] 1.1 Write tests for runtime factory and adapter interfaces
  - [x] 1.2 Create runtime types and interface definitions
  - [x] 1.3 Implement Bun adapter wrapper for Bun.serve
  - [x] 1.4 Implement Node.js adapter using http.createServer
  - [x] 1.5 Create runtime factory with environment detection
  - [x] 1.6 Verify all tests pass for runtime components

- [x] 2. Refactor Server to Use Runtime Adapter
  - [x] 2.1 Write tests for refactored server startup logic
  - [x] 2.2 Modify startServer() to use runtime factory instead of direct
        Bun.serve
  - [x] 2.3 Ensure existing server logic and handlers remain unchanged
  - [x] 2.4 Verify server functionality works with Bun adapter in development
  - [x] 2.5 Verify all existing server tests still pass

- [ ] 3. Convert Server Tests to Vitest
  - [ ] 3.1 Update test imports from bun:test to vitest globals
  - [ ] 3.2 Ensure test scenarios work with Node.js adapter
  - [ ] 3.3 Verify dynamic port allocation from adapter
  - [ ] 3.4 Test request/response cycle matches expected behavior
  - [ ] 3.5 Confirm all test assertions remain identical

- [ ] 4. Integrate Server Tests into Unified Test Suite
  - [ ] 4.1 Update root Vitest configuration to include apps/server tests (write
        a simple unit test in the app package if there isnt one)
  - [ ] 4.2 Verify server tests appear in unified coverage reports
  - [ ] 4.3 Adjust coverage thresholds if needed for additional server code
  - [ ] 4.4 Ensure CI pipeline runs all tests in single Vitest invocation
  - [ ] 4.5 Verify all tests pass in unified test run

- [ ] 5. Clean Up and Documentation
  - [ ] 5.1 Remove any Bun-specific test scripts if no longer needed
  - [ ] 5.2 Update server README with runtime adapter explanation
  - [ ] 5.3 Add code comments explaining adapter pattern
  - [ ] 5.4 Update decision log with DEC-012 implementation
  - [ ] 5.5 Verify all lint and type checks pass
