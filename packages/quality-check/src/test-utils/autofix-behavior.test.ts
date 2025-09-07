/**
 * Auto-fix behavior tests using in-memory mocking
 * Replaces brittle process spawning with deterministic patterns
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MockedQualityChecker } from './api-wrappers.js'
import { AutoFixBehaviorFactory } from './modern-fixtures.js'
import { assertQualityResult, assertFixResult } from './assertion-helpers.js'

describe('Auto-Fix Behavior Tests - Modern Architecture', () => {
  let wrapper: MockedQualityChecker

  beforeEach(() => {
    wrapper = new MockedQualityChecker()
  })

  afterEach(() => {
    wrapper.cleanup()
  })

  describe('ESLint Auto-Fix Behavior', () => {
    it('should automatically fix ESLint violations under 100ms', async () => {
      // Arrange
      const fixture = AutoFixBehaviorFactory.createESLintAutoFixFixture()
      wrapper.loadFixture(fixture)
      
      // Act - Check initial state
      const startTime = Date.now()
      const initialResult = await wrapper.check(['src/eslint-fix.js'], { 
        eslint: true, 
        typescript: false, 
        prettier: false 
      })
      
      // Fix issues
      const fixResult = await wrapper.fix(['src/eslint-fix.js'], { 
        eslint: true, 
        typescript: false, 
        prettier: false,
        fix: true 
      })
      
      // Check after fix
      const finalResult = await wrapper.check(['src/eslint-fix.js'], { 
        eslint: true, 
        typescript: false, 
        prettier: false 
      })
      const executionTime = Date.now() - startTime
      
      // Assert
      expect(executionTime).toBeLessThan(100)
      
      // Initial state should have errors
      assertQualityResult(initialResult).shouldFail()
      
      // Fix should succeed
      assertFixResult(fixResult).shouldSucceed()
      expect(fixResult.count).toBeGreaterThan(0)
      
      // Final state should pass
      assertQualityResult(finalResult).shouldSucceed()
    })
  })

  describe('Prettier Auto-Fix Behavior', () => {
    it('should automatically format code with Prettier under 100ms', async () => {
      // Arrange
      const fixture = AutoFixBehaviorFactory.createPrettierAutoFixFixture()
      wrapper.loadFixture(fixture)
      
      // Act
      const startTime = Date.now()
      const initialResult = await wrapper.check(['src/prettier-fix.js'], { 
        prettier: true, 
        eslint: false, 
        typescript: false 
      })
      
      // Fix formatting
      const fixResult = await wrapper.fix(['src/prettier-fix.js'], { 
        prettier: true, 
        eslint: false, 
        typescript: false,
        fix: true 
      })
      
      // Check after fix
      const finalResult = await wrapper.check(['src/prettier-fix.js'], { 
        prettier: true, 
        eslint: false, 
        typescript: false 
      })
      const executionTime = Date.now() - startTime
      
      // Assert
      expect(executionTime).toBeLessThan(100)
      
      // Initial state should have formatting issues
      assertQualityResult(initialResult).shouldFail()
      
      // Fix should succeed
      assertFixResult(fixResult).shouldSucceed()
      expect(fixResult.count).toBeGreaterThan(0)
      
      // Final state should pass
      assertQualityResult(finalResult).shouldSucceed()
    })
  })

  describe('Mixed Engine Auto-Fix Behavior', () => {
    it('should handle mixed fixable and non-fixable issues under 100ms', async () => {
      // Arrange
      const fixture = AutoFixBehaviorFactory.createMixedAutoFixFixture()
      wrapper.loadFixture(fixture)
      
      // Act
      const startTime = Date.now()
      const initialResult = await wrapper.check(['src/mixed-fix.js'], { 
        eslint: true, 
        prettier: true, 
        typescript: false 
      })
      
      // Attempt to fix all issues
      const fixResult = await wrapper.fix(['src/mixed-fix.js'], { 
        eslint: true, 
        prettier: true, 
        typescript: false,
        fix: true 
      })
      
      // Check after fix
      const finalResult = await wrapper.check(['src/mixed-fix.js'], { 
        eslint: true, 
        prettier: true, 
        typescript: false 
      })
      const executionTime = Date.now() - startTime
      
      // Assert
      expect(executionTime).toBeLessThan(100)
      
      // Initial state should have multiple issues
      assertQualityResult(initialResult).shouldFail()
      assertQualityResult(initialResult)
        .shouldHaveESLintResults()
        .shouldFail()
      assertQualityResult(initialResult)
        .shouldHavePrettierResults()
        .shouldFail()
      
      // Fix should partially succeed (Prettier fixed, ESLint no-unused-vars remains)
      assertFixResult(fixResult).shouldSucceed()
      expect(fixResult.count).toBeGreaterThan(0)
      
      // Final state should still fail due to unfixable issues
      assertQualityResult(finalResult).shouldFail()
      assertQualityResult(finalResult)
        .shouldHaveESLintResults()
        .shouldContainError('no-unused-vars')
      assertQualityResult(finalResult)
        .shouldHavePrettierResults()
        .shouldSucceed() // Prettier issues should be fixed
    })
  })

  describe('Performance Consistency', () => {
    it('should maintain consistent performance across multiple fix operations', async () => {
      // Arrange
      const fixture = AutoFixBehaviorFactory.createESLintAutoFixFixture()
      wrapper.loadFixture(fixture)
      
      const executionTimes: number[] = []
      const runs = 5
      
      // Act - Run multiple fix operations
      for (let i = 0; i < runs; i++) {
        const startTime = Date.now()
        await wrapper.fix(['src/eslint-fix.js'], { 
          eslint: true, 
          typescript: false, 
          prettier: false,
          fix: true 
        })
        const executionTime = Date.now() - startTime
        executionTimes.push(executionTime)
      }
      
      // Assert - All runs should be under 100ms
      executionTimes.forEach(time => {
        expect(time).toBeLessThan(100)
      })
      
      // Calculate consistency metrics
      const average = executionTimes.reduce((sum, time) => sum + time, 0) / runs
      const variance = executionTimes.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / runs
      const stdDev = Math.sqrt(variance)
      
      expect(average).toBeLessThan(100)
      expect(stdDev).toBeLessThan(20) // Low variance indicates consistent performance
      
      console.log(`Auto-fix consistency: ${average.toFixed(1)}ms average, ${stdDev.toFixed(1)}ms std dev over ${runs} runs`)
    })
  })
})