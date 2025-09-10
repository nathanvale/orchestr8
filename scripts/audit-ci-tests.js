#!/usr/bin/env tsx
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
class CITestAuditor {
  async discoverTestFiles(rootDir) {
    const testFiles = []
    const testsDir = path.join(rootDir, 'tests')
    try {
      const files = await this.findTestFiles(testsDir)
      for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf-8')
        const ciRelated = this.isCIRelated(content, filePath)
        const ciAspects = ciRelated ? this.extractCIAspects(content) : undefined
        testFiles.push({
          path: filePath,
          content,
          ciRelated,
          ciAspects,
        })
      }
    } catch (error) {
      console.error('Error discovering test files:', error)
    }
    return testFiles
  }
  async findTestFiles(dir) {
    const testFiles = []
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
  isCIRelated(content, filePath) {
    const fileName = path.basename(filePath).toLowerCase()
    const contentLower = content.toLowerCase()
    // Check filename for CI indicators
    const ciFileNamePatterns = [
      'ci',
      'workflow',
      'github',
      'pipeline',
      'adhd',
      'cognitive',
      'progressive',
      'turbo',
      'cache',
      'step-summar',
    ]
    // Check content for CI-related keywords
    const ciContentPatterns = [
      'workflow',
      'github actions',
      '.github/workflows',
      'jobs',
      'runs-on',
      'timeout-minutes',
      'emoji',
      '🔧',
      '⚡',
      '🎯',
      'tier',
      'smoke test',
      'focused test',
      'matrix',
      'parallel',
      'cache',
      'turbo',
      'adhd',
      'cognitive load',
    ]
    const isFileNameRelated = ciFileNamePatterns.some((pattern) => fileName.includes(pattern))
    const isContentRelated = ciContentPatterns.some((pattern) => contentLower.includes(pattern))
    return isFileNameRelated || isContentRelated
  }
  extractCIAspects(content) {
    const aspects = []
    const contentLower = content.toLowerCase()
    // Check for specific CI aspects
    if (contentLower.includes('job') || contentLower.includes('runs-on')) {
      aspects.push('GitHub Actions Jobs')
    }
    if (contentLower.includes('emoji') || content.includes('🔧') || content.includes('⚡')) {
      aspects.push('Emoji Indicators')
    }
    if (contentLower.includes('timeout')) {
      aspects.push('Timeout Limits')
    }
    if (contentLower.includes('tier') || contentLower.includes('progressive')) {
      aspects.push('Progressive Testing')
    }
    if (contentLower.includes('cache')) {
      aspects.push('Caching')
    }
    if (contentLower.includes('adhd') || contentLower.includes('cognitive')) {
      aspects.push('ADHD Optimization')
    }
    if (contentLower.includes('parallel')) {
      aspects.push('Parallel Execution')
    }
    if (contentLower.includes('matrix')) {
      aspects.push('Build Matrix')
    }
    return aspects
  }
  categorizeTests(files) {
    return files.map((file) => {
      const category = this.determineCategory(file)
      return {
        ...file,
        category,
      }
    })
  }
  determineCategory(file) {
    const content = file.content.toLowerCase()
    const fileName = path.basename(file.path)
    // MAJOR_REWRITE: Tests expecting 11+ jobs, complex features
    if (
      content.includes('11 jobs') ||
      content.includes('12 jobs') ||
      content.includes('expect(jobs.length).tobe(11)') ||
      content.includes('expect(jobs).tohaveLength(11)') ||
      fileName === 'ci-modular-jobs.integration.test.ts' ||
      fileName === 'ci-cd-pipeline.integration.test.ts'
    ) {
      return 'MAJOR_REWRITE'
    }
    // MODERATE_UPDATE: Tests needing significant changes but not complete rewrite
    if (
      content.includes('3-tier') ||
      content.includes('three tier') ||
      content.includes('tier-1') ||
      content.includes('tier-2') ||
      content.includes('tier-3') ||
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
    if (file.ciRelated) {
      return 'MINOR_ALIGNMENT'
    }
    return undefined
  }
  analyzeExpectedVsActual(file) {
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
  extractTestDescriptions(content) {
    const descriptions = []
    const describeRegex = /describe\(['"`](.*?)['"`]/g
    const itRegex = /it\(['"`](.*?)['"`]/g
    let match
    while ((match = describeRegex.exec(content)) !== null) {
      descriptions.push(match[1] || '')
    }
    while ((match = itRegex.exec(content)) !== null) {
      descriptions.push(match[1] || '')
    }
    return descriptions
  }
  analyzeActualBehavior(content) {
    const behaviors = []
    // Check for job count expectations
    const jobCountMatches = [
      content.match(/expect\(.*jobs.*\)\.toBe\((\d+)\)/),
      content.match(/expect\(.*jobs.*\)\.toHaveLength\((\d+)\)/),
      content.match(/expect\(.*length.*\)\.toBe\((\d+)\)/),
    ]
    for (const match of jobCountMatches) {
      if (match && match[1]) {
        behaviors.push(`Expects ${match[1]} jobs`)
        break
      }
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
    // Check for ADHD features
    if (content.includes('adhd') || content.includes('cognitive')) {
      behaviors.push('Tests ADHD optimizations')
    }
    return behaviors.length > 0 ? behaviors.join('; ') : 'General CI validation'
  }
  generateReport(files) {
    const ciRelatedFiles = files.filter((f) => f.ciRelated)
    const categorized = this.categorizeTests(ciRelatedFiles)
    const analyzed = categorized.map((f) => this.analyzeExpectedVsActual(f))
    console.log('\n=== CI TEST AUDIT REPORT ===\n')
    console.log(`Total test files found: ${files.length}`)
    console.log(`CI-related test files: ${ciRelatedFiles.length}`)
    console.log('\n--- CI-RELATED TEST FILES ---\n')
    const categories = {
      MAJOR_REWRITE: analyzed.filter((f) => f.category === 'MAJOR_REWRITE'),
      MODERATE_UPDATE: analyzed.filter((f) => f.category === 'MODERATE_UPDATE'),
      MINOR_ALIGNMENT: analyzed.filter((f) => f.category === 'MINOR_ALIGNMENT'),
      REMOVE: analyzed.filter((f) => f.category === 'REMOVE'),
      UNCATEGORIZED: analyzed.filter((f) => !f.category),
    }
    for (const [category, files] of Object.entries(categories)) {
      if (files.length > 0) {
        console.log(`\n${category} (${files.length} files):`)
        console.log('=' + '='.repeat(category.length + 10))
        for (const file of files) {
          const relativePath = path.relative(process.cwd(), file.path)
          console.log(`\n📄 ${relativePath}`)
          if (file.ciAspects && file.ciAspects.length > 0) {
            console.log(`   CI Aspects: ${file.ciAspects.join(', ')}`)
          }
          if (file.expectedBehavior) {
            const expected = file.expectedBehavior.split(';').slice(0, 3).join(';')
            console.log(
              `   Expected: ${expected}${file.expectedBehavior.split(';').length > 3 ? '...' : ''}`,
            )
          }
          if (file.actualBehavior) {
            console.log(`   Actual: ${file.actualBehavior}`)
          }
        }
      }
    }
    // Summary
    console.log('\n--- SUMMARY ---\n')
    console.log(`Files needing MAJOR REWRITE: ${categories.MAJOR_REWRITE.length}`)
    console.log(`Files needing MODERATE UPDATE: ${categories.MODERATE_UPDATE.length}`)
    console.log(`Files needing MINOR ALIGNMENT: ${categories.MINOR_ALIGNMENT.length}`)
    console.log(`Files to REMOVE: ${categories.REMOVE.length}`)
    console.log(`Uncategorized files: ${categories.UNCATEGORIZED.length}`)
    // Action items
    console.log('\n--- RECOMMENDED ACTIONS ---\n')
    if (categories.MAJOR_REWRITE.length > 0) {
      console.log('1. MAJOR REWRITES needed for:')
      categories.MAJOR_REWRITE.forEach((f) => {
        console.log(`   - ${path.basename(f.path)}: Update to 8-job structure`)
      })
    }
    if (categories.MODERATE_UPDATE.length > 0) {
      console.log('2. MODERATE UPDATES needed for:')
      categories.MODERATE_UPDATE.forEach((f) => {
        console.log(`   - ${path.basename(f.path)}: Change from 3-tier to 2-tier testing`)
      })
    }
    if (categories.MINOR_ALIGNMENT.length > 0) {
      console.log('3. MINOR ALIGNMENTS needed for:')
      console.log(`   - ${categories.MINOR_ALIGNMENT.length} files need emoji/timeout adjustments`)
    }
    if (categories.REMOVE.length > 0) {
      console.log('4. REMOVE obsolete tests:')
      categories.REMOVE.forEach((f) => {
        console.log(`   - ${path.basename(f.path)}`)
      })
    }
  }
}
// Main execution
async function main() {
  const auditor = new CITestAuditor()
  const projectRoot = process.cwd()
  console.log('Starting CI test audit...')
  console.log(`Project root: ${projectRoot}`)
  const files = await auditor.discoverTestFiles(projectRoot)
  auditor.generateReport(files)
}
main().catch(console.error)
