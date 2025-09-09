# Spec Tasks

These are the tasks to be completed for the spec detailed in
@.agent-os/specs/2025-09-09-enhanced-error-reporting/spec.md

> Created: 2025-09-09 Status: Ready for Implementation

## Tasks

- [x] 1. Enhance Logger Service with Dual Output Support
  - [x] 1.1 Write tests for enhanced Logger.ts with dual output modes
  - [x] 1.2 Extend Logger.ts interface to support console/file/silent/colored
        config options
  - [x] 1.3 Add JSON file writing capabilities to Logger service
  - [x] 1.4 Implement log directory management (.quality-check/logs/ structure)
  - [x] 1.5 Add ErrorReport interface and JSON schema validation
  - [x] 1.6 Implement automatic log cleanup with configurable retention
  - [x] 1.7 Verify all Logger enhancement tests pass

- [x] 2. Create OutputFormatter Service for ANSI Console Output
  - [x] 2.1 Write tests for OutputFormatter service with color and formatting
        methods
  - [x] 2.2 Install chalk or picocolors dependency for ANSI color support
  - [x] 2.3 Implement OutputFormatter class with summary formatting methods
  - [x] 2.4 Add colorize method for error/warning/success color coding
  - [x] 2.5 Create console summary templates for different error types
  - [x] 2.6 Add silent mode support to suppress console output when needed
  - [x] 2.7 Verify all OutputFormatter tests pass

- [ ] 3. Update ESLint Facade for JSON Error Reporting
  - [ ] 3.1 Write tests for ESLint facade with new JSON output parsing
  - [ ] 3.2 Modify ESLint facade to parse JSON output instead of XML
  - [ ] 3.3 Transform ESLint results to structured ErrorReport format
  - [ ] 3.4 Integrate with enhanced Logger for dual output (JSON file + console
        summary)
  - [ ] 3.5 Add error count and file affected summary calculation
  - [ ] 3.6 Preserve raw ESLint output in JSON for debugging purposes
  - [ ] 3.7 Verify all ESLint facade tests pass

- [ ] 4. Update TypeScript Facade for Structured Error Output
  - [ ] 4.1 Write tests for TypeScript facade with structured error reporting
  - [ ] 4.2 Modify TypeScript facade to transform TSC errors to ErrorReport
        format
  - [ ] 4.3 Parse TypeScript compiler output for line/column/message extraction
  - [ ] 4.4 Integrate with enhanced Logger for JSON storage and console summary
  - [ ] 4.5 Add TypeScript-specific error categorization and severity mapping
  - [ ] 4.6 Handle compilation success scenarios with appropriate reporting
  - [ ] 4.7 Verify all TypeScript facade tests pass

- [ ] 5. Update Prettier Facade and Git Hook Integration
  - [ ] 5.1 Write tests for Prettier facade with consistent error reporting
  - [ ] 5.2 Modify Prettier facade to use structured ErrorReport format
  - [ ] 5.3 Update Git Hook facade to support silent/verbose mode switching
  - [ ] 5.4 Ensure all facades work consistently with new logging system
  - [ ] 5.5 Add CLI argument handling for output mode configuration
  - [ ] 5.6 Test integration with Claude Code scenarios and context reduction
  - [ ] 5.7 Verify all facade integration tests pass and system works end-to-end
