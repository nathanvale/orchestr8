#!/usr/bin/env tsx
/**
 * Simple test script for OpenAI TTS - tests just one voice
 */

// Load environment variables from .env file for testing
import 'dotenv/config'

import { VoiceVault } from './voice-vault.js'

async function testOpenAISimple() {
  console.log('🎙️  Testing OpenAI TTS (Simple)...\n')

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment')
    process.exit(1)
  }

  console.log('✅ OpenAI API key found')
  console.log('   Key prefix:', process.env.OPENAI_API_KEY.substring(0, 20) + '...')

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
    // Configure OpenAI with nova voice
    providers: {
      openai: {
        voice: 'nova', // Female voice
        model: 'tts-1', // Standard model (cheaper)
      },
    },
  })

  try {
    console.log('\n📢 Testing OpenAI with nova voice...')

    const result = await vault.speak(
      'Hello from OpenAI! This is Nova speaking.',
      {
        provider: 'openai',
      },
      true, // play audio
    )

    console.log('\n✅ Result:', {
      success: result.success,
      provider: result.providerName,
      fromCache: result.fromCache,
      duration: `${result.durationMs}ms`,
      error: result.error,
    })

    if (!result.success) {
      console.error('\n❌ OpenAI failed:', result.error)

      if (result.error?.includes('quota') || result.error?.includes('rate limit')) {
        console.log('\n⚠️  OpenAI API quota exceeded or rate limited.')
        console.log('   This usually means:')
        console.log('   1. Your API key has exhausted its credits')
        console.log('   2. You need to add billing information to your OpenAI account')
        console.log("   3. Or you've hit the rate limit for your tier")
        console.log('\n💡 Tip: Check your usage at https://platform.openai.com/usage')
      }

      console.log('\n📢 Trying with system TTS as fallback...')

      // Try with system TTS to verify audio works
      const systemResult = await vault.speak(
        'Hello! This is a fallback test using the system voice.',
        {
          provider: 'system',
        },
        true, // play audio
      )

      console.log('\n✅ System TTS Result:', {
        success: systemResult.success,
        provider: systemResult.providerName,
        duration: `${systemResult.durationMs}ms`,
        error: systemResult.error,
      })

      if (systemResult.success) {
        console.log('\n💡 Audio playback works! The issue is with the OpenAI API quota/billing.')
      }
    } else {
      console.log('\n🎉 OpenAI TTS worked! You should have heard Nova speaking.')

      // Test cache if first call succeeded
      console.log('\n🔄 Testing cache with same text...')

      const cacheResult = await vault.speak(
        'Hello from OpenAI! This is Nova speaking.',
        {
          provider: 'openai',
        },
        true, // play audio
      )

      console.log('\n📊 Cache test result:', {
        fromCache: cacheResult.fromCache,
        duration: `${cacheResult.durationMs}ms`,
      })

      if (cacheResult.fromCache) {
        console.log('\n✅ Cache is working! Second call used cached audio.')

        // Show cache stats
        const stats = await vault.getCacheStats()
        console.log('\n📈 Cache Statistics:', {
          hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
          apiCallsSaved: stats.apiCallsSaved,
          totalHits: stats.hits,
          totalMisses: stats.misses,
        })
      }
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  } finally {
    await vault.cleanup()
  }
}

// Run the test
testOpenAISimple().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
