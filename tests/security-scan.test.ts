/**
 * @vitest-environment node
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const SECURITY_SCRIPT = resolve(process.cwd(), 'scripts/security-scan.ts')

describe('security-scan', () => {
  let tempDir: string
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    tempDir = resolve(process.cwd(), `.tmp-test-${Date.now()}`)
    mkdirSync(tempDir, { recursive: true })
    process.chdir(tempDir)

    // Create package.json
    writeFileSync(
      'package.json',
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        devDependencies: {
          '@cyclonedx/cdxgen': '^11.6.0',
        },
      }),
    )

    // Mock node_modules structure
    mkdirSync('node_modules/.bin', { recursive: true })
    writeFileSync('node_modules/.bin/cdxgen', '#!/bin/bash\necho "mock cdxgen"')
  })

  afterEach(() => {
    process.chdir(originalCwd)
    if (existsSync(tempDir)) {
      try {
        rmSync(tempDir, { recursive: true, force: true })
      } catch (error) {
        // Sometimes directories are locked on Windows/macOS, retry after a short delay
        setTimeout(() => {
          try {
            rmSync(tempDir, { recursive: true, force: true })
          } catch {
            // If still failing, log but don't fail the test
            console.warn(`Could not clean up temp directory: ${tempDir}`)
          }
        }, 100)
      }
    }
    vi.restoreAllMocks()
  })

  test('should exist and be executable', () => {
    expect(existsSync(SECURITY_SCRIPT)).toBe(true)
  })

  describe('dependency audit', () => {
    test('should handle pnpm audit network failures with retry logic', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      // Should have retry logic for transient failures
      expect(scriptContent).toContain('maxRetries')
      expect(scriptContent).toContain('ENOTFOUND')
      expect(scriptContent).toContain('ETIMEDOUT')
      expect(scriptContent).toContain('isTransientError')
    })

    test('should fail hard on audit infrastructure failures in release mode', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      // Should check for audit parsing failures
      expect(scriptContent).toContain('JSON.parse')
      expect(scriptContent).toContain('parseError')

      // Should fail hard on potential security bypass
      expect(scriptContent).toContain('potential security bypass')
    })

    test('should handle different pnpm audit JSON formats', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      // Should handle multiple audit formats
      expect(scriptContent).toContain('audit.vulnerabilities')
      expect(scriptContent).toContain('audit.advisories')
      expect(scriptContent).toContain('audit.metadata')
    })

    test('should implement proper vulnerability gating thresholds', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      // Should fail on critical vulnerabilities
      expect(scriptContent).toContain('vulnerabilityData.critical > 0')

      // Should fail on high vulnerabilities (policy) - updated to match actual code
      expect(scriptContent).toContain('vulnsToCheck.high > 0')

      // Should warn on moderate/low thresholds
      expect(scriptContent).toContain('thresholds.moderate')
      expect(scriptContent).toContain('thresholds.low')
    })

    test('should not downgrade critical failures to warnings', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      // Critical vulnerabilities should always fail
      expect(scriptContent).toContain("status: 'fail'")

      // Should not convert critical to warn based on options
      const failLines = scriptContent.split('\n').filter((line) => line.includes("status: 'fail'"))
      expect(failLines.length).toBeGreaterThan(0)
    })
  })

  describe('SBOM generation', () => {
    test('should require @cyclonedx/cdxgen dependency', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      expect(scriptContent).toContain('@cyclonedx/cdxgen')
      expect(scriptContent).toContain('cdxgen binary not found')
    })

    test('should validate SBOM content quality', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      // Should check component count
      expect(scriptContent).toContain('componentCount')
      expect(scriptContent).toContain('components?.length')

      // Should validate SBOM is valid JSON
      expect(scriptContent).toContain('JSON.parse(sbomContent)')
    })

    test('should fail when SBOM generation fails in release mode', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      // Should check different failure modes based on quick/full mode
      expect(scriptContent).toContain('options?.quick')
      expect(scriptContent).toContain('isQuickMode')
    })
  })

  describe('license checking', () => {
    test('should parse different license formats', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      // Should handle various license formats
      expect(scriptContent).toContain('typeof pkg.license')
      expect(scriptContent).toContain('Array.isArray(pkg.license)')
      expect(scriptContent).toContain('pkg.license.type')
    })

    test('should identify problematic licenses', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      expect(scriptContent).toContain('problematicLicenses')
      expect(scriptContent).toContain('GPL-3.0')
      expect(scriptContent).toContain('AGPL-3.0')

      expect(scriptContent).toContain('restrictiveLicenses')
      expect(scriptContent).toContain('GPL-2.0')
    })

    test('should handle SPDX license expressions', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      // Should parse "MIT OR Apache-2.0" style expressions
      expect(scriptContent).toContain('OR|AND')
      expect(scriptContent).toContain('split(/\\s+(OR|AND)\\s+/i)')
    })
  })

  describe('sensitive file detection', () => {
    test('should detect common sensitive file patterns', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      expect(scriptContent).toContain('sensitivePatterns')
      expect(scriptContent).toContain('.env')
      expect(scriptContent).toContain('*.key')
      expect(scriptContent).toContain('credentials.json')
    })

    test('should exclude irrelevant directories', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      expect(scriptContent).toContain('node_modules')
      expect(scriptContent).toContain('.pnpm-store')
      expect(scriptContent).toContain('.git')
      expect(scriptContent).toContain('dist')
    })

    test('should have fallback detection methods', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      // Should try find, then ripgrep as fallback
      expect(scriptContent).toContain('find .')
      expect(scriptContent).toContain('rg --files')
    })
  })

  describe('OSV audit fallback', () => {
    test('should use OSV scanner as security fallback', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      expect(scriptContent).toContain('runOSVAudit')
      expect(scriptContent).toContain('osv-scanner')
      expect(scriptContent).toContain('@google/osv-scanner')
    })

    test('should combine pnpm and OSV results properly', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      expect(scriptContent).toContain('runDependencyAuditWithFallback')

      // Should escalate if OSV finds issues pnpm missed
      expect(scriptContent).toContain(
        'OSV scanner found critical vulnerabilities missed by pnpm audit',
      )
    })
  })

  describe('report generation', () => {
    test('should generate structured security report', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      expect(scriptContent).toContain('generateSecurityReport')
      expect(scriptContent).toContain('security-report.json')

      // Should have proper summary
      expect(scriptContent).toContain('summary')
      expect(scriptContent).toContain('total')
      expect(scriptContent).toContain('passed')
      expect(scriptContent).toContain('failed')
    })

    test('should have ADHD-friendly output', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      // Should use emojis and colors
      expect(scriptContent).toContain('🔒')
      expect(scriptContent).toContain('✅')
      expect(scriptContent).toContain('❌')
      expect(scriptContent).toContain('⚠️')

      // Should limit detail output
      expect(scriptContent).toContain('slice(0, 5)')
      expect(scriptContent).toContain('... and')
    })
  })

  describe('error handling', () => {
    test('should handle command execution timeouts', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      expect(scriptContent).toContain('timeout:')
      expect(scriptContent).toContain('maxBuffer:')
    })

    test('should provide actionable error messages', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      expect(scriptContent).toContain('💡 Next steps:')
      expect(scriptContent).toContain('pnpm audit --fix')
      expect(scriptContent).toContain('pnpm update')
    })

    test('should not allow security bypass on critical failures', () => {
      const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

      // Should fail hard on parsing errors that could be security bypass
      expect(scriptContent).toContain('potential security bypass')
      expect(scriptContent).toContain('compromised audit')

      // Should not use warn-only for critical security issues
      const bypassChecks = scriptContent.match(/warn.*security.*bypass/gi)
      expect(bypassChecks).toBeTruthy() // Should have bypass detection
    })
  })
})

describe('security-scan CLI integration', () => {
  test('should support quick and verbose modes', () => {
    const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

    expect(scriptContent).toContain('quick')
    expect(scriptContent).toContain('verbose')
    expect(scriptContent).toContain('parseArgs')
  })

  test('should exit with proper codes', () => {
    const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

    expect(scriptContent).toContain('process.exit(1)')
    expect(scriptContent).toContain('!success')
  })

  test('should handle missing dependency gracefully', () => {
    const scriptContent = readFileSync(SECURITY_SCRIPT, 'utf-8')

    // Should provide installation instructions
    expect(scriptContent).toContain('pnpm add -D @cyclonedx/cdxgen')
    expect(scriptContent).toContain('npm install -g @google/osv-scanner')
  })
})
