#!/usr/bin/env tsx
/**
 * Test script for Voice Vault speak functionality
 * Tests TTS with logging to verify the flow works correctly
 */

// Load environment variables from .env file for testing
import 'dotenv/config'

import { VoiceVault } from './voice-vault.js'

async function testSpeak() {
  console.log('🎙️  Starting Voice Vault speak test...\n')

  // Create Voice Vault instance with debug logging
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
  })

  try {
    // Test 1: Simple speak with system provider (no API key needed)
    console.log('📢 Test 1: Speaking with system provider...')
    const result1 = await vault.speak(
      'Hello from Voice Vault! This is a test of the text to speech system.',
      {
        provider: 'system',
      },
      true, // play audio
    )

    console.log('\n✅ Test 1 Result:', {
      success: result1.success,
      provider: result1.providerName,
      fromCache: result1.fromCache,
      duration: `${result1.durationMs}ms`,
      playback: result1.playbackResult?.success ? 'played' : 'failed',
    })

    // Test 2: Test caching - speak same text again
    console.log('\n📢 Test 2: Speaking same text (should use cache)...')
    const result2 = await vault.speak(
      'Hello from Voice Vault! This is a test of the text to speech system.',
      {
        provider: 'system',
      },
      true,
    )

    console.log('\n✅ Test 2 Result:', {
      success: result2.success,
      provider: result2.providerName,
      fromCache: result2.fromCache,
      duration: `${result2.durationMs}ms`,
      playback: result2.playbackResult?.success ? 'played' : 'failed',
    })

    // Test 3: Test with OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      console.log('\n📢 Test 3: Speaking with OpenAI provider...')
      const result3 = await vault.speak(
        'This is a test with OpenAI text to speech.',
        {
          provider: 'openai',
          voice: 'nova',
          speed: 1.0,
        },
        true,
      )

      console.log('\n✅ Test 3 Result:', {
        success: result3.success,
        provider: result3.providerName,
        fromCache: result3.fromCache,
        duration: `${result3.durationMs}ms`,
        playback: result3.playbackResult?.success ? 'played' : 'failed',
      })

      // Test 3b: Same text again to test caching
      console.log('\n📢 Test 3b: Speaking same text with OpenAI (should use cache)...')
      const result3b = await vault.speak(
        'This is a test with OpenAI text to speech.',
        {
          provider: 'openai',
          voice: 'nova',
          speed: 1.0,
        },
        true,
      )

      console.log('\n✅ Test 3b Result:', {
        success: result3b.success,
        provider: result3b.providerName,
        fromCache: result3b.fromCache,
        duration: `${result3b.durationMs}ms`,
        playback: result3b.playbackResult?.success ? 'played' : 'failed',
      })
    } else {
      console.log('\n⚠️  Skipping OpenAI test (no API key found)')
    }

    // Test 4: Test with ElevenLabs if API key is available
    if (process.env.ELEVENLABS_API_KEY) {
      console.log('\n📢 Test 4: Speaking with ElevenLabs provider...')
      const result4 = await vault.speak(
        'This is a test with ElevenLabs voice synthesis.',
        {
          provider: 'elevenlabs',
          // Using a default ElevenLabs voice ID (Rachel)
          voice: '21m00Tcm4TlvDq8ikWAM',
          speed: 1.0,
        },
        true,
      )

      console.log('\n✅ Test 4 Result:', {
        success: result4.success,
        provider: result4.providerName,
        fromCache: result4.fromCache,
        duration: `${result4.durationMs}ms`,
        playback: result4.playbackResult?.success ? 'played' : 'failed',
      })
    } else {
      console.log('\n⚠️  Skipping ElevenLabs test (no API key found)')
    }

    // Test 5: Get cache statistics
    console.log('\n📊 Cache Statistics:')
    const stats = await vault.getCacheStats()
    console.log({
      entries: stats.entryCount,
      size: `${(stats.totalSize / 1024).toFixed(2)} KB`,
      hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
      apiCallsSaved: stats.apiCallsSaved,
    })

    // Test 6: Health check
    console.log('\n🏥 Health Check:')
    const health = await vault.getHealthStatus()
    console.log({
      status: health.status,
      providers: Object.entries(health.components.providers).map(([name, status]) => ({
        name,
        status: status.status,
      })),
      cache: health.components.cache.status,
    })

    console.log('\n🎉 All tests completed successfully!')
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  } finally {
    // Clean up
    await vault.cleanup()
  }
}

// Run the test
testSpeak().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
