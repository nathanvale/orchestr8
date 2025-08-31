# Security Remediation Guide

> Critical security fixes with detailed implementation steps Version: 1.0.0
> Created: 2025-08-31

## Critical Issue: SBOM Generation Failure

### Current Status

- **Severity:** CRITICAL
- **Impact:** Breaks supply chain security compliance
- **Root Cause:** ESM/CommonJS compatibility issue in cdxgen execution
- **File:** `/scripts/security-scan.ts` (lines 707-717)
- **Error:** `ReferenceError: require is not defined`

### Detailed Fix Implementation

#### Step 1: Fix ESM Compatibility

**File:** `/scripts/security-scan.ts`

```typescript
// ❌ CURRENT BROKEN CODE (lines 707-717)
const cdxgenResult = spawnSync(
  'node',
  [
    '-e',
    `
    const { spawnSync } = require('child_process');
    const result = spawnSync('cdxgen', ['-o', '${sbomPath}', '-t', 'js', '.'], {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 16,
      timeout: 120000,
    });
    console.log(JSON.stringify(result));
  `,
  ],
  { encoding: 'utf-8', shell: true },
)

// ✅ FIXED VERSION - Direct execution without eval
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

function generateSbom(): SbomGenerationResult {
  const sbomPath = 'security-sbom.json'

  // Method 1: Try using npx first (most reliable)
  let result = spawnSync(
    'npx',
    ['@cyclonedx/cdxgen', '-o', sbomPath, '-t', 'js', '.'],
    {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 16,
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  )

  // Method 2: If npx fails, try direct cdxgen
  if (result.status !== 0) {
    const cdxgenPath = resolve('node_modules', '.bin', 'cdxgen')

    if (existsSync(cdxgenPath)) {
      result = spawnSync(cdxgenPath, ['-o', sbomPath, '-t', 'js', '.'], {
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 16,
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    }
  }

  // Method 3: Fallback to global cdxgen
  if (result.status !== 0) {
    result = spawnSync('cdxgen', ['-o', sbomPath, '-t', 'js', '.'], {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 16,
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  }

  if (result.status === 0 && existsSync(sbomPath)) {
    const sbomContent = readFileSync(sbomPath, 'utf-8')
    const sbom = JSON.parse(sbomContent)

    return {
      success: true,
      componentCount: sbom.components?.length ?? 0,
      format: sbom.bomFormat,
      version: sbom.specVersion,
      serialNumber: sbom.serialNumber,
      timestamp: sbom.metadata?.timestamp ?? new Date().toISOString(),
    }
  } else {
    return {
      success: false,
      error: result.stderr || result.error?.message || 'Unknown error',
      stdout: result.stdout?.substring(0, 500),
      stderr: result.stderr?.substring(0, 500),
    }
  }
}
```

#### Step 2: Add Proper Error Handling

```typescript
interface SbomGenerationResult {
  success: boolean
  componentCount?: number
  format?: string
  version?: string
  serialNumber?: string
  timestamp?: string
  error?: string
  stdout?: string
  stderr?: string
}

async function ensureCdxgenInstalled(): Promise<boolean> {
  try {
    // Check if cdxgen is available
    const checkResult = spawnSync('npx', ['@cyclonedx/cdxgen', '--version'], {
      encoding: 'utf-8',
      timeout: 10000,
    })

    if (checkResult.status !== 0) {
      console.log('Installing @cyclonedx/cdxgen...')
      const installResult = spawnSync(
        'npm',
        ['install', '-g', '@cyclonedx/cdxgen'],
        {
          encoding: 'utf-8',
          stdio: 'inherit',
        },
      )

      return installResult.status === 0
    }

    return true
  } catch (error) {
    console.error('Failed to check/install cdxgen:', error)
    return false
  }
}
```

#### Step 3: Validate SBOM Output

```typescript
function validateSbom(sbomPath: string): ValidationResult {
  if (!existsSync(sbomPath)) {
    return {
      valid: false,
      error: 'SBOM file not generated',
    }
  }

  try {
    const content = readFileSync(sbomPath, 'utf-8')
    const sbom = JSON.parse(content)

    // Validate CycloneDX format
    if (sbom.bomFormat !== 'CycloneDX') {
      return {
        valid: false,
        error: `Invalid BOM format: ${sbom.bomFormat}`,
      }
    }

    // Validate spec version
    if (!sbom.specVersion || !sbom.specVersion.startsWith('1.')) {
      return {
        valid: false,
        error: `Invalid spec version: ${sbom.specVersion}`,
      }
    }

    // Validate components array
    if (!Array.isArray(sbom.components)) {
      return {
        valid: false,
        error: 'Missing components array',
      }
    }

    // Validate minimum component count
    if (sbom.components.length < 100) {
      return {
        valid: false,
        error: `Suspiciously low component count: ${sbom.components.length}`,
      }
    }

    return {
      valid: true,
      componentCount: sbom.components.length,
      metadata: {
        bomFormat: sbom.bomFormat,
        specVersion: sbom.specVersion,
        serialNumber: sbom.serialNumber,
        timestamp: sbom.metadata?.timestamp,
        tools: sbom.metadata?.tools,
      },
    }
  } catch (error) {
    return {
      valid: false,
      error: `Failed to parse SBOM: ${error.message}`,
    }
  }
}
```

## Input Sanitization Patterns

### Pattern 1: Command Injection Prevention

**File:** `/scripts/lib/command-utils.ts` (to be created)

```typescript
import { spawn, SpawnOptions } from 'child_process'

/**
 * Safe command execution that prevents injection
 */
export function safeExecute(
  command: string,
  args: string[],
  options?: SpawnOptions,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    // Validate command doesn't contain shell metacharacters
    if (command.match(/[;&|<>$`\\]/)) {
      reject(new Error('Invalid command: contains shell metacharacters'))
      return
    }

    // Validate arguments don't contain injection attempts
    for (const arg of args) {
      if (typeof arg !== 'string') {
        reject(new Error('Invalid argument: must be string'))
        return
      }

      // Check for common injection patterns
      if (
        arg.includes('$(') ||
        arg.includes('`') ||
        arg.includes('&&') ||
        arg.includes('||')
      ) {
        reject(new Error(`Potentially unsafe argument: ${arg}`))
        return
      }
    }

    const child = spawn(command, args, {
      ...options,
      shell: false, // Never use shell mode
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 0 })
    })

    child.on('error', reject)
  })
}
```

### Pattern 2: Path Traversal Prevention

```typescript
import { resolve, relative, isAbsolute } from 'path'

export function safePath(userPath: string, basePath: string): string {
  // Resolve to absolute path
  const resolvedPath = resolve(basePath, userPath)

  // Ensure the resolved path is within the base path
  const relativePath = relative(basePath, resolvedPath)

  // Check for path traversal attempts
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error(`Path traversal attempt detected: ${userPath}`)
  }

  return resolvedPath
}

// Usage example
const safeFilePath = safePath(userInput, process.cwd())
```

## Supply Chain Security Enhancements

### Enhanced Vulnerability Scanning

**File:** `/scripts/lib/security/vulnerability-scanner.ts`

```typescript
import { execSync } from 'child_process'
import fetch from 'node-fetch'

export class VulnerabilityScanner {
  private scanners = [
    { name: 'npm audit', command: 'npm audit --json' },
    { name: 'pnpm audit', command: 'pnpm audit --json' },
    { name: 'osv-scanner', command: 'osv-scanner --format json --recursive .' },
    { name: 'trivy', command: 'trivy fs --format json --scanners vuln .' },
  ]

  async scanAll(): Promise<VulnerabilityReport> {
    const results: ScanResult[] = []

    for (const scanner of this.scanners) {
      try {
        const result = await this.runScanner(scanner)
        results.push(result)
      } catch (error) {
        console.warn(`Scanner ${scanner.name} failed:`, error.message)
      }
    }

    // Also check OSV.dev API directly
    const osvResults = await this.checkOsvApi()

    return this.consolidateResults([...results, osvResults])
  }

  private async runScanner(scanner: {
    name: string
    command: string
  }): Promise<ScanResult> {
    try {
      const output = execSync(scanner.command, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB
      })

      return {
        scanner: scanner.name,
        success: true,
        data: JSON.parse(output),
      }
    } catch (error) {
      return {
        scanner: scanner.name,
        success: false,
        error: error.message,
      }
    }
  }

  private async checkOsvApi(): Promise<ScanResult> {
    try {
      // Read package-lock.json or pnpm-lock.yaml
      const lockFile = this.readLockFile()
      const packages = this.extractPackages(lockFile)

      // Batch query OSV.dev
      const response = await fetch('https://api.osv.dev/v1/querybatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: packages.map((pkg) => ({
            package: { name: pkg.name, ecosystem: 'npm' },
            version: pkg.version,
          })),
        }),
      })

      const data = await response.json()

      return {
        scanner: 'OSV.dev API',
        success: true,
        data,
      }
    } catch (error) {
      return {
        scanner: 'OSV.dev API',
        success: false,
        error: error.message,
      }
    }
  }

  private consolidateResults(results: ScanResult[]): VulnerabilityReport {
    const vulnerabilities = new Map<string, Vulnerability>()

    for (const result of results) {
      if (result.success && result.data) {
        // Parse and merge vulnerabilities from different formats
        this.parseVulnerabilities(result, vulnerabilities)
      }
    }

    return {
      timestamp: new Date().toISOString(),
      scanners: results.map((r) => r.scanner),
      vulnerabilities: Array.from(vulnerabilities.values()),
      summary: this.calculateSummary(vulnerabilities),
    }
  }
}
```

### License Compliance Checking

```typescript
export class LicenseChecker {
  private allowedLicenses = [
    'MIT',
    'Apache-2.0',
    'BSD-3-Clause',
    'BSD-2-Clause',
    'ISC',
    'CC0-1.0',
    '0BSD',
    'Unlicense',
  ]

  private restrictedLicenses = ['GPL-3.0', 'GPL-2.0', 'AGPL-3.0', 'LGPL-3.0']

  async checkLicenses(): Promise<LicenseReport> {
    const packages = await this.getPackageLicenses()

    const violations: LicenseViolation[] = []
    const warnings: LicenseWarning[] = []

    for (const pkg of packages) {
      if (this.restrictedLicenses.includes(pkg.license)) {
        violations.push({
          package: pkg.name,
          version: pkg.version,
          license: pkg.license,
          severity: 'high',
          reason: 'Restricted license that may require source code disclosure',
        })
      } else if (!this.allowedLicenses.includes(pkg.license)) {
        warnings.push({
          package: pkg.name,
          version: pkg.version,
          license: pkg.license,
          reason: 'Unknown or uncommon license requires review',
        })
      }
    }

    return {
      timestamp: new Date().toISOString(),
      totalPackages: packages.length,
      violations,
      warnings,
      summary: {
        allowed: packages.filter((p) =>
          this.allowedLicenses.includes(p.license),
        ).length,
        restricted: violations.length,
        unknown: warnings.length,
      },
    }
  }

  private async getPackageLicenses(): Promise<PackageInfo[]> {
    const output = execSync('pnpm licenses list --json', { encoding: 'utf-8' })
    return JSON.parse(output)
  }
}
```

## Security Baseline Management

### Baseline Tracking System

**File:** `/scripts/lib/security/baseline-manager.ts`

```typescript
interface SecurityBaseline {
  timestamp: string
  vulnerabilities: {
    critical: string[]
    high: string[]
    moderate: string[]
    low: string[]
  }
  licenses: {
    allowed: string[]
    exceptions: string[]
  }
  sbom: {
    componentCount: number
    lastUpdated: string
  }
}

export class BaselineManager {
  private baselinePath = '.security-baseline.json'

  async loadBaseline(): Promise<SecurityBaseline | null> {
    try {
      const content = await fs.readFile(this.baselinePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  async updateBaseline(results: SecurityScanResults): Promise<void> {
    const baseline: SecurityBaseline = {
      timestamp: new Date().toISOString(),
      vulnerabilities: this.extractVulnerabilities(results),
      licenses: this.extractLicenses(results),
      sbom: this.extractSbomInfo(results),
    }

    await fs.writeFile(
      this.baselinePath,
      JSON.stringify(baseline, null, 2),
      'utf-8',
    )
  }

  async compareToBaseline(
    current: SecurityScanResults,
  ): Promise<ComparisonReport> {
    const baseline = await this.loadBaseline()

    if (!baseline) {
      return {
        isFirstRun: true,
        newVulnerabilities: [],
        fixedVulnerabilities: [],
        newLicenseViolations: [],
      }
    }

    return {
      isFirstRun: false,
      newVulnerabilities: this.findNewVulnerabilities(current, baseline),
      fixedVulnerabilities: this.findFixedVulnerabilities(current, baseline),
      newLicenseViolations: this.findNewLicenseViolations(current, baseline),
    }
  }
}
```

## Implementation Checklist

### Critical (Do First)

- [ ] Fix SBOM generation ESM issue
- [ ] Test SBOM output validation
- [ ] Verify component count >300

### High Priority

- [ ] Implement command sanitization
- [ ] Add path traversal prevention
- [ ] Setup vulnerability scanner

### Medium Priority

- [ ] Add license compliance checking
- [ ] Implement baseline tracking
- [ ] Setup OSV.dev API integration

## Testing the Fixes

```bash
# Test SBOM generation
node -e "
  const { spawnSync } = require('child_process');
  const result = spawnSync('npx', ['@cyclonedx/cdxgen', '--version'], {
    encoding: 'utf-8'
  });
  console.log('CycloneDX version:', result.stdout);
  console.log('Status:', result.status);
"

# Generate SBOM
npx @cyclonedx/cdxgen -o test-sbom.json -t js .

# Validate SBOM
node -e "
  const fs = require('fs');
  const sbom = JSON.parse(fs.readFileSync('test-sbom.json', 'utf-8'));
  console.log('Format:', sbom.bomFormat);
  console.log('Components:', sbom.components?.length);
  console.log('Valid:', sbom.bomFormat === 'CycloneDX' && sbom.components?.length > 100);
"

# Run security scan
pnpm run security:scan
```

## Success Criteria

1. SBOM generation produces valid CycloneDX format
2. Component count exceeds 300
3. All security scans pass without errors
4. No command injection vulnerabilities
5. License compliance validated
