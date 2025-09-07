# Spec Tasks

## Tasks

- [x] 1. Migrate Claude facade to QualityCheckerV2 architecture
  - [x] 1.1 Write tests for Claude facade V2 integration
  - [x] 1.2 Update Claude facade to import and use QualityCheckerV2
  - [x] 1.3 Modify result processing to handle structured Issue[] format
  - [x] 1.4 Update extractIssuesFromQualityResult to work with new format
  - [x] 1.5 Ensure backward compatibility with existing hook payloads
  - [x] 1.6 Verify all facade tests pass

- [x] 2. Create Claude-optimized formatter for structured output
  - [x] 2.1 Write tests for ClaudeFormatter class
  - [x] 2.2 Implement ClaudeFormatter with XML-based prompt engineering format
  - [x]1 2.3 Add support for TypeScript, ESLint, and Prettier error formatting
  - [x] 2.4 Include file paths, line/column numbers, and error codes
  - [x] 2.5 Create helper methods for different error severity levels
  - [x] 2.6 Verify formatter outputs are properly structured for Claude

- [x] 3. Enhance issue reporter for better Claude integration
  - [x] 3.1 Write tests for updated formatForClaude method
  - [x] 3.2 Update formatForClaude to use ClaudeFormatter
  - [x] 3.3 Preserve all diagnostic metadata through the pipeline
  - [x] 3.4 Group errors by engine with full context
  - [x] 3.5 Add support for both summary and detailed output modes
  - [x] 3.6 Verify issue reporter tests pass

- [x] 4. Update Autopilot decision making with rich error data
  - [x] 4.1 Write tests for enhanced Autopilot classification
  - [x] 4.2 Update Autopilot to use structured Issue data
  - [x] 4.3 Improve fixable vs non-fixable issue classification
  - [x] 4.4 Add error code-based decision rules
  - [x] 4.5 Enhance confidence scoring with diagnostic details
  - [x] 4.6 Verify Autopilot tests pass

- [x] 5. Integration testing and migration path
  - [x] 5.1 Write end-to-end tests for Claude hook with TypeScript errors
  - [x] 5.2 Test with real TypeScript compilation errors
  - [x] 5.3 Verify structured output format in Claude hook responses
  - [x] 5.4 Document migration path for git-hook and API facades
  - [x] 5.5 Performance test to ensure no regression
  - [x] 5.6 Update package documentation
  - [x] 5.7 Run full test suite and ensure all tests pass

- [x] 6. Fix broken performance tests
  - [x] 6.1 Identify all failing performance test cases
  - [x] 6.2 Analyze performance regression root causes
  - [x] 6.3 Update warm cache performance benchmarks
  - [x] 6.4 Fix TypeScript incremental compilation performance tests
  - [x] 6.5 Optimize ESLint cache validation tests
  - [x] 6.6 Adjust Prettier formatting performance thresholds
  - [x] 6.7 Update CI performance gate expectations
  - [x] 6.8 Verify all performance tests pass with new architecture

- [x] 7. Fix remaining broken unit tests
  - [x] 7.1 Write tests for Autopilot edge case handling
  - [x] 7.2 Fix Autopilot mixed fixable/unfixable error classification logic
  - [x] 7.3 Correct Autopilot context-dependent rule decisions for different file types
  - [x] 7.4 Repair Autopilot performance test assertions under load scenarios
  - [x] 7.5 Fix Claude hook integration XML structure formatting tests
  - [x] 7.6 Update Claude hook issue grouping by engine tests
  - [x] 7.7 Resolve QualityChecker integration test failures for TypeScript path aliases
  - [x] 7.8 Fix ESLint flat config integration test issues
  - [x] 7.9 Repair multi-engine aggregation integration tests
  - [x] 7.10 Fix CI/CD pipeline integration test exit codes and output consistency
  - [x] 7.11 Verify all unit and integration tests pass

- [x] 8. Fix XML formatting output for Claude hook in REPORT_ONLY mode
  - [x] 8.1 Write tests for XML output in REPORT_ONLY autopilot decision path
  - [x] 8.2 Update claude.ts REPORT_ONLY case to use ClaudeFormatter
  - [x] 8.3 Import ClaudeFormatter in claude.ts facade
  - [x] 8.4 Convert decision.issues to XML format using formatter.format()
  - [x] 8.5 Modify outputClaudeBlocking to handle XML input properly
  - [x] 8.6 Test XML output structure matches expected format
  - [x] 8.7 Verify XML escaping for special characters
  - [x] 8.8 Update FIX_AND_REPORT case to use XML formatter
  - [x] 8.9 Test FIX_AND_REPORT XML output consistency
  - [x] 8.10 Ensure backward compatibility with plain text fallback
  - [x] 8.11 Add integration tests for all autopilot decision paths
  - [x] 8.12 Verify Claude Code agent receives structured XML

- [x] 9. Refactor error output formatting pipeline
  - [x] 9.1 Write tests for unified error output formatting
  - [x] 9.2 Create centralized formatIssuesForOutput function
  - [x] 9.3 Standardize XML output across all decision paths
  - [x] 9.4 Remove duplicate formatting logic in outputClaudeBlocking
  - [x] 9.5 Consolidate error message generation
  - [x] 9.6 Add output mode configuration (XML/plain text/JSON)
  - [x] 9.7 Test output mode switching based on environment
  - [x] 9.8 Verify consistent formatting across all facades

- [x] 10. Enhance Claude hook debugging and observability
  - [x] 10.1 Add debug logging for formatter selection
  - [x] 10.2 Log autopilot decision rationale with issues
  - [x] 10.3 Create debug output showing XML generation steps
  - [x] 10.4 Add correlation IDs to track formatting pipeline
  - [x] 10.5 Implement formatter performance metrics
  - [x] 10.6 Add validation for XML output structure
  - [x] 10.7 Create formatter error recovery mechanisms
  - [x] 10.8 Test debug output in development mode

- [x] 11. Update documentation and examples
  - [x] 11.1 Document XML output format structure
  - [x] 11.2 Create examples of each error type in XML
  - [x] 11.3 Document autopilot decision flow with formatting
  - [x] 11.4 Add troubleshooting guide for formatting issues
  - [x] 11.5 Update Claude hook integration documentation
  - [x] 11.6 Create migration guide for custom formatters
  - [x] 11.7 Document environment variables for output control
  - [x] 11.8 Add examples of Claude Code agent interactions
