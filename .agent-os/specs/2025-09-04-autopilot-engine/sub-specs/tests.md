# Tests Specification

This is the tests coverage details for the spec detailed in
@.agent-os/specs/2025-09-04-autopilot-engine/spec.md

> Created: 2025-09-04 Version: 1.0.0

## Test Coverage

### Unit Tests

**Autopilot Class**

- Rule classification accuracy for all 70+ defined rules
- Decision logic for each action type (FIX_SILENTLY, FIX_AND_REPORT,
  REPORT_ONLY, CONTINUE)
- Context analysis for different file types (test, dev, production, UI)
- Performance benchmarks for classification speed (<10ms requirement)
- Error handling for unknown rules and malformed input

**Rule Sets Validation**

- Verify ALWAYS_SAFE contains only formatting and equivalent transformation
  rules
- Confirm CONTEXT_DEPENDENT rules have proper context checking logic
- Validate NEVER_AUTO includes all security and complexity rules
- Test rule set immutability and proper Set operations

### Integration Tests

**Claude Facade Integration**

- Full workflow from CheckResult input to AutopilotDecision output
- Verify silent fixing behavior for safe issues only
- Test mixed issue scenarios (some fixable, some not)
- Confirm proper error propagation and graceful degradation

**Quality Checker Compatibility**

- Integration with existing CheckResult format
- Proper handling of fixable/non-fixable issue flags
- Compatibility with different ESLint rule outputs

### Feature Tests

**Automation Rate Scenarios**

- Test common formatting issues achieve >80% automation
- Verify modernization rules (prefer-const, template literals) auto-fix
- Confirm import organization rules work silently
- Test dead code removal in safe contexts

**Safety Scenarios**

- Ensure no auto-fixing of undefined variables or type errors
- Verify security rules never auto-fix
- Test complexity rules always require human judgment
- Confirm context-dependent rules respect file types

### Mocking Requirements

**No External Mocks Needed**

- **Justification:** Autopilot has zero external dependencies and operates on
  plain TypeScript objects

**Test Data Strategy**

- **Mock CheckResult Objects:** Create realistic issue arrays for different
  scenarios
- **File Path Examples:** Use representative paths for context testing
  (src/component.test.ts, api/handler.ts, etc.)
- **Rule Examples:** Use actual ESLint rule names and formats from real-world
  usage

## Performance Tests

**Classification Speed**

- Benchmark autopilot.decide() with 1, 5, 10, and 20 issues
- Target: <10ms for 10 issues on standard hardware
- Memory usage should remain constant regardless of issue count

**Rule Lookup Performance**

- Verify Set.has() operations are O(1) for all rule sets
- Test performance doesn't degrade with full 70+ rule definitions

## Test Data Examples

### Safe Formatting Issues

```typescript
{
  rule: 'prettier/prettier',
  fixable: true,
  file: 'src/utils.ts'
}
```

### Context-Dependent Issues

```typescript
{
  rule: 'no-console',
  fixable: true,
  file: 'src/component.test.ts'  // Should NOT auto-fix
}
```

### Unsafe Issues

```typescript
{
  rule: 'no-undef',
  fixable: false,
  file: 'src/handler.ts'
}
```

## Coverage Requirements

- **Unit Tests:** 100% code coverage for Autopilot class
- **Integration Tests:** All facade integration points
- **Edge Cases:** Unknown rules, malformed input, empty issue arrays
- **Performance:** All timing and memory requirements verified
