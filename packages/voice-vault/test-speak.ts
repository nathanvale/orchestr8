#!/usr/bin/env tsx
/**
 * Test script for Voice Vault TTS
 * Run with: tsx test-speak.ts
 */

import { VoiceVault } from './src/voice-vault.js'

async function testSpeak() {
  console.log('🎤 Testing Voice Vault TTS Package...\n')

  // Create a new VoiceVault instance with debug logging
  const vault = new VoiceVault({
    logging: {
      level: 'debug',
      pretty: true,
    },
    cache: {
      enabled: true,
    },
  })

  try {
    // Test 1: Simple speak
    console.log('📢 Test 1: Speaking a simple message...')
    const result1 = await vault.speak('Hello! Voice Vault is working!')
    console.log(`✅ Result: ${result1.success ? 'Success' : 'Failed'}`)
    console.log(`   Correlation ID: ${result1.correlationId}`)
    console.log(`   Provider: ${result1.providerName}`)
    console.log(`   From Cache: ${result1.fromCache}`)
    console.log(`   Duration: ${result1.durationMs}ms\n`)

    // Wait a moment between tests
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Test 2: Speak with caching (should be faster second time)
    console.log('📢 Test 2: Speaking the same message (testing cache)...')
    const result2 = await vault.speak('Hello! Voice Vault is working!')
    console.log(`✅ Result: ${result2.success ? 'Success' : 'Failed'}`)
    console.log(`   From Cache: ${result2.fromCache}`)
    console.log(`   Duration: ${result2.durationMs}ms\n`)

    // Test 3: Different message
    console.log('📢 Test 3: Speaking a different message...')
    const result3 = await vault.speak('The TTS caching system is fully operational!')
    console.log(`✅ Result: ${result3.success ? 'Success' : 'Failed'}`)
    console.log(`   Correlation ID: ${result3.correlationId}\n`)

    // Test 4: Get cache statistics
    console.log('📊 Test 4: Getting cache statistics...')
    const stats = await vault.getCacheStats()
    console.log('Cache Stats:')
    console.log(`   Total Requests: ${stats.totalRequests}`)
    console.log(`   Cache Hits: ${stats.cacheHits}`)
    console.log(`   Cache Misses: ${stats.cacheMisses}`)
    console.log(`   Hit Rate: ${stats.hitRate.toFixed(2)}%`)
    console.log(`   API Calls Saved: ${stats.apiCallsSaved}\n`)

    // Test 5: System health check
    console.log('🏥 Test 5: Checking system health...')
    const health = await vault.getHealthStatus()
    console.log('System Health:')
    console.log(`   Overall: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`)
    console.log(`   Cache: ${health.cache.healthy ? '✅' : '❌'} ${health.cache.status}`)
    console.log(`   Providers: ${health.providers.available}/${health.providers.total} available`)
    console.log(`   Audio: ${health.audio.canPlay ? '✅ Ready' : '❌ Not ready'}\n`)

    console.log('🎉 All tests completed successfully!')
    console.log(`📁 Check logs in: packages/voice-vault/logs/`)
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    // Clean up
    await vault.cleanup()
  }
}

// Run the test
testSpeak().catch(console.error)
