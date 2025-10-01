/**
 * Debug test to understand resource manager behavior
 */

import { describe, it, expect } from 'vitest'
import {
  registerResource,
  cleanupAllResources,
  getResourceStats,
  ResourceCategory,
} from '../../resources/index.js'

describe('debug resource manager', () => {
  it('should show current resource state', async () => {
    console.log('=== Initial State ===')
    const initialStats = getResourceStats()
    console.log('Initial stats:', initialStats)

    console.log('=== Cleanup All ===')
    const cleanupResult = await cleanupAllResources()
    console.log('Cleanup result:', cleanupResult)

    console.log('=== After Cleanup ===')
    const afterCleanupStats = getResourceStats()
    console.log('After cleanup stats:', afterCleanupStats)

    console.log('=== Register One Resource ===')
    let cleanupCalled = false
    registerResource(
      'debug-resource',
      () => {
        cleanupCalled = true
        console.log('Cleanup function called for debug-resource')
      },
      {
        category: ResourceCategory.CRITICAL,
        description: 'Debug resource',
      },
    )

    const afterRegisterStats = getResourceStats()
    console.log('After register stats:', afterRegisterStats)

    console.log('=== Cleanup Registered Resource ===')
    const cleanupResult2 = await cleanupAllResources()
    console.log('Cleanup result 2:', cleanupResult2)
    console.log('Cleanup called:', cleanupCalled)

    const finalStats = getResourceStats()
    console.log('Final stats:', finalStats)

    // Basic assertions
    expect(afterRegisterStats.total).toBe(afterCleanupStats.total + 1)
    expect(cleanupCalled).toBe(true)
  })
})
