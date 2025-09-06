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
  - [x] 2.3 Add support for TypeScript, ESLint, and Prettier error formatting
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
