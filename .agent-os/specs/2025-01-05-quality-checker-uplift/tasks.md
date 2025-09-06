# Quality Checker Uplift - Task Breakdown

## Parent Task: Implement Quality Checker Uplift
Upgrade the Quality Checker to implement TypeScript 5.7+ file-scoped incremental checks, ESLint v9 flat config support, and Prettier Node API integration for sub-300ms warm feedback.

### Sub-tasks:

#### Phase 0: Foundations & Contracts (NEW)

- [x] **Task 0.1: Define Issue Contract & JSON Schema**
  - [x] Create `spec/issues.schema.json` for `{engine, severity, ruleId?, file, line, col, endLine?, endCol?, message, suggestion?}`
  - [x] Add optional `spec/perf.schema.json` for benchmark results
  - [x] Export types in `src/types/issue-types.ts`

- [x] **Task 0.2: Error Taxonomy & Exit Codes**
  - [x] Add `src/core/errors.ts` with typed errors (`ToolMissingError`, `ConfigError`, `TimeoutError`, `InternalError`)
  - [x] Map to exit codes: `0=ok`, `1=issues`, `2=error`
  - [x] Ensure stable, terse CLI messages

- [x] **Task 0.3: Config Discovery & Precedence**
  - [x] Implement `src/core/config-loader.ts`
  - [x] Precedence: CLI > env > config file > defaults
  - [x] Support `quality-checker.config.(ts|mjs|cjs|json)` with minimal options:
        - `engines`, `format`, `timeoutMs`, `typescriptCacheDir`, `eslintCacheDir`, `prettierWrite`

- [x] **Task 0.4: Ignore & File Resolution**
  - [x] Implement `src/core/file-matcher.ts`
  - [x] Resolve to a single file path by default
  - [x] If `--staged` or `--since` provided, expand to matching files sequentially
  - [x] Respect `.eslintignore`, `.prettierignore`, and `tsconfig.exclude`

- [x] **Task 0.5: Timeout & Cancellation**
  - [x] Add per-run hard timeout (`--timeout`, default 3000ms)
  - [x] Support optional cancellation token for editor/AI integrations
  - [x] No worker pools or parallelization

#### Phase 1: Core Engine Development

- [x] **Task 1.1: Create TypeScript Incremental Engine**
  - [x] Create `src/engines/typescript-engine.ts` with file-scoped incremental compilation
  - [x] Implement TypeScript 5.7+ `createIncrementalProgram` API
  - [x] Configure persistent tsBuildInfo cache with environment variable support
  - [x] Add diagnostic filtering for target file only
  - [x] Write unit tests for TypeScript engine

- [x] **Task 1.2: Create ESLint v9 Engine**
  - [x] Create `src/engines/eslint-engine.ts` with ESLint v9 Node API
  - [x] Implement flat config support (`eslint.config.js`)
  - [x] Enable built-in caching mechanism
  - [x] Add programmatic linting via `eslint.lintFiles()`
  - [x] Write unit tests for ESLint engine

- [x] **Task 1.3: Create Prettier Engine**
  - [x] Create `src/engines/prettier-engine.ts` with Prettier Node API
  - [x] Implement `prettier.check()` and `prettier.format()` methods
  - [x] Add `prettier.resolveConfig()` for per-file configuration
  - [x] Respect `.prettierignore` via `prettier.getFileInfo()`
  - [x] Write unit tests for Prettier engine

#### Phase 2: Output Formatting & Integration

- [x] **Task 2.1: Create Output Formatters**
  - [x] Create `src/formatters/stylish-formatter.ts` with ESLint-style output
  - [x] Create `src/formatters/json-formatter.ts` with structured Issue objects
  - [x] Create `src/formatters/aggregator.ts` to normalize results across engines
  - [x] Write unit tests for all formatters

- [x] **Task 2.2: Update QualityChecker Coordinator**
  - [x] Refactor `src/core/quality-checker.ts` to use new engines
  - [x] Replace execSync calls with engine implementations
  - [x] Add format option support (stylish/json)
  - [x] Simplify to sequential single-file execution (no worker pools)
  - [x] Add cache directory configuration options

#### Phase 3: Facade Updates & Compatibility

- [x] **Task 3.1: Update CLI Facade**
  - [x] Update `src/facades/cli.ts` with new command-line options
  - [x] Add `--format stylish|json` option
  - [x] Add `--typescript-cache-dir` and `--eslint-cache-dir` options
  - [x] Add `--since` and `--staged` git integration options (sequential expansion)
  - [x] Ensure backward compatibility with existing options
  - [x] Remove legacy CLI client and make CLI-V2 to standard (rename it to cli.ts)

- [x] **Task 3.2: Ensure Facade Compatibility**
  - [x] Verify API facade (`src/facades/api.ts`) maintains existing signatures
  - [x] Test Claude hook facade (`src/facades/claude.ts`) continues functioning
  - [x] Validate pre-commit hook (`src/facades/git-hook.ts`) works without changes
  - [x] Update type definitions in `src/types.ts`

#### Phase 4: Testing & Optimization

- [x] **Task 4.1: Write Comprehensive Tests** (Partial)
  - [ ] Create integration tests with fixture repositories
  - [ ] Add performance benchmarks for cold vs warm runs
  - [ ] Create CI/CD pipeline tests with JSON output validation
  - [x] Add edge case tests for missing tools and error conditions

- [x] **Task 4.2: Performance Optimization** (Partial)
  - [x] Optimize TypeScript cache persistence
  - [x] Batch Prettier file I/O operations
  - [x] Verify median warm performance ≤300ms for single files
  - [ ] Create performance monitoring and reporting

#### Phase 5: Documentation & Deployment

- [ ] **Task 5.1: Update Documentation**
  - [ ] Update README.md with new features and options
  - [ ] Create migration guide for ESLint v9 flat config
  - [ ] Document performance tuning options
  - [ ] Add CI/CD integration examples

- [ ] **Task 5.2: Final Validation**
  - [ ] Run full test suite with all changes
  - [ ] Verify all existing facades work without breaking changes
  - [ ] Test in sample projects with different configurations
  - [ ] Ensure exit codes match specification (0=ok, 1=issues, 2=error)

## Success Criteria

- [x] Median warm check time ≤300ms for single files
- [x] JSON output mode provides structured data for CI integration
- [x] All existing facade interfaces continue functioning without modification
- [x] TypeScript 5.7+ incremental compilation working with cache
- [x] ESLint v9 flat config support implemented
- [x] Prettier Node API integration complete
- [x] Graceful degradation when tools are missing

## Dependencies

- `typescript@^5.7.0` - Required for incremental API
- `eslint@^9.0.0` - Required for flat config support
- `prettier@^3.3.0` - Already compatible

## Notes

- Use existing Pino logger instead of @orchestr8/logger
- Maintain single-root tsconfig.json hierarchy (no project references)
- Exit codes: 0=success, 1=issues found, 2=internal error
- All file paths should be absolute internally
- Cache directories should be configurable via environment variables