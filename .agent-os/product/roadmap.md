# Product Roadmap

> Last Updated: 2025-09-09 Version: 1.2.0

## Phase 1: MVP - Working Implementation (Week 1)

**Goal:** Ship working quality enforcement with 80% automation rate **Success
Criteria:** Claude autopilot successfully fixes 80%+ of common issues without
interruption

### Features

- [x] Refactor quality-check package to facade pattern - Convert 3000+ lines to
      ~440 lines `M`
- [x] Create Claude hook wrapper - Thin ~50 line integration layer `S`
- [x] Implement autopilot engine - Classification and auto-fix logic `S`
- [x] Add conditional logic - Smart file type detection `XS`
- [x] Deploy to ~/.claude/hooks - Production deployment `XS`
- [x] Create basic metrics tracking - Count automation successes `S`
- [x] Test with real workflows - Validate 80% automation target `S`

### Dependencies

- Existing @template/quality-check package
- Claude Code PostToolUse hook support
- ESLint and Prettier configurations

## Phase 2: Quality Checker Uplift (Week 2) ✅

**Goal:** Replace CLI-based checks with programmatic APIs and file-scoped TS
validation   **Success Criteria:** 50% faster checks, sub-300ms warm TypeScript
runs, stable JSON outputs for CI

### Features

- [x] Implement ESLint Node API integration with flat config (v9) `M`
- [x] Implement Prettier Node API integration with resolveConfig + getFileInfo
      `S`
- [x] Add file-scoped TypeScript checks with incremental compile cache `M`
- [x] Add JSON + stylish reporters for CI vs local dev `S`
- [x] Integrate with GitIntegration for `--staged` / `--since` workflows `S`
- [x] Add structured logging fields for duration, counts, cache hits `S`

**Completed:** 2025-09-08 via quality-checker-v2-migration Phase 3  
**Implementation:** V2 architecture with TypeScriptEngine, ESLintEngine,
PrettierEngine using Node APIs

## Phase 3: Learning System (Week 2-3)

**Goal:** Build pattern detection to improve automation over time **Success
Criteria:** System identifies and tracks recurring error patterns

### Features

- [ ] Implement pattern tracker - SQLite storage for error patterns `M`
- [ ] Create learning algorithm - Pattern recognition logic `L`
- [ ] Build rule generator - Convert patterns to prevention rules `M`
- [ ] Add feedback loop - Learn from fix success/failure `M`
- [ ] Create pattern dashboard - Visualize detected patterns `M`

### Dependencies

- SQLite database setup
- Pattern analysis algorithm
- Phase 1 completion

## Phase 4: Developer Experience (Week 4-5)

**Goal:** Enhance education and progressive learning features **Success
Criteria:** 50% reduction in repeat errors, improved developer satisfaction

### Features

- [ ] Build contextual education system - In-the-moment explanations `L`
- [ ] Create progressive learning paths - Graduated complexity `L`
- [ ] Add team configuration system - Shared rule preferences `M`
- [ ] Implement metrics dashboard - Team-wide insights `L`
- [ ] Create VS Code extension - IDE integration `XL`

### Dependencies

- Learning system from Phase 2
- Team feedback and iteration
- VS Code Extension API
