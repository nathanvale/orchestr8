# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-01-05-quality-checker-uplift/spec.md

## Core API Interface

### QualityChecker Class

```typescript
interface QualityCheckOptions {
  files?: string[];
  staged?: boolean;
  since?: string;
  fix?: boolean;
  format?: 'stylish' | 'json';
  typescriptCacheDir?: string;
  eslintCacheDir?: string;
}

interface QualityCheckResult {
  success: boolean;
  duration: number;
  errors: string[];
  warnings: string[];
  autofixes: string[];
  checkers: Record<string, CheckerResult>;
  correlationId?: string;
  issues?: Issue[]; // Only populated when format='json'
}

interface Issue {
  tool: 'typescript' | 'eslint' | 'prettier';
  file?: string;
  line?: number;
  col?: number;
  code?: string;
  severity: 'error' | 'warning';
  message: string;
}
```

### Main Methods

#### check(options: QualityCheckOptions): Promise<QualityCheckResult>

**Purpose:** Execute quality checks on specified files
**Parameters:** 
- `files`: Array of file paths to check
- `staged`: Check only staged git files
- `since`: Check files changed since git ref
- `fix`: Apply autofixes for ESLint and Prettier
- `format`: Output format (stylish for humans, json for CI)
- `typescriptCacheDir`: Custom TypeScript cache location
- `eslintCacheDir`: Custom ESLint cache location

**Response:** QualityCheckResult object with aggregated results
**Errors:** Throws on internal errors (exit code 2 scenarios)

#### validate(files: string[]): Promise<boolean>

**Purpose:** Simple validation check without detailed output
**Parameters:** Array of file paths to validate
**Response:** Boolean indicating if all checks passed
**Errors:** Returns false on validation errors, throws on internal errors

#### fix(files: string[]): Promise<string[]>

**Purpose:** Apply all available autofixes to specified files
**Parameters:** Array of file paths to fix
**Response:** Array of fixed file paths
**Errors:** Throws on file write errors

## Engine-Specific APIs

### TypeScriptEngine

#### checkFile(file: string, options: TSOptions): Promise<CheckerResult>

**Purpose:** Run file-scoped incremental TypeScript check
**Parameters:**
- `file`: Absolute path to TypeScript file
- `options`: Cache directory, tsconfig path

**Response:** CheckerResult with diagnostics
**Errors:** Returns error in result, doesn't throw

### ESLintEngine

#### lintFiles(files: string[], options: ESLintOptions): Promise<CheckerResult>

**Purpose:** Run ESLint v9 with flat config
**Parameters:**
- `files`: Array of file paths
- `options`: Fix mode, cache settings, format

**Response:** CheckerResult with violations
**Errors:** Returns error in result, doesn't throw

### PrettierEngine

#### checkFiles(files: string[], options: PrettierOptions): Promise<CheckerResult>

**Purpose:** Check Prettier formatting
**Parameters:**
- `files`: Array of file paths
- `options`: Fix mode, config path

**Response:** CheckerResult with formatting issues
**Errors:** Returns error in result, doesn't throw

## Facade Integration Points

### CLI Facade
```bash
qc [files...] [options]
qc src/foo.ts --fix
qc --staged --format json
qc --since origin/main
```

### Hook Facade
```javascript
// ~/.claude/hooks/quality-check.js
const { QualityChecker } = require('@template/quality-check');
const checker = new QualityChecker();
const result = await checker.check({ files, format: 'json' });
```

### Pre-commit Facade
```javascript
// .husky/pre-commit
const { QualityChecker } = require('@template/quality-check');
const checker = new QualityChecker();
const result = await checker.check({ staged: true });
process.exit(result.success ? 0 : 1);
```

### Programmatic API
```javascript
import { QualityChecker } from '@template/quality-check';

const checker = new QualityChecker();
const result = await checker.check({
  files: ['src/index.ts'],
  format: 'json',
  fix: false
});

if (!result.success) {
  console.error(result.issues);
}
```