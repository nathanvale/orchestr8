#!/usr/bin/env tsx
/**
 * Test script to validate provider fallback mechanism
 */

import 'dotenv/config'
import { VoiceVault } from './voice-vault.js'

async function testProviderFallback() {
  console.log('🔄 Testing Provider Fallback Mechanism...\n')

  const vault = new VoiceVault({
    logging: {
      level: 'debug',
      pretty: true,
      enabled: true,
    },
    cache: {
      enabled: true,
      cacheDir: './.voice-vault-test-cache',
    },
    providers: {
      // Configure providers with intentional issues to test fallback
      openai: {
        voice: 'nova',
        model: 'tts-1',
      },
      elevenlabs: {
        voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel
      },
      system: {
        voice: 'Samantha',
      },
    },
  })

  try {
    // Test 1: Request unavailable provider
    console.log('📝 Test 1: Request provider with no API key\n')

    // Remove API key temporarily
    const originalKey = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY

    const noKeyResult = await vault.speak(
      'Testing provider without API key',
      { provider: 'openai' },
      false,
    )

    console.log('Result:', {
      success: noKeyResult.success,
      requestedProvider: 'openai',
      actualProvider: noKeyResult.providerName,
      error: noKeyResult.error,
    })

    // Restore key
    if (originalKey) process.env.OPENAI_API_KEY = originalKey

    if (noKeyResult.success && noKeyResult.providerName !== 'openai') {
      console.log('✅ Fallback worked - used', noKeyResult.providerName)
    } else if (!noKeyResult.success) {
      console.error('❌ PROBLEM: Fallback failed completely')
    }

    // Test 2: Provider priority order
    console.log('\n📝 Test 2: Provider priority order\n')

    // Try without specifying provider - should use highest priority available
    const autoResult = await vault.speak(
      'Testing automatic provider selection',
      {}, // No provider specified
      false,
    )

    console.log('Automatic selection:', {
      provider: autoResult.providerName,
      success: autoResult.success,
    })

    // Test 3: Fallback chain with multiple failures
    console.log('\n📝 Test 3: Testing fallback chain\n')

    // Try with invalid provider name
    const invalidResult = await vault.speak(
      'Testing with invalid provider',
      { provider: 'invalid-provider' },
      false,
    )

    console.log('Invalid provider result:', {
      success: invalidResult.success,
      fallbackTo: invalidResult.providerName,
    })

    if (invalidResult.success) {
      console.log('✅ Fallback handled invalid provider')
    } else {
      console.error('❌ PROBLEM: Could not recover from invalid provider')
    }

    // Test 4: Fallback with rate limits
    console.log('\n📝 Test 4: Simulating rate limit scenario\n')

    // Make rapid requests to trigger potential rate limits
    const rapidRequests = []
    for (let i = 0; i < 3; i++) {
      rapidRequests.push(vault.speak(`Quick request ${i}`, { provider: 'system' }, false))
    }

    const results = await Promise.all(rapidRequests)
    const allSuccess = results.every((r) => r.success)

    console.log('Rapid requests:', {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    })

    if (!allSuccess) {
      console.log('⚠️  Some requests failed - check rate limiting')
    } else {
      console.log('✅ All rapid requests succeeded')
    }

    // Test 5: Provider health after errors
    console.log('\n📝 Test 5: Provider health status\n')

    const health = await vault.getProviderHealth()

    for (const [provider, status] of Object.entries(health)) {
      console.log(`${provider}:`, {
        status: status.status,
        available: status.details.apiConnectable,
        authenticated: status.details.authenticated,
        rateLimited: status.details.rateLimited,
        recentErrors: status.details.recentErrors,
      })

      if (status.status === 'unhealthy' && status.details.recentErrors > 0) {
        console.log(`⚠️  ${provider} has issues - ${status.messages.join(', ')}`)
      }
    }

    // Test 6: Fallback with detached mode
    console.log('\n📝 Test 6: Fallback in detached mode\n')

    const detachedResult = await vault.speak(
      'Testing detached mode fallback',
      {
        provider: 'openai', // May fail due to quota
        detached: true,
      },
      false,
    )

    console.log('Detached mode:', {
      success: detachedResult.success,
      provider: detachedResult.providerName,
      hasPlaybackResult: !!detachedResult.playbackResult,
    })

    if (detachedResult.success && !detachedResult.playbackResult) {
      console.log('✅ Detached mode working correctly')
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  } finally {
    await vault.cleanup()
  }
}

testProviderFallback().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
