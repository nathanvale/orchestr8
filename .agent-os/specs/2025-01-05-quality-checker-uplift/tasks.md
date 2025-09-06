# Spec Tasks

## Tasks

- [ ] 1. Migrate Claude facade to QualityCheckerV2 architecture
  - [ ] 1.1 Write tests for Claude facade V2 integration
  - [ ] 1.2 Update Claude facade to import and use QualityCheckerV2
  - [ ] 1.3 Modify result processing to handle structured Issue[] format
  - [ ] 1.4 Update extractIssuesFromQualityResult to work with new format
  - [ ] 1.5 Ensure backward compatibility with existing hook payloads
  - [ ] 1.6 Verify all facade tests pass

- [ ] 2. Create Claude-optimized formatter for structured output
  - [ ] 2.1 Write tests for ClaudeFormatter class
  - [ ] 2.2 Implement ClaudeFormatter with XML-based prompt engineering format
  - [ ] 2.3 Add support for TypeScript, ESLint, and Prettier error formatting
  - [ ] 2.4 Include file paths, line/column numbers, and error codes
  - [ ] 2.5 Create helper methods for different error severity levels
  - [ ] 2.6 Verify formatter outputs are properly structured for Claude

- [ ] 3. Enhance issue reporter for better Claude integration
  - [ ] 3.1 Write tests for updated formatForClaude method
  - [ ] 3.2 Update formatForClaude to use ClaudeFormatter
  - [ ] 3.3 Preserve all diagnostic metadata through the pipeline
  - [ ] 3.4 Group errors by engine with full context
  - [ ] 3.5 Add support for both summary and detailed output modes
  - [ ] 3.6 Verify issue reporter tests pass

- [ ] 4. Update Autopilot decision making with rich error data
  - [ ] 4.1 Write tests for enhanced Autopilot classification
  - [ ] 4.2 Update Autopilot to use structured Issue data
  - [ ] 4.3 Improve fixable vs non-fixable issue classification
  - [ ] 4.4 Add error code-based decision rules
  - [ ] 4.5 Enhance confidence scoring with diagnostic details
  - [ ] 4.6 Verify Autopilot tests pass

- [ ] 5. Integration testing and migration path
  - [ ] 5.1 Write end-to-end tests for Claude hook with TypeScript errors
  - [ ] 5.2 Test with real TypeScript compilation errors
  - [ ] 5.3 Verify structured output format in Claude hook responses
  - [ ] 5.4 Document migration path for git-hook and API facades
  - [ ] 5.5 Performance test to ensure no regression
  - [ ] 5.6 Update package documentation
  - [ ] 5.7 Run full test suite and ensure all tests pass