# Script Refactoring Guide

> Step-by-step guide for refactoring complex scripts into maintainable code
> Version: 1.0.0 Created: 2025-08-31

## Overview

This guide provides detailed refactoring patterns for the most complex scripts
in the codebase, showing how to break them down into smaller, testable, and
maintainable functions.

## Scripts Requiring Refactoring

### Complexity Analysis

1. `/scripts/security-scan.ts` - 700+ lines, multiple responsibilities
2. `/scripts/record-baselines.ts` - Complex logic, poor separation
3. `/scripts/export-map-linter.ts` - Nested conditions, hard to test
4. `/scripts/dx-status.ts` - Multiple concerns mixed together
5. `/scripts/validate-pre-release.ts` - Monolithic validation logic

## Script 1: Security Scan Refactoring

### Current Issues in `/scripts/security-scan.ts`

- Single file with 700+ lines
- Mixed concerns (SBOM, vulnerabilities, licenses)
- Deeply nested try-catch blocks
- Hard to test individual components

### Refactored Structure

```
scripts/
├── security-scan.ts (main orchestrator - 100 lines)
└── lib/
    └── security/
        ├── sbom-generator.ts
        ├── vulnerability-scanner.ts
        ├── license-checker.ts
        ├── baseline-manager.ts
        ├── report-generator.ts
        └── types.ts
```

### Refactored Main File

**File:** `/scripts/security-scan.ts` (refactored)

```typescript
import { Command } from 'commander'
import { SbomGenerator } from './lib/security/sbom-generator'
import { VulnerabilityScanner } from './lib/security/vulnerability-scanner'
import { LicenseChecker } from './lib/security/license-checker'
import { BaselineManager } from './lib/security/baseline-manager'
import { ReportGenerator } from './lib/security/report-generator'
import { logger } from './lib/logger'
import type {
  SecurityScanOptions,
  SecurityScanResult,
} from './lib/security/types'

class SecurityScanner {
  private sbomGenerator: SbomGenerator
  private vulnScanner: VulnerabilityScanner
  private licenseChecker: LicenseChecker
  private baselineManager: BaselineManager
  private reportGenerator: ReportGenerator

  constructor() {
    this.sbomGenerator = new SbomGenerator()
    this.vulnScanner = new VulnerabilityScanner()
    this.licenseChecker = new LicenseChecker()
    this.baselineManager = new BaselineManager()
    this.reportGenerator = new ReportGenerator()
  }

  async scan(options: SecurityScanOptions): Promise<SecurityScanResult> {
    logger.info('Starting security scan', { options })

    const tasks = [
      { name: 'SBOM Generation', fn: () => this.sbomGenerator.generate() },
      { name: 'Vulnerability Scan', fn: () => this.vulnScanner.scan() },
      { name: 'License Check', fn: () => this.licenseChecker.check() },
    ]

    const results = await this.runTasks(tasks)

    if (options.updateBaseline) {
      await this.baselineManager.update(results)
    }

    const report = await this.reportGenerator.generate(results, options)

    return report
  }

  private async runTasks(
    tasks: Array<{ name: string; fn: () => Promise<any> }>,
  ) {
    const results: Record<string, any> = {}

    for (const task of tasks) {
      try {
        logger.info(`Running: ${task.name}`)
        results[task.name] = await task.fn()
        logger.success(`Completed: ${task.name}`)
      } catch (error) {
        logger.error(`Failed: ${task.name}`, error)
        results[task.name] = { error: error.message }
      }
    }

    return results
  }
}

// CLI setup
const program = new Command()
program
  .option('--update-baseline', 'Update security baseline')
  .option('--verbose', 'Verbose output')
  .option('--format <type>', 'Output format', 'json')
  .action(async (options) => {
    const scanner = new SecurityScanner()
    const result = await scanner.scan(options)
    console.log(JSON.stringify(result, null, 2))
  })

program.parse()
```

### SBOM Generator Module

**File:** `/scripts/lib/security/sbom-generator.ts`

```typescript
import { execSync } from 'child_process'
import { promises as fs } from 'fs'
import { logger } from '../logger'
import { NetworkError, FileSystemError } from '../errors'
import type { SbomResult } from './types'

export class SbomGenerator {
  private readonly sbomPath = 'security-sbom.json'
  private readonly timeout = 120000 // 2 minutes

  async generate(): Promise<SbomResult> {
    try {
      await this.runCdxgen()
      const sbom = await this.validateSbom()
      return {
        success: true,
        componentCount: sbom.components?.length ?? 0,
        path: this.sbomPath,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      logger.error('SBOM generation failed', error)
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }
    }
  }

  private async runCdxgen(): Promise<void> {
    const command = `npx @cyclonedx/cdxgen -o ${this.sbomPath} -t js .`

    try {
      execSync(command, {
        encoding: 'utf-8',
        timeout: this.timeout,
        stdio: 'pipe',
      })
    } catch (error) {
      throw new Error(`SBOM generation command failed: ${error.message}`)
    }
  }

  private async validateSbom(): Promise<any> {
    const content = await fs.readFile(this.sbomPath, 'utf-8')
    const sbom = JSON.parse(content)

    if (!sbom.bomFormat || sbom.bomFormat !== 'CycloneDX') {
      throw new Error('Invalid SBOM format')
    }

    if (!sbom.components || !Array.isArray(sbom.components)) {
      throw new Error('SBOM missing components array')
    }

    return sbom
  }
}
```

## Script 2: Package.json Script Organization

### Current Issue

94+ scripts in flat structure making discovery difficult

### Refactored Approach

**File:** `/scripts/lib/script-manager.ts`

```typescript
interface ScriptCategory {
  name: string
  description: string
  emoji: string
  scripts: ScriptDefinition[]
}

interface ScriptDefinition {
  name: string
  command: string
  description: string
  aliases?: string[]
}

export class ScriptManager {
  private categories: ScriptCategory[] = [
    {
      name: 'Core Development',
      description: 'Essential development commands',
      emoji: '🚀',
      scripts: [
        {
          name: 'dev',
          command: 'turbo dev',
          description: 'Start development server',
          aliases: ['start', 'd'],
        },
        {
          name: 'dev:all',
          command: 'node scripts/dev-orchestrator.js',
          description: 'Start all services',
          aliases: ['da'],
        },
        {
          name: 'build',
          command: 'turbo build',
          description: 'Build all packages',
          aliases: ['b'],
        },
        {
          name: 'test',
          command: 'vitest',
          description: 'Run tests',
          aliases: ['t'],
        },
      ],
    },
    {
      name: 'DX Tools',
      description: 'Developer experience utilities',
      emoji: '🛠️',
      scripts: [
        {
          name: 'dx:status',
          command: 'node scripts/dx-status.js',
          description: 'Show project status',
          aliases: ['status', 's'],
        },
        {
          name: 'dx:help',
          command: 'node scripts/interactive-help.js',
          description: 'Interactive command explorer',
          aliases: ['help', 'h', '?'],
        },
      ],
    },
    {
      name: 'Testing & Quality',
      description: 'Testing and code quality commands',
      emoji: '✅',
      scripts: [
        {
          name: 'test:watch',
          command: 'vitest watch',
          description: 'Run tests in watch mode',
        },
        {
          name: 'test:coverage',
          command: 'vitest run --coverage',
          description: 'Run tests with coverage',
        },
        {
          name: 'lint',
          command: 'eslint . --cache',
          description: 'Lint code',
        },
        {
          name: 'typecheck',
          command: 'tsc --noEmit',
          description: 'Type check code',
        },
      ],
    },
    {
      name: 'Release Management',
      description: 'Version and release commands',
      emoji: '📦',
      scripts: [
        {
          name: 'changeset',
          command: 'changeset',
          description: 'Create a changeset',
        },
        {
          name: 'version',
          command: 'changeset version',
          description: 'Version packages',
        },
        {
          name: 'release',
          command: 'pnpm build && changeset publish',
          description: 'Build and publish packages',
        },
      ],
    },
    {
      name: 'Security',
      description: 'Security scanning and auditing',
      emoji: '🔒',
      scripts: [
        {
          name: 'security:scan',
          command: 'node scripts/security-scan.js',
          description: 'Run security scan',
        },
        {
          name: 'audit',
          command: 'pnpm audit',
          description: 'Audit dependencies',
        },
      ],
    },
  ]

  findScript(query: string): ScriptDefinition | undefined {
    for (const category of this.categories) {
      for (const script of category.scripts) {
        if (script.name === query || script.aliases?.includes(query)) {
          return script
        }
      }
    }
    return undefined
  }

  getAllScripts(): Record<string, string> {
    const scripts: Record<string, string> = {}

    for (const category of this.categories) {
      for (const script of category.scripts) {
        scripts[script.name] = script.command
        // Also add aliases
        if (script.aliases) {
          for (const alias of script.aliases) {
            scripts[alias] = script.command
          }
        }
      }
    }

    return scripts
  }

  getCategories(): ScriptCategory[] {
    return this.categories
  }
}
```

### Interactive Script Explorer

**File:** `/scripts/interactive-help.js`

```typescript
import inquirer from 'inquirer'
import chalk from 'chalk'
import { execSync } from 'child_process'
import { ScriptManager } from './lib/script-manager'

async function main() {
  const manager = new ScriptManager()
  const categories = manager.getCategories()

  console.log(chalk.cyan('\n🚀 Interactive Script Explorer\n'))

  const { category } = await inquirer.prompt([
    {
      type: 'list',
      name: 'category',
      message: 'Select a category:',
      choices: categories.map((cat) => ({
        name: `${cat.emoji} ${cat.name} - ${cat.description}`,
        value: cat,
      })),
    },
  ])

  const { script } = await inquirer.prompt([
    {
      type: 'list',
      name: 'script',
      message: 'Select a script to run:',
      choices: category.scripts.map((s) => ({
        name: `${s.name} - ${s.description}`,
        value: s,
      })),
    },
  ])

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Run "${script.command}"?`,
      default: true,
    },
  ])

  if (confirm) {
    console.log(chalk.green(`\n▶ Running: ${script.command}\n`))
    execSync(script.command, { stdio: 'inherit' })
  }
}

main().catch(console.error)
```

## Script 3: DX Status Refactoring

### Refactored DX Status

**File:** `/scripts/dx-status.ts` (refactored)

```typescript
import chalk from 'chalk'
import ora from 'ora'
import { StatusChecker } from './lib/dx/status-checker'
import { StatusFormatter } from './lib/dx/status-formatter'

async function main() {
  const spinner = ora('Gathering project status...').start()

  try {
    const checker = new StatusChecker()
    const formatter = new StatusFormatter()

    // Run all checks in parallel
    const [changesets, coverage, outdated, turboCache, gitStatus] =
      await Promise.all([
        checker.checkChangesets(),
        checker.checkCoverage(),
        checker.checkOutdated(),
        checker.checkTurboCache(),
        checker.checkGitStatus(),
      ])

    spinner.succeed('Status gathered successfully')

    // Format and display results
    console.log(formatter.formatHeader())
    console.log(formatter.formatChangesets(changesets))
    console.log(formatter.formatCoverage(coverage))
    console.log(formatter.formatOutdated(outdated))
    console.log(formatter.formatTurboCache(turboCache))
    console.log(formatter.formatGitStatus(gitStatus))
    console.log(formatter.formatFooter())
  } catch (error) {
    spinner.fail('Failed to gather status')
    console.error(error)
    process.exit(1)
  }
}

main()
```

**File:** `/scripts/lib/dx/status-checker.ts`

```typescript
import { execSync } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'

export class StatusChecker {
  async checkChangesets(): Promise<ChangesetStatus> {
    try {
      const changesetDir = '.changeset'
      const files = await fs.readdir(changesetDir)
      const changesets = files.filter(
        (f) => f.endsWith('.md') && f !== 'README.md',
      )

      return {
        count: changesets.length,
        files: changesets,
      }
    } catch {
      return { count: 0, files: [] }
    }
  }

  async checkCoverage(): Promise<CoverageStatus> {
    try {
      const coveragePath = 'coverage/coverage-summary.json'
      const content = await fs.readFile(coveragePath, 'utf-8')
      const summary = JSON.parse(content)

      return {
        lines: summary.total.lines.pct,
        branches: summary.total.branches.pct,
        functions: summary.total.functions.pct,
        statements: summary.total.statements.pct,
      }
    } catch {
      return null
    }
  }

  async checkOutdated(): Promise<OutdatedStatus> {
    try {
      const result = execSync('pnpm outdated --json', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      })

      const outdated = JSON.parse(result || '{}')
      const packages = Object.entries(outdated).map(
        ([name, info]: [string, any]) => ({
          name,
          current: info.current,
          wanted: info.wanted,
          latest: info.latest,
        }),
      )

      return {
        count: packages.length,
        packages: packages.slice(0, 5), // Top 5
      }
    } catch {
      return { count: 0, packages: [] }
    }
  }

  async checkTurboCache(): Promise<TurboCacheStatus> {
    try {
      const turboCacheDir = 'node_modules/.cache/turbo'
      const stats = await fs.stat(turboCacheDir)
      const files = await this.countFiles(turboCacheDir)

      return {
        exists: true,
        size: await this.getDirectorySize(turboCacheDir),
        entries: files,
      }
    } catch {
      return { exists: false, size: 0, entries: 0 }
    }
  }

  async checkGitStatus(): Promise<GitStatus> {
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf-8' })
      const lines = status.trim().split('\n').filter(Boolean)

      return {
        modified: lines.filter((l) => l.startsWith(' M')).length,
        untracked: lines.filter((l) => l.startsWith('??')).length,
        staged: lines.filter((l) => l.startsWith('M ') || l.startsWith('A '))
          .length,
      }
    } catch {
      return { modified: 0, untracked: 0, staged: 0 }
    }
  }

  private async countFiles(dir: string): Promise<number> {
    let count = 0
    const files = await fs.readdir(dir)

    for (const file of files) {
      const filePath = path.join(dir, file)
      const stats = await fs.stat(filePath)

      if (stats.isDirectory()) {
        count += await this.countFiles(filePath)
      } else {
        count++
      }
    }

    return count
  }

  private async getDirectorySize(dir: string): Promise<number> {
    // Implementation for directory size calculation
    return 0 // Simplified for example
  }
}
```

## Common Refactoring Patterns

### Pattern 1: Extract Complex Conditions

```typescript
// ❌ BEFORE - Complex nested conditions
if (
  options.verbose &&
  !options.quiet &&
  (options.format === 'json' || options.format === 'yaml')
) {
  if (results.length > 0 && results.some((r) => r.severity === 'high')) {
    // ... complex logic
  }
}

// ✅ AFTER - Extracted predicates
const shouldLog = options.verbose && !options.quiet
const hasStructuredFormat = ['json', 'yaml'].includes(options.format)
const hasHighSeverityResults =
  results.length > 0 && results.some((r) => r.severity === 'high')

if (shouldLog && hasStructuredFormat && hasHighSeverityResults) {
  handleHighSeverityResults(results, options)
}
```

### Pattern 2: Extract Data Transformation

```typescript
// ❌ BEFORE - Inline transformation
const output = results
  .map((r) => ({
    ...r,
    timestamp: new Date(r.timestamp).toISOString(),
    severity: r.severity.toUpperCase(),
    message: r.message.trim().replace(/\n/g, ' '),
  }))
  .filter((r) => r.severity !== 'LOW')

// ✅ AFTER - Named transformation functions
const normalizeResult = (result: RawResult): NormalizedResult => ({
  ...result,
  timestamp: new Date(result.timestamp).toISOString(),
  severity: result.severity.toUpperCase(),
  message: result.message.trim().replace(/\n/g, ' '),
})

const isSignificant = (result: NormalizedResult): boolean =>
  result.severity !== 'LOW'

const output = results.map(normalizeResult).filter(isSignificant)
```

### Pattern 3: Command Pattern for Actions

```typescript
// ❌ BEFORE - Switch statement with inline logic
switch (action) {
  case 'scan':
    // 50 lines of scan logic
    break
  case 'report':
    // 40 lines of report logic
    break
  case 'update':
    // 30 lines of update logic
    break
}

// ✅ AFTER - Command pattern
interface Command {
  execute(): Promise<void>
}

class ScanCommand implements Command {
  async execute(): Promise<void> {
    // Scan logic in dedicated class
  }
}

const commands: Record<string, Command> = {
  scan: new ScanCommand(),
  report: new ReportCommand(),
  update: new UpdateCommand(),
}

await commands[action]?.execute()
```

## Benefits of Refactoring

1. **Testability** - Each module can be tested independently
2. **Maintainability** - Changes are localized to specific modules
3. **Reusability** - Extracted utilities can be shared
4. **Readability** - Smaller, focused functions are easier to understand
5. **Performance** - Parallel execution where possible
