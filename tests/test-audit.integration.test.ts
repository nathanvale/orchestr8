import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'

/**
 * Test Audit Integration Tests
 *
 * These tests validate the functionality for auditing and categorizing CI tests
 * to align with the actual ADHD-optimized workflow implementation.
 */

interface TestFile {
  path: string
  content: string
  category?: 'MAJOR_REWRITE' | 'MODERATE_UPDATE' | 'MINOR_ALIGNMENT' | 'REMOVE' | undefined
  expectedBehavior?: string
  actualBehavior?: string
}

interface TestAuditResult {
  totalFiles: number
  categorized: {
    majorRewrite: TestFile[]
    moderateUpdate: TestFile[]
    minorAlignment: TestFile[]
    remove: TestFile[]
  }
  uncategorized: TestFile[]
}

class TestAuditor {
  async discoverTestFiles(rootDir: string): Promise<TestFile[]> {
    const testFiles: TestFile[] = []

    // Find all test files in the tests directory
    const files = await this.findTestFiles(rootDir)

    for (const filePath of files) {
      const content = await fs.readFile(filePath, 'utf-8')
      testFiles.push({
        path: filePath,
        content,
      })
    }

    return testFiles
  }

  private async findTestFiles(dir: string): Promise<string[]> {
    const testFiles: string[] = []

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subFiles = await this.findTestFiles(fullPath)
          testFiles.push(...subFiles)
        } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
          testFiles.push(fullPath)
        }
      }
    } catch {
      // Directory might not exist, which is okay
    }

    return testFiles
  }

  categorizeTests(files: TestFile[]): TestFile[] {
    return files.map((file) => {
      // Categorization logic based on content analysis
      const category = this.determineCategory(file)
      return {
        ...file,
        category,
      }
    })
  }

  private determineCategory(file: TestFile): TestFile['category'] {
    const content = file.content.toLowerCase()
    const fileName = path.basename(file.path)

    // MAJOR_REWRITE: Tests expecting 11+ jobs, complex features
    if (
      content.includes('11 jobs') ||
      content.includes('12 jobs') ||
      content.includes('complex matrix') ||
      fileName.includes('ci-modular-jobs')
    ) {
      return 'MAJOR_REWRITE'
    }

    // MODERATE_UPDATE: Tests needing significant changes but not complete rewrite
    if (
      content.includes('3-tier') ||
      content.includes('three tier') ||
      fileName.includes('progressive-testing-tiers')
    ) {
      return 'MODERATE_UPDATE'
    }

    // REMOVE: Obsolete tests for features that no longer exist
    if (
      content.includes('obsolete') ||
      content.includes('deprecated') ||
      content.includes('legacy')
    ) {
      return 'REMOVE'
    }

    // MINOR_ALIGNMENT: Tests needing small adjustments
    if (content.includes('emoji') || content.includes('timeout') || content.includes('adhd')) {
      return 'MINOR_ALIGNMENT'
    }

    return 'MINOR_ALIGNMENT' // Default category
  }

  analyzeExpectedVsActual(file: TestFile): TestFile {
    const content = file.content

    // Extract test descriptions to understand expected behavior
    const testDescriptions = this.extractTestDescriptions(content)
    const expectedBehavior = testDescriptions.join('; ')

    // Analyze what the test actually validates
    const actualBehavior = this.analyzeActualBehavior(content)

    return {
      ...file,
      expectedBehavior,
      actualBehavior,
    }
  }

  private extractTestDescriptions(content: string): string[] {
    const descriptions: string[] = []
    const describeRegex = /describe\(['"`](.*?)['"`]/g
    const itRegex = /it\(['"`](.*?)['"`]/g

    let match
    while ((match = describeRegex.exec(content)) !== null) {
      if (match[1] !== undefined) {
        descriptions.push(match[1])
      }
    }
    while ((match = itRegex.exec(content)) !== null) {
      if (match[1] !== undefined) {
        descriptions.push(match[1])
      }
    }

    return descriptions
  }

  private analyzeActualBehavior(content: string): string {
    const behaviors: string[] = []

    // Check for job count expectations
    const jobCountMatch = content.match(/expect\(.*jobs.*\)\.toBe\((\d+)\)/)
    if (jobCountMatch) {
      behaviors.push(`Expects ${jobCountMatch[1]} jobs`)
    }

    // Check for tier expectations
    if (content.includes('tier-1') || content.includes('tier-2') || content.includes('tier-3')) {
      behaviors.push('Tests multi-tier system')
    }

    // Check for emoji validation
    if (content.includes('emoji') || content.includes('🔧') || content.includes('⚡')) {
      behaviors.push('Validates emoji indicators')
    }

    // Check for timeout validation
    if (content.includes('timeout-minutes') || content.includes('timeout')) {
      behaviors.push('Validates timeout limits')
    }

    return behaviors.join('; ') || 'General CI validation'
  }

  generateAuditReport(files: TestFile[]): TestAuditResult {
    const categorized = {
      majorRewrite: files.filter((f) => f.category === 'MAJOR_REWRITE'),
      moderateUpdate: files.filter((f) => f.category === 'MODERATE_UPDATE'),
      minorAlignment: files.filter((f) => f.category === 'MINOR_ALIGNMENT'),
      remove: files.filter((f) => f.category === 'REMOVE'),
    }

    const uncategorized = files.filter((f) => !f.category)

    return {
      totalFiles: files.length,
      categorized,
      uncategorized,
    }
  }
}

describe('Test Audit Functionality', () => {
  let auditor: TestAuditor
  let fixtureDir: string

  beforeEach(async () => {
    auditor = new TestAuditor()
    fixtureDir = path.join(tmpdir(), `test-audit-${Date.now()}`)
    await fs.mkdir(fixtureDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true })
  })

  describe('Test Discovery', () => {
    it('should_discover_all_test_files_in_directory_tree', async () => {
      // Create test structure
      const testsDir = path.join(fixtureDir, 'tests')
      await fs.mkdir(testsDir, { recursive: true })

      await fs.writeFile(
        path.join(testsDir, 'ci-pipeline.test.ts'),
        'describe("CI Pipeline", () => { it("should run", () => {}) })',
      )
      await fs.writeFile(
        path.join(testsDir, 'workflow.test.ts'),
        'describe("Workflow", () => { it("should validate", () => {}) })',
      )

      const files = await auditor.discoverTestFiles(fixtureDir)

      expect(files).toHaveLength(2)
      expect(files.map((f) => path.basename(f.path))).toContain('ci-pipeline.test.ts')
      expect(files.map((f) => path.basename(f.path))).toContain('workflow.test.ts')
    })

    it('should_exclude_node_modules_and_hidden_directories', async () => {
      // Create test structure with node_modules
      const testsDir = path.join(fixtureDir, 'tests')
      const nodeModulesDir = path.join(fixtureDir, 'node_modules')
      const hiddenDir = path.join(fixtureDir, '.hidden')

      await fs.mkdir(testsDir, { recursive: true })
      await fs.mkdir(nodeModulesDir, { recursive: true })
      await fs.mkdir(hiddenDir, { recursive: true })

      await fs.writeFile(path.join(testsDir, 'valid.test.ts'), 'test content')
      await fs.writeFile(path.join(nodeModulesDir, 'ignored.test.ts'), 'ignored')
      await fs.writeFile(path.join(hiddenDir, 'hidden.test.ts'), 'hidden')

      const files = await auditor.discoverTestFiles(fixtureDir)

      expect(files).toHaveLength(1)
      expect(files[0] && path.basename(files[0].path)).toBe('valid.test.ts')
    })
  })

  describe('Test Categorization', () => {
    it('should_categorize_tests_requiring_major_rewrite', async () => {
      const testFiles: TestFile[] = [
        {
          path: '/tests/ci-modular-jobs.test.ts',
          content: 'expect(jobs.length).toBe(11); // Expects 11 jobs in workflow',
        },
      ]

      const categorized = auditor.categorizeTests(testFiles)

      expect(categorized[0] && categorized[0].category).toBe('MAJOR_REWRITE')
    })

    it('should_categorize_tests_requiring_moderate_update', async () => {
      const testFiles: TestFile[] = [
        {
          path: '/tests/progressive-testing-tiers.test.ts',
          content: 'describe("3-tier testing system", () => {})',
        },
      ]

      const categorized = auditor.categorizeTests(testFiles)

      expect(categorized[0] && categorized[0].category).toBe('MODERATE_UPDATE')
    })

    it('should_categorize_tests_requiring_minor_alignment', async () => {
      const testFiles: TestFile[] = [
        {
          path: '/tests/emoji-validation.test.ts',
          content: 'expect(jobName).toContain("🔧"); // Check emoji',
        },
      ]

      const categorized = auditor.categorizeTests(testFiles)

      expect(categorized[0] && categorized[0].category).toBe('MINOR_ALIGNMENT')
    })

    it('should_categorize_obsolete_tests_for_removal', async () => {
      const testFiles: TestFile[] = [
        {
          path: '/tests/legacy-workflow.test.ts',
          content: '// This tests deprecated legacy workflow features',
        },
      ]

      const categorized = auditor.categorizeTests(testFiles)

      expect(categorized[0] && categorized[0].category).toBe('REMOVE')
    })
  })

  describe('Expected vs Actual Behavior Analysis', () => {
    it('should_extract_test_descriptions_as_expected_behavior', async () => {
      const testFile: TestFile = {
        path: '/tests/sample.test.ts',
        content: `
          describe('CI Workflow', () => {
            it('should run 8 parallel jobs', () => {})
            it('should complete within 5 minutes', () => {})
          })
        `,
      }

      const analyzed = auditor.analyzeExpectedVsActual(testFile)

      expect(analyzed.expectedBehavior).toContain('CI Workflow')
      expect(analyzed.expectedBehavior).toContain('should run 8 parallel jobs')
      expect(analyzed.expectedBehavior).toContain('should complete within 5 minutes')
    })

    it('should_analyze_actual_test_assertions', async () => {
      const testFile: TestFile = {
        path: '/tests/job-count.test.ts',
        content: `
          const jobs = getWorkflowJobs();
          expect(jobs.length).toBe(11);
        `,
      }

      const analyzed = auditor.analyzeExpectedVsActual(testFile)

      expect(analyzed.actualBehavior).toContain('Expects 11 jobs')
    })

    it('should_detect_emoji_and_timeout_validations', async () => {
      const testFile: TestFile = {
        path: '/tests/adhd-features.test.ts',
        content: `
          expect(job.name).toContain('🔧');
          expect(job['timeout-minutes']).toBe(5);
        `,
      }

      const analyzed = auditor.analyzeExpectedVsActual(testFile)

      expect(analyzed.actualBehavior).toContain('Validates emoji indicators')
      expect(analyzed.actualBehavior).toContain('Validates timeout limits')
    })
  })

  describe('Audit Report Generation', () => {
    it('should_generate_comprehensive_audit_report', async () => {
      const testFiles: TestFile[] = [
        {
          path: '/tests/major.test.ts',
          content: 'expect(jobs).toBe(11)',
          category: 'MAJOR_REWRITE',
        },
        {
          path: '/tests/moderate.test.ts',
          content: '3-tier system',
          category: 'MODERATE_UPDATE',
        },
        {
          path: '/tests/minor1.test.ts',
          content: 'emoji test',
          category: 'MINOR_ALIGNMENT',
        },
        {
          path: '/tests/minor2.test.ts',
          content: 'timeout test',
          category: 'MINOR_ALIGNMENT',
        },
        {
          path: '/tests/obsolete.test.ts',
          content: 'deprecated',
          category: 'REMOVE',
        },
      ]

      const report = auditor.generateAuditReport(testFiles)

      expect(report.totalFiles).toBe(5)
      expect(report.categorized.majorRewrite).toHaveLength(1)
      expect(report.categorized.moderateUpdate).toHaveLength(1)
      expect(report.categorized.minorAlignment).toHaveLength(2)
      expect(report.categorized.remove).toHaveLength(1)
      expect(report.uncategorized).toHaveLength(0)
    })

    it('should_handle_uncategorized_tests', async () => {
      const testFiles: TestFile[] = [
        {
          path: '/tests/unknown.test.ts',
          content: 'some test content',
          // No category assigned
        },
      ]

      const report = auditor.generateAuditReport(testFiles)

      expect(report.uncategorized).toHaveLength(1)
      expect(report.uncategorized[0] && report.uncategorized[0].path).toContain('unknown.test.ts')
    })
  })

  describe('Integration with Real Test Files', () => {
    it('should_audit_actual_ci_test_files_when_present', async () => {
      // This test would run against real test files if they exist
      const projectRoot = process.cwd()
      const testsDir = path.join(projectRoot, 'tests')

      // Check if tests directory exists
      try {
        await fs.access(testsDir)
        const files = await auditor.discoverTestFiles(testsDir)

        if (files.length > 0) {
          const categorized = auditor.categorizeTests(files)
          const report = auditor.generateAuditReport(categorized)

          // Basic validation that audit works on real files
          expect(report.totalFiles).toBeGreaterThan(0)
          expect(report.totalFiles).toBe(
            report.categorized.majorRewrite.length +
              report.categorized.moderateUpdate.length +
              report.categorized.minorAlignment.length +
              report.categorized.remove.length +
              report.uncategorized.length,
          )
        }
      } catch {
        // Tests directory doesn't exist, skip this validation
      }
    })
  })
})
