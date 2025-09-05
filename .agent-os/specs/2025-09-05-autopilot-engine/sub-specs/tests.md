# Tests Specification

This is the tests specification for the spec detailed in @.agent-os/specs/2025-09-05-autopilot-engine/spec.md

## Test Requirements

### Unit Tests for Rule Classification

**Safe Rules Tests**
```typescript
describe('Safe Rules', () => {
  it('should auto-fix formatting issues', () => {
    const issues = [
      { rule: 'prettier/prettier', fixable: true, file: 'test.ts' },
      { rule: 'semi', fixable: true, file: 'test.ts' }
    ]
    expect(decision.action).toBe('FIX_SILENTLY')
    expect(decision.fixes).toHaveLength(2)
    expect(decision.confidence).toBe(1.0)
  })

  it('should auto-fix modernization issues', () => {
    const issues = [
      { rule: 'prefer-const', fixable: true, file: 'test.ts' },
      { rule: 'prefer-template', fixable: true, file: 'test.ts' },
      { rule: 'object-shorthand', fixable: true, file: 'test.ts' }
    ]
    expect(decision.action).toBe('FIX_SILENTLY')
    expect(decision.fixes).toHaveLength(3)
  })
})
```

**Unsafe Rules Tests**
```typescript
describe('Unsafe Rules', () => {
  it('should not auto-fix undefined variables', () => {
    const issues = [{ rule: 'no-undef', fixable: false, file: 'test.ts' }]
    expect(decision.action).toBe('REPORT_ONLY')
    expect(decision.issues).toHaveLength(1)
    expect(decision.fixes).toBeUndefined()
  })

  it('should not auto-fix complexity issues', () => {
    const issues = [
      { rule: 'complexity', fixable: false, file: 'test.ts' },
      { rule: 'max-lines-per-function', fixable: false, file: 'test.ts' }
    ]
    expect(decision.action).toBe('REPORT_ONLY')
    expect(decision.issues).toHaveLength(2)
  })
})
```

**Mixed Issues Tests**
```typescript
describe('Mixed Issues', () => {
  it('should fix safe and report unsafe', () => {
    const issues = [
      { rule: 'semi', fixable: true, file: 'test.ts' },
      { rule: 'no-undef', fixable: false, file: 'test.ts' }
    ]
    expect(decision.action).toBe('FIX_AND_REPORT')
    expect(decision.fixes).toHaveLength(1)
    expect(decision.issues).toHaveLength(1)
  })
})
```

### Context-Dependent Rules Tests

```typescript
describe('Context-Dependent Rules', () => {
  it('should not remove console in test files', () => {
    const issues = [
      { rule: 'no-console', fixable: true, file: 'component.test.ts' }
    ]
    expect(decision.action).toBe('REPORT_ONLY')
    expect(decision.issues).toHaveLength(1)
  })

  it('should remove console in production files', () => {
    const issues = [
      { rule: 'no-console', fixable: true, file: 'api/handler.ts' }
    ]
    expect(decision.action).toBe('FIX_SILENTLY')
    expect(decision.fixes).toHaveLength(1)
  })

  it('should always remove debugger statements', () => {
    const issues = [
      { rule: 'no-debugger', fixable: true, file: 'any.file.ts' }
    ]
    expect(decision.action).toBe('FIX_SILENTLY')
    expect(decision.fixes).toHaveLength(1)
  })

  it('should keep alert in UI files', () => {
    const issues = [
      { rule: 'no-alert', fixable: true, file: 'component.tsx' }
    ]
    expect(decision.action).toBe('REPORT_ONLY')
  })

  it('should remove alert in non-UI files', () => {
    const issues = [
      { rule: 'no-alert', fixable: true, file: 'api/handler.ts' }
    ]
    expect(decision.action).toBe('FIX_SILENTLY')
  })
})
```

### File Type Detection Tests

```typescript
describe('File Type Detection', () => {
  const testCases = [
    { file: 'component.test.ts', isTest: true, isDev: false, isUI: false },
    { file: 'utils.spec.tsx', isTest: true, isDev: false, isUI: true },
    { file: '__tests__/helper.js', isTest: true, isDev: false, isUI: false },
    { file: 'debug.utils.ts', isTest: false, isDev: true, isUI: false },
    { file: 'development.config.js', isTest: false, isDev: true, isUI: false },
    { file: 'Button.tsx', isTest: false, isDev: false, isUI: true },
    { file: 'api/handler.ts', isTest: false, isDev: false, isUI: false }
  ]

  testCases.forEach(({ file, isTest, isDev, isUI }) => {
    it(`should correctly identify ${file}`, () => {
      // Test file type detection logic
    })
  })
})
```

### Performance Tests

```typescript
describe('Performance', () => {
  it('should classify 10 issues in under 10ms', () => {
    const startTime = performance.now()
    const issues = generateIssues(10)
    autopilot.decide({ issues })
    const endTime = performance.now()
    expect(endTime - startTime).toBeLessThan(10)
  })

  it('should handle 100 issues efficiently', () => {
    const startTime = performance.now()
    const issues = generateIssues(100)
    autopilot.decide({ issues })
    const endTime = performance.now()
    expect(endTime - startTime).toBeLessThan(50)
  })

  it('should use minimal memory', () => {
    const memBefore = process.memoryUsage().heapUsed
    const autopilot = new Autopilot()
    const issues = generateIssues(1000)
    autopilot.decide({ issues })
    const memAfter = process.memoryUsage().heapUsed
    expect(memAfter - memBefore).toBeLessThan(1024 * 1024) // 1MB
  })
})
```

### Integration Tests

```typescript
describe('Quality Checker Integration', () => {
  it('should handle CheckResult format', () => {
    const checkResult: CheckResult = {
      filePath: 'test.ts',
      issues: [/* ... */],
      hasErrors: false,
      hasWarnings: true,
      fixable: true
    }
    const decision = autopilot.decide(checkResult)
    expect(decision).toHaveProperty('action')
    expect(decision).toHaveProperty('confidence')
  })

  it('should maintain stateless operation', () => {
    const result1 = autopilot.decide(checkResult1)
    const result2 = autopilot.decide(checkResult2)
    const result3 = autopilot.decide(checkResult1)
    expect(result3).toEqual(result1) // Same input, same output
  })
})
```

### Edge Cases Tests

```typescript
describe('Edge Cases', () => {
  it('should handle empty issues array', () => {
    const decision = autopilot.decide({ issues: [] })
    expect(decision.action).toBe('CONTINUE')
    expect(decision.confidence).toBe(1.0)
  })

  it('should handle unknown rules conservatively', () => {
    const issues = [
      { rule: 'unknown-rule-xyz', fixable: true, file: 'test.ts' }
    ]
    const decision = autopilot.decide({ issues })
    expect(decision.action).toBe('REPORT_ONLY')
  })

  it('should handle malformed issue data', () => {
    const issues = [
      { rule: null, fixable: true, file: 'test.ts' },
      { rule: undefined, fixable: true, file: 'test.ts' }
    ]
    const decision = autopilot.decide({ issues })
    expect(decision.action).toBe('REPORT_ONLY')
  })

  it('should never throw errors', () => {
    const testCases = [
      null,
      undefined,
      {},
      { issues: null },
      { issues: 'not-an-array' }
    ]
    
    testCases.forEach(testCase => {
      expect(() => autopilot.decide(testCase)).not.toThrow()
    })
  })
})
```

## Success Metrics Validation

### Automation Rate Test
```typescript
describe('Automation Rate', () => {
  it('should achieve >80% automation on common issues', () => {
    const commonIssues = [
      // 80 formatting issues
      ...Array(80).fill({ rule: 'prettier/prettier', fixable: true }),
      // 10 import issues
      ...Array(10).fill({ rule: 'import/order', fixable: true }),
      // 10 complexity issues
      ...Array(10).fill({ rule: 'complexity', fixable: false })
    ]
    
    const decision = autopilot.decide({ issues: commonIssues })
    const automationRate = decision.fixes.length / commonIssues.length
    expect(automationRate).toBeGreaterThan(0.8)
  })
})
```

### False Positives Test
```typescript
describe('False Positives', () => {
  it('should have 0% false positives', () => {
    const riskyIssues = [
      { rule: 'no-undef', fixable: true, file: 'test.ts' },
      { rule: 'no-unused-expressions', fixable: true, file: 'test.ts' },
      { rule: 'security/detect-object-injection', fixable: true, file: 'test.ts' }
    ]
    
    const decision = autopilot.decide({ issues: riskyIssues })
    expect(decision.action).toBe('REPORT_ONLY')
    expect(decision.fixes).toBeUndefined()
  })
})
```

## Test Data Fixtures

### Sample Files
- `sample.ts` - Production code with mixed issues
- `sample.test.ts` - Test file with console statements
- `sample.dev.ts` - Development file with debugger
- `UserProfile.tsx` - UI component with JSX issues
- `config.ts` - Configuration file
- `api/handler.ts` - API endpoint file

### Issue Generators
```typescript
function generateFormattingIssue(): Issue {
  const rules = ['semi', 'quotes', 'indent', 'comma-dangle']
  return {
    rule: rules[Math.floor(Math.random() * rules.length)],
    fixable: true,
    file: 'test.ts'
  }
}

function generateComplexityIssue(): Issue {
  const rules = ['complexity', 'max-lines-per-function', 'max-depth']
  return {
    rule: rules[Math.floor(Math.random() * rules.length)],
    fixable: false,
    file: 'test.ts'
  }
}
```

## Coverage Requirements

- **Line Coverage**: 95%+ for Autopilot class
- **Branch Coverage**: 90%+ for all decision paths
- **Function Coverage**: 100% for public methods
- **Edge Case Coverage**: All identified edge cases tested

## Performance Benchmarks

| Metric | Target | Test Method |
|--------|--------|-------------|
| **Classification Speed** | <10ms for 10 issues | Performance timer |
| **Memory Usage** | <1MB heap allocation | Memory profiler |
| **Throughput** | 1000+ files/second | Batch processing test |
| **Decision Latency** | <1ms single issue | Micro-benchmark |

## Test Execution Plan

1. **Unit Tests First** - Test individual methods in isolation
2. **Integration Tests** - Test with real CheckResult data
3. **Performance Tests** - Validate speed and memory targets
4. **Edge Case Tests** - Ensure robustness
5. **Success Metrics** - Validate 80% automation, 0% false positives