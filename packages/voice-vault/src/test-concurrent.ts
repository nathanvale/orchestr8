#!/usr/bin/env tsx
/**
 * Test script for concurrent requests and performance
 */

import 'dotenv/config'
import { VoiceVault } from './voice-vault.js'

async function testConcurrent() {
  console.log('🚀 Testing Concurrent Requests...\n')

  const vault = new VoiceVault({
    logging: {
      level: 'info', // Less verbose for concurrent tests
      pretty: true,
      enabled: true,
    },
    cache: {
      enabled: true,
      cacheDir: './.voice-vault-test-cache',
    },
  })

  try {
    // Test 1: Multiple concurrent requests with same text
    console.log('📝 Test 1: Concurrent identical requests (cache test)\n')

    const identicalText = 'Testing concurrent cache access'
    const startTime = Date.now()

    const identicalRequests = Array(5)
      .fill(null)
      .map(() => vault.speak(identicalText, { provider: 'system' }, false))

    const identicalResults = await Promise.all(identicalRequests)
    const endTime = Date.now()

    const cacheHits = identicalResults.filter((r) => r.fromCache).length
    const cacheMisses = identicalResults.filter((r) => !r.fromCache).length

    console.log('Identical requests results:')
    console.log(`  Total time: ${endTime - startTime}ms`)
    console.log(`  Cache hits: ${cacheHits}`)
    console.log(`  Cache misses: ${cacheMisses}`)
    console.log(`  All successful: ${identicalResults.every((r) => r.success)}`)

    if (cacheHits > 0) {
      console.log('✅ Cache working during concurrent access')
    } else {
      console.log('⚠️  No cache hits - might be first run')
    }

    // Test 2: Different texts concurrent
    console.log('\n📝 Test 2: Concurrent different requests\n')

    const differentTexts = [
      'First concurrent request',
      'Second concurrent request',
      'Third concurrent request',
      'Fourth concurrent request',
      'Fifth concurrent request',
    ]

    const startDiff = Date.now()
    const differentRequests = differentTexts.map((text) =>
      vault.speak(text, { provider: 'system' }, false),
    )

    const differentResults = await Promise.all(differentRequests)
    const endDiff = Date.now()

    console.log('Different requests results:')
    console.log(`  Total time: ${endDiff - startDiff}ms`)
    console.log(
      `  Average time: ${Math.round((endDiff - startDiff) / differentTexts.length)}ms per request`,
    )
    console.log(`  All successful: ${differentResults.every((r) => r.success)}`)

    const timings = differentResults.map((r) => r.durationMs)
    console.log(`  Min duration: ${Math.min(...timings)}ms`)
    console.log(`  Max duration: ${Math.max(...timings)}ms`)
    console.log(
      `  Avg duration: ${Math.round(timings.reduce((a, b) => a + b, 0) / timings.length)}ms`,
    )

    // Test 3: Mixed providers concurrent
    console.log('\n📝 Test 3: Concurrent with different providers\n')

    const mixedRequests = [
      vault.speak('System provider test', { provider: 'system' }, false),
      vault.speak(
        'ElevenLabs test',
        {
          provider: 'elevenlabs',
          voice: '21m00Tcm4TlvDq8ikWAM',
        },
        false,
      ),
      vault.speak(
        'OpenAI test',
        {
          provider: 'openai',
          voice: 'nova',
        },
        false,
      ),
    ]

    const startMixed = Date.now()
    const mixedResults = await Promise.allSettled(mixedRequests)
    const endMixed = Date.now()

    console.log('Mixed providers results:')
    console.log(`  Total time: ${endMixed - startMixed}ms`)

    mixedResults.forEach((result, i) => {
      const provider = ['system', 'elevenlabs', 'openai'][i]
      if (result.status === 'fulfilled') {
        console.log(
          `  ${provider}: ${result.value.success ? '✅' : '❌'} (${result.value.durationMs}ms)`,
        )
        if (!result.value.success) {
          console.log(`    Error: ${result.value.error}`)
        }
      } else {
        console.log(`  ${provider}: 💥 Rejected - ${result.reason}`)
      }
    })

    // Test 4: Stress test with many requests
    console.log('\n📝 Test 4: Stress test (20 concurrent requests)\n')

    const stressCount = 20
    const stressStart = Date.now()

    const stressRequests = Array(stressCount)
      .fill(null)
      .map((_, i) => vault.speak(`Stress test ${i}`, { provider: 'system' }, false))

    const stressResults = await Promise.allSettled(stressRequests)
    const stressEnd = Date.now()

    const successful = stressResults.filter(
      (r) => r.status === 'fulfilled' && r.value.success,
    ).length
    const failed = stressResults.filter(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success),
    ).length

    console.log('Stress test results:')
    console.log(`  Total requests: ${stressCount}`)
    console.log(`  Successful: ${successful}`)
    console.log(`  Failed: ${failed}`)
    console.log(`  Total time: ${stressEnd - stressStart}ms`)
    console.log(`  Avg time per request: ${Math.round((stressEnd - stressStart) / stressCount)}ms`)

    if (successful === stressCount) {
      console.log('✅ All stress test requests succeeded!')
    } else if (successful > stressCount * 0.8) {
      console.log('⚠️  Most requests succeeded, some failures')
    } else {
      console.log('❌ Many failures under stress')
    }

    // Test 5: Cache performance under load
    console.log('\n📝 Test 5: Cache performance comparison\n')

    // First pass - all cache misses
    const noCacheText = `Cache test ${Date.now()}`
    const noCacheStart = Date.now()
    await vault.speak(noCacheText, { provider: 'system' }, false)
    const noCacheTime = Date.now() - noCacheStart

    // Second pass - should hit cache
    const cacheStart = Date.now()
    await vault.speak(noCacheText, { provider: 'system' }, false)
    const cacheTime = Date.now() - cacheStart

    console.log('Cache performance:')
    console.log(`  First call (miss): ${noCacheTime}ms`)
    console.log(`  Second call (hit): ${cacheTime}ms`)
    console.log(`  Speed improvement: ${Math.round((1 - cacheTime / noCacheTime) * 100)}%`)

    if (cacheTime < noCacheTime * 0.5) {
      console.log('✅ Cache provides >50% speed improvement')
    } else {
      console.log('⚠️  Cache improvement less than expected')
    }

    // Final cache statistics
    console.log('\n📊 Final Cache Statistics:\n')

    const finalStats = await vault.getCacheStats()
    console.log({
      hitRate: `${(finalStats.hitRate * 100).toFixed(1)}%`,
      totalHits: finalStats.hits,
      totalMisses: finalStats.misses,
      apiCallsSaved: finalStats.apiCallsSaved,
      entries: finalStats.entryCount,
      totalSize: `${Math.round(finalStats.totalSizeBytes / 1024)}KB`,
    })
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  } finally {
    await vault.cleanup()
  }
}

testConcurrent().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
