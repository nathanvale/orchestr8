/**
 * @vitest-environment node
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

describe('guardrails smoke tests', () => {
  const scriptsDir = resolve(process.cwd(), 'scripts')

  test('pre-release-guardrails.ts should exist', () => {
    const scriptPath = resolve(scriptsDir, 'pre-release-guardrails.ts')
    expect(existsSync(scriptPath)).toBe(true)
  })

  test('changeset-validator.ts should exist', () => {
    const scriptPath = resolve(scriptsDir, 'changeset-validator.ts')
    expect(existsSync(scriptPath)).toBe(true)
  })

  test('security-scan.ts should exist', () => {
    const scriptPath = resolve(scriptsDir, 'security-scan.ts')
    expect(existsSync(scriptPath)).toBe(true)
  })

  test('pre-release-guardrails should have proper structure', () => {
    const scriptPath = resolve(scriptsDir, 'pre-release-guardrails.ts')
    const content = readFileSync(scriptPath, 'utf-8')

    // Should have critical guardrails
    expect(content).toContain('Changeset Validation')
    expect(content).toContain('Security Scan')

    // Should have proper error handling
    expect(content).toContain('process.exit(1)')

    // Should support ADHD-friendly features
    expect(content).toContain('quick')
    expect(content).toContain('verbose')

    // Should have caching
    expect(content).toContain('loadCache')
    expect(content).toContain('saveCache')

    // Should fail hard on missing critical scripts
    expect(content).toContain('isCriticalGuardrail')
    expect(content).toContain('Critical script')
    expect(content).toContain('not found - this will prevent release')
  })

  test('changeset-validator should have robust frontmatter parsing', () => {
    const scriptPath = resolve(scriptsDir, 'changeset-validator.ts')
    const content = readFileSync(scriptPath, 'utf-8')

    // Should parse frontmatter
    expect(content).toContain('parseChangeset')
    expect(content).toContain('frontmatter')

    // Should use gray-matter for robust YAML parsing (fixed!)
    expect(content).toContain('gray-matter')
    expect(content).toContain('matter(content)')

    // Should validate changesets match file changes
    expect(content).toContain('validateChangesetsMatchFiles')

    // Should check package.json changes
    expect(content).toContain('hasSignificantPackageJsonChanges')
    expect(content).toContain('significantFields')

    // Should validate freshness (this is a bug we'll fix)
    expect(content).toContain('validateChangesetFreshness')

    // Should provide actionable error messages
    expect(content).toContain('💡 Tips:')
    expect(content).toContain('pnpm changeset')
  })

  test('security-scan should have comprehensive security checks', () => {
    const scriptPath = resolve(scriptsDir, 'security-scan.ts')
    const content = readFileSync(scriptPath, 'utf-8')

    // Should have audit with retry logic
    expect(content).toContain('runDependencyAudit')
    expect(content).toContain('maxRetries')
    expect(content).toContain('isTransientError')

    // Should generate SBOM
    expect(content).toContain('generateSBOM')
    expect(content).toContain('@cyclonedx/cdxgen')

    // Should check licenses
    expect(content).toContain('checkLicenses')
    expect(content).toContain('problematicLicenses')

    // Should detect sensitive files
    expect(content).toContain('checkSensitiveFiles')
    expect(content).toContain('sensitivePatterns')

    // Should have OSV fallback
    expect(content).toContain('runOSVAudit')
    expect(content).toContain('osv-scanner')

    // Should not allow security bypass
    expect(content).toContain('potential security bypass')
    expect(content).toContain('compromised audit')

    // Should fail hard on critical issues
    expect(content).toContain('vulnerabilityData.critical > 0')
  })
})

describe('guardrails functionality verification', () => {
  describe('changeset-validator fixes verification', () => {
    test('uses robust gray-matter for YAML parsing', () => {
      const scriptPath = resolve(process.cwd(), 'scripts/changeset-validator.ts')
      const content = readFileSync(scriptPath, 'utf-8')

      // Should use gray-matter for robust YAML parsing
      expect(content).toContain("import matter from 'gray-matter'")
      expect(content).toContain('matter(content)')

      // Should not use fragile regex parsing
      expect(content).not.toContain('frontmatterMatch = content.match')
    })

    test('excludes non-consumer-affecting package.json changes', () => {
      const scriptPath = resolve(process.cwd(), 'scripts/changeset-validator.ts')
      const content = readFileSync(scriptPath, 'utf-8')

      // Should not include scripts in significant fields
      const hasScriptsInSignificant =
        content.includes('"scripts"') && content.includes('significantFields')
      expect(hasScriptsInSignificant).toBe(false)

      // Should have explanation for excluding scripts
      expect(content).toContain("scripts' excluded as they're typically dev convenience")
    })

    test('runs critical validations even with zero changesets', () => {
      const scriptPath = resolve(process.cwd(), 'scripts/changeset-validator.ts')
      const content = readFileSync(scriptPath, 'utf-8')

      // Should run validateRemovedPackages even with zero changesets
      const hasRemovedPackageValidation = content.includes('validateRemovedPackages(changesets)')
      expect(hasRemovedPackageValidation).toBe(true)

      // Should have comment explaining why this runs unconditionally
      expect(content).toContain('MUST run even with zero changesets')
    })

    test('has comprehensive CLI interface', () => {
      const scriptPath = resolve(process.cwd(), 'scripts/changeset-validator.ts')
      const content = readFileSync(scriptPath, 'utf-8')

      // Should have CLI argument parsing
      expect(content).toContain('parseArgs')
      expect(content).toContain('--help')
      expect(content).toContain('--verbose')
      expect(content).toContain('--fix')
      expect(content).toContain('--strict')

      // Should have help text and examples
      expect(content).toContain('Usage:')
      expect(content).toContain('Examples:')
    })

    test('uses shared git utilities to eliminate duplication', () => {
      const scriptPath = resolve(process.cwd(), 'scripts/changeset-validator.ts')
      const content = readFileSync(scriptPath, 'utf-8')

      // Should import shared git utilities
      expect(content).toContain('./lib/git-utils')
      expect(content).toContain('getBaseBranch')

      // Should not have inline git branch detection
      expect(content).not.toContain('git rev-parse --verify main')
    })
  })

  describe('security-scan fixes verification', () => {
    test('prevents security bypass in quick mode', () => {
      const scriptPath = resolve(process.cwd(), 'scripts/security-scan.ts')
      const content = readFileSync(scriptPath, 'utf-8')

      // Should not have warn fallbacks that bypass security
      const hasWarnFallbacks = content.includes("options.quick ? 'warn'")
      expect(hasWarnFallbacks).toBe(false)

      // Should always run SBOM generation
      expect(content).toContain('Always run SBOM generation')
      expect(content).toContain('critical for supply chain security')

      // Should have critical security failure guards
      expect(content).toContain('SECURITY: Always fail')
    })

    test('uses shared CLI utilities for consistent interface', () => {
      const scriptPath = resolve(process.cwd(), 'scripts/security-scan.ts')
      const content = readFileSync(scriptPath, 'utf-8')

      // Should import shared CLI utilities
      expect(content).toContain('./lib/cli-utils')
      expect(content).toContain('parseCliArgs')

      // Should not have inline parseArgs usage
      expect(content).not.toContain('parseArgs({')

      // Should use consistent CLI patterns
      expect(content).toContain('parseSecurityCliArgs')
    })
  })
})
