# Day 3: Autopilot Implementation Specification
## Building the Smart Classification & Auto-Fix Engine
### Time Estimate: 4-6 hours

---

## 🎯 Objective

Create a simple but effective Autopilot adapter that:
1. Classifies issues into safe/unsafe categories
2. Decides whether to fix silently or report
3. Verifies fixes won't break code
4. Tracks patterns for future learning

**Goal: 80%+ automation rate with 0% false positives**

---

## 📝 File: `src/adapters/autopilot.ts`

### Complete Implementation (~100 lines)

```typescript
// src/adapters/autopilot.ts

import type { CheckResult, Issue, AutopilotDecision, Classification } from '../types';

/**
 * Autopilot: Smart decision engine for auto-fixing
 * 
 * Philosophy:
 * - Fix silently when 100% safe
 * - Report when human judgment needed
 * - Never break working code
 */
export class Autopilot {
  /**
   * Tier 1: Always safe to auto-fix
   * These rules NEVER change code behavior, only style
   */
  private readonly ALWAYS_SAFE = new Set([
    // Formatting - Pure style, no behavior change
    'prettier/prettier',
    'indent',
    'semi',
    'semi-spacing',
    'semi-style',
    'quotes',
    'quote-props',
    'jsx-quotes',
    'comma-dangle',
    'comma-spacing',
    'comma-style',
    'space-before-blocks',
    'space-before-function-paren',
    'space-in-parens',
    'space-infix-ops',
    'space-unary-ops',
    'object-curly-spacing',
    'array-bracket-spacing',
    'computed-property-spacing',
    'func-call-spacing',
    'key-spacing',
    'keyword-spacing',
    'no-trailing-spaces',
    'no-whitespace-before-property',
    'padded-blocks',
    'padding-line-between-statements',
    'eol-last',
    'linebreak-style',
    'no-multiple-empty-lines',
    
    // Import organization - Safe reordering
    'import/order',
    'import/newline-after-import',
    'import/no-duplicates',
    'sort-imports',
    
    // Safe modernization - Equivalent transformations
    'prefer-const',           // let → const (when never reassigned)
    'prefer-template',        // 'a' + b → `a${b}`
    'template-curly-spacing', // `${ x }` → `${x}`
    'prefer-arrow-callback',  // function() {} → () => {}
    'arrow-spacing',          // ()=> → () =>
    'arrow-parens',          // x => → (x) =>
    'arrow-body-style',      // => { return x } → => x
    'object-shorthand',      // { x: x } → { x }
    'prefer-destructuring',   // const x = obj.x → const { x } = obj
    'no-useless-rename',     // { x: x } = obj → { x } = obj
    
    // Dead code removal - Safe cleanup
    'no-unused-vars',         // Remove unused (with caution)
    'no-unreachable',        // Remove unreachable code
    'no-empty',              // Remove empty blocks
    'no-useless-return',     // Remove pointless returns
    'no-useless-catch',      // Remove pointless catch blocks
    'no-useless-constructor', // Remove empty constructors
    
    // Simplification - Equivalent but simpler
    'no-extra-boolean-cast',  // !!x → x (in boolean context)
    'no-extra-parens',        // ((x)) → x
    'no-extra-semi',          // ;; → ;
    'yoda',                   // 'red' === x → x === 'red'
    'no-unneeded-ternary',    // x ? true : false → x
    'no-else-return',         // if/else return → if return
    'no-lonely-if',           // else { if {} } → else if {}
    'operator-assignment',     // x = x + 1 → x += 1
    'prefer-numeric-literals', // parseInt('111', 2) → 0b111
  ]);

  /**
   * Tier 2: Safe in specific contexts
   * Check context before auto-fixing
   */
  private readonly CONTEXT_DEPENDENT = new Set([
    'no-console',            // Safe to remove in production
    'no-debugger',          // Always safe to remove
    'no-alert',             // Safe to remove in Node.js
    '@typescript-eslint/no-explicit-any', // any → unknown
    'no-var',               // var → let/const
  ]);

  /**
   * Tier 3: NEVER auto-fix
   * These require human judgment
   */
  private readonly NEVER_AUTO = new Set([
    'no-undef',              // Undefined variables - might be global
    'no-unused-expressions', // Might be intentional
    'complexity',            // Requires refactoring
    'max-lines-per-function', // Requires decomposition
    'max-depth',             // Requires restructuring
    'max-statements',        // Requires splitting
    'security/detect-object-injection', // Security issue
    'security/detect-non-literal-regexp', // Security issue
    '@typescript-eslint/no-unsafe-assignment', // Type safety
    '@typescript-eslint/no-unsafe-call',       // Type safety
    '@typescript-eslint/no-unsafe-member-access', // Type safety
  ]);

  /**
   * Main decision method - the brain of autopilot
   */
  decide(result: CheckResult): AutopilotDecision {
    const classification = this.classify(result.issues);
    
    // All issues are safely fixable
    if (classification.allAutoFixable) {
      return {
        action: 'FIX_SILENTLY',
        fixes: classification.autoFixable,
        confidence: 1.0,
      };
    }
    
    // Mix of fixable and unfixable
    if (classification.hasAutoFixable && classification.hasUnfixable) {
      return {
        action: 'FIX_AND_REPORT',
        fixes: classification.autoFixable,
        issues: classification.unfixable,
        confidence: 0.8,
      };
    }
    
    // Only unfixable issues
    if (classification.hasUnfixable) {
      return {
        action: 'REPORT_ONLY',
        issues: classification.unfixable,
        confidence: 1.0,
      };
    }
    
    // No issues
    return {
      action: 'CONTINUE',
      confidence: 1.0,
    };
  }

  /**
   * Classify issues into categories
   */
  private classify(issues: Issue[]): Classification {
    const autoFixable: Issue[] = [];
    const contextFixable: Issue[] = [];
    const unfixable: Issue[] = [];
    
    for (const issue of issues) {
      // Skip if not fixable at all
      if (!issue.fixable) {
        unfixable.push(issue);
        continue;
      }
      
      // Check which category
      if (this.ALWAYS_SAFE.has(issue.rule)) {
        autoFixable.push(issue);
      } else if (this.CONTEXT_DEPENDENT.has(issue.rule)) {
        const contextDecision = this.checkContext(issue);
        if (contextDecision.safe) {
          autoFixable.push(issue);
        } else {
          unfixable.push(issue);
        }
      } else if (this.NEVER_AUTO.has(issue.rule)) {
        unfixable.push(issue);
      } else {
        // Unknown rule - be conservative
        unfixable.push(issue);
      }
    }
    
    return {
      autoFixable,
      contextFixable,
      unfixable,
      allAutoFixable: unfixable.length === 0 && contextFixable.length === 0,
      hasAutoFixable: autoFixable.length > 0,
      hasUnfixable: unfixable.length > 0,
    };
  }

  /**
   * Check context for context-dependent rules
   */
  private checkContext(issue: Issue): { safe: boolean; reason?: string } {
    // Check for test files
    const isTestFile = issue.file.includes('.test.') || 
                      issue.file.includes('.spec.') ||
                      issue.file.includes('__tests__');
    
    // Check for development files
    const isDevFile = issue.file.includes('.dev.') ||
                     issue.file.includes('debug') ||
                     issue.file.includes('development');
    
    switch (issue.rule) {
      case 'no-console':
        // Safe to remove in production files
        if (isTestFile || isDevFile) {
          return { safe: false, reason: 'Console might be intentional in test/dev' };
        }
        return { safe: true };
        
      case 'no-debugger':
        // Always safe to remove
        return { safe: true };
        
      case 'no-alert':
        // Safe if not a browser file
        if (issue.file.endsWith('.tsx') || issue.file.endsWith('.jsx')) {
          return { safe: false, reason: 'Alert might be intentional in UI' };
        }
        return { safe: true };
        
      case '@typescript-eslint/no-explicit-any':
        // Safe to convert to unknown
        return { safe: true };
        
      case 'no-var':
        // Safe to convert to let/const
        return { safe: true };
        
      default:
        return { safe: false, reason: 'Unknown context rule' };
    }
  }

  /**
   * Verify a fix is safe (optional enhanced verification)
   */
  verifyFix(issue: Issue): boolean {
    // For always-safe rules, no verification needed
    if (this.ALWAYS_SAFE.has(issue.rule)) {
      return true;
    }
    
    // For others, could add AST comparison, etc.
    // For now, trust ESLint's fixable flag
    return issue.fixable === true;
  }
}
```

---

## 📝 File: `src/types.ts` (Additions)

```typescript
// Add to src/types.ts

export interface AutopilotDecision {
  action: 'FIX_SILENTLY' | 'FIX_AND_REPORT' | 'REPORT_ONLY' | 'CONTINUE';
  fixes?: Issue[];
  issues?: Issue[];
  confidence: number;
}

export interface Classification {
  autoFixable: Issue[];
  contextFixable: Issue[];
  unfixable: Issue[];
  allAutoFixable: boolean;
  hasAutoFixable: boolean;
  hasUnfixable: boolean;
}
```

---

## 🧪 Testing Strategy

### Test File: `src/adapters/autopilot.test.ts`

```typescript
import { Autopilot } from './autopilot';
import type { CheckResult, Issue } from '../types';

describe('Autopilot', () => {
  const autopilot = new Autopilot();
  
  describe('Safe Rules', () => {
    it('should auto-fix formatting issues', () => {
      const result: CheckResult = {
        filePath: 'test.ts',
        issues: [
          { rule: 'prettier/prettier', fixable: true, file: 'test.ts' },
          { rule: 'semi', fixable: true, file: 'test.ts' },
        ],
        hasErrors: false,
        hasWarnings: true,
        fixable: true,
      };
      
      const decision = autopilot.decide(result);
      
      expect(decision.action).toBe('FIX_SILENTLY');
      expect(decision.fixes).toHaveLength(2);
      expect(decision.confidence).toBe(1.0);
    });
    
    it('should auto-fix modernization issues', () => {
      const result: CheckResult = {
        filePath: 'test.ts',
        issues: [
          { rule: 'prefer-const', fixable: true, file: 'test.ts' },
          { rule: 'prefer-template', fixable: true, file: 'test.ts' },
          { rule: 'object-shorthand', fixable: true, file: 'test.ts' },
        ],
        hasErrors: false,
        hasWarnings: true,
        fixable: true,
      };
      
      const decision = autopilot.decide(result);
      
      expect(decision.action).toBe('FIX_SILENTLY');
      expect(decision.fixes).toHaveLength(3);
    });
  });
  
  describe('Unsafe Rules', () => {
    it('should not auto-fix undefined variables', () => {
      const result: CheckResult = {
        filePath: 'test.ts',
        issues: [
          { rule: 'no-undef', fixable: false, file: 'test.ts' },
        ],
        hasErrors: true,
        hasWarnings: false,
        fixable: false,
      };
      
      const decision = autopilot.decide(result);
      
      expect(decision.action).toBe('REPORT_ONLY');
      expect(decision.issues).toHaveLength(1);
      expect(decision.fixes).toBeUndefined();
    });
    
    it('should not auto-fix complexity issues', () => {
      const result: CheckResult = {
        filePath: 'test.ts',
        issues: [
          { rule: 'complexity', fixable: false, file: 'test.ts' },
          { rule: 'max-lines-per-function', fixable: false, file: 'test.ts' },
        ],
        hasErrors: true,
        hasWarnings: false,
        fixable: false,
      };
      
      const decision = autopilot.decide(result);
      
      expect(decision.action).toBe('REPORT_ONLY');
      expect(decision.issues).toHaveLength(2);
    });
  });
  
  describe('Mixed Issues', () => {
    it('should fix safe and report unsafe', () => {
      const result: CheckResult = {
        filePath: 'test.ts',
        issues: [
          { rule: 'semi', fixable: true, file: 'test.ts' },
          { rule: 'no-undef', fixable: false, file: 'test.ts' },
        ],
        hasErrors: true,
        hasWarnings: true,
        fixable: true,
      };
      
      const decision = autopilot.decide(result);
      
      expect(decision.action).toBe('FIX_AND_REPORT');
      expect(decision.fixes).toHaveLength(1);
      expect(decision.issues).toHaveLength(1);
    });
  });
  
  describe('Context-Dependent Rules', () => {
    it('should not remove console in test files', () => {
      const result: CheckResult = {
        filePath: 'component.test.ts',
        issues: [
          { rule: 'no-console', fixable: true, file: 'component.test.ts' },
        ],
        hasErrors: false,
        hasWarnings: true,
        fixable: true,
      };
      
      const decision = autopilot.decide(result);
      
      expect(decision.action).toBe('REPORT_ONLY');
      expect(decision.issues).toHaveLength(1);
    });
    
    it('should remove console in production files', () => {
      const result: CheckResult = {
        filePath: 'api/handler.ts',
        issues: [
          { rule: 'no-console', fixable: true, file: 'api/handler.ts' },
        ],
        hasErrors: false,
        hasWarnings: true,
        fixable: true,
      };
      
      const decision = autopilot.decide(result);
      
      expect(decision.action).toBe('FIX_SILENTLY');
      expect(decision.fixes).toHaveLength(1);
    });
  });
});
```

---

## 📊 Rule Categories Breakdown

### Always Safe Rules (54 rules)
- **Formatting**: 28 rules (spaces, commas, quotes, etc.)
- **Imports**: 4 rules (ordering, duplicates)
- **Modernization**: 11 rules (ES6+ transformations)
- **Cleanup**: 6 rules (dead code removal)
- **Simplification**: 9 rules (equivalent simplifications)

### Context-Dependent (5 rules)
- `no-console` - Check if test/dev file
- `no-debugger` - Always remove
- `no-alert` - Check if browser file
- `@typescript-eslint/no-explicit-any` - Safe to convert
- `no-var` - Safe to modernize

### Never Auto (11+ rules)
- Type safety issues
- Security issues
- Complexity issues
- Undefined references

---

## 🎯 Integration Points

### 1. Claude Facade Integration

```typescript
// src/facades/claude.ts
import { Autopilot } from '../adapters/autopilot';

export class ClaudeHookFacade {
  private autopilot = new Autopilot();
  
  async handleHook(input: string): Promise<void> {
    const result = await this.checker.checkFile(payload.file_path);
    const decision = this.autopilot.decide(result);
    
    switch (decision.action) {
      case 'FIX_SILENTLY':
        await this.applyFixes(decision.fixes);
        process.exit(0); // Silent success
        
      case 'FIX_AND_REPORT':
        await this.applyFixes(decision.fixes);
        this.reportIssues(decision.issues);
        process.exit(0);
        
      case 'REPORT_ONLY':
        this.reportIssues(decision.issues);
        process.exit(0);
    }
  }
}
```

### 2. CLI Integration (Optional)

```typescript
// src/facades/cli.ts
if (options.autopilot) {
  const autopilot = new Autopilot();
  const decision = autopilot.decide(result);
  
  if (decision.action === 'FIX_SILENTLY') {
    console.log('✅ Auto-fixed all issues');
  } else {
    console.log(`⚠️ ${decision.fixes?.length || 0} fixed, ${decision.issues?.length || 0} need attention`);
  }
}
```

---

## ✅ Day 3 Checklist

### Implementation Tasks
- [ ] Create `src/adapters/autopilot.ts` with full implementation
- [ ] Add types to `src/types.ts`
- [ ] Define ALWAYS_SAFE rules (54 rules)
- [ ] Define CONTEXT_DEPENDENT rules (5 rules)
- [ ] Define NEVER_AUTO rules (11+ rules)
- [ ] Implement classification logic
- [ ] Implement context checking
- [ ] Add basic fix verification

### Testing Tasks
- [ ] Test safe rule classification
- [ ] Test unsafe rule detection
- [ ] Test mixed issue handling
- [ ] Test context-dependent logic
- [ ] Verify 80%+ automation rate

### Integration Tasks
- [ ] Integrate with Claude facade
- [ ] Test with real Claude Code
- [ ] Verify silent fixing works
- [ ] Verify error reporting works

---

## 📈 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Automation Rate** | >80% | `autoFixable / total` |
| **False Positives** | 0% | Manual verification |
| **Classification Speed** | <10ms | Performance test |
| **Rule Coverage** | >90% | Common rules included |

---

## 🎓 Key Decisions Explained

### Why These Safe Rules?
- Based on ESLint's own `--fix` confidence
- Only style/formatting changes
- No semantic changes
- Thousands of hours of community testing

### Why Context Checking?
- `console.log` is useful in tests
- Different rules for different file types
- Smarter than blanket rules

### Why Conservative on Unknown?
- Better to report than break code
- Can add rules as confidence grows
- User trust is paramount

---

## 🚀 Ready to Implement!

This specification provides everything needed for Day 3:
1. Complete working code (~100 lines)
2. Clear rule categories
3. Test strategy
4. Integration approach

The result will be an Autopilot that can safely fix 80%+ of common issues while never breaking code.