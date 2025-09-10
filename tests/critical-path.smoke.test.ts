/**
 * Critical Path Smoke Tests ⚡
 *
 * These tests validate the most essential functionality in under 30 seconds.
 * Focus: Critical user journeys and system health checks only.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

describe('Critical Path Smoke Tests ⚡', () => {
  describe('Essential Configuration', () => {
    it('should have valid package.json', () => {
      expect(existsSync('./package.json')).toBe(true)

      const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
      expect(pkg.name).toBeTruthy()
      expect(pkg.scripts).toBeTruthy()
      expect(pkg.scripts.test).toBeTruthy()
    })

    it('should have working TypeScript configuration', () => {
      expect(existsSync('./tsconfig.json')).toBe(true)

      // For smoke test, just check the file contains key TypeScript config markers
      const tsconfigContent = readFileSync('./tsconfig.json', 'utf-8')
      expect(tsconfigContent).toContain('compilerOptions')
      expect(tsconfigContent).toContain('strict')
      expect(tsconfigContent).toContain('include')
    })

    it('should have essential build tooling', () => {
      expect(existsSync('./turbo.json')).toBe(true)
      expect(existsSync('./vitest.config.ts')).toBe(true)
    })
  })

  describe('Progressive Testing Scripts', () => {
    it('should have all required test scripts available', () => {
      const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

      // Essential test scripts for progressive strategy
      expect(pkg.scripts['test:smoke']).toBeTruthy()
      expect(pkg.scripts['test:quick']).toBeTruthy()
      expect(pkg.scripts['test:focused']).toBeTruthy()
      expect(pkg.scripts['test:coverage']).toBeTruthy()
    })

    it('should have smoke test configuration with bail-fast', () => {
      const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
      const smokeScript = pkg.scripts['test:smoke']

      expect(smokeScript).toContain('--bail')
      expect(smokeScript).toContain('--no-coverage')
      expect(smokeScript).toContain('smoke.test')
    })
  })

  describe('CI Pipeline Health', () => {
    it('should have GitHub Actions workflow', () => {
      expect(existsSync('.github/workflows/ci.yml')).toBe(true)
    })

    it('should have essential workflow jobs', () => {
      const ciContent = readFileSync('.github/workflows/ci.yml', 'utf-8')

      // Critical jobs that must exist
      expect(ciContent).toContain('lint:')
      expect(ciContent).toContain('typecheck:')
      expect(ciContent).toContain('build:')
      expect(ciContent).toContain('test:')
    })
  })

  describe('Dependency Health', () => {
    it('should have critical dev dependencies', () => {
      const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

      // Essential tooling
      expect(pkg.devDependencies.vitest).toBeTruthy()
      expect(pkg.devDependencies.typescript).toBeTruthy()
      expect(pkg.devDependencies.turbo).toBeTruthy()
    })
  })
})
