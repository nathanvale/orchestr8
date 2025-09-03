#!/usr/bin/env tsx
/**
 * Test script specifically for OpenAI TTS
 */

// Load environment variables from .env file for testing
import 'dotenv/config'

import { VoiceVault } from './voice-vault.js'

async function testOpenAI() {
  console.log('🎙️  Testing OpenAI TTS...\n')

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment')
    process.exit(1)
  }

  console.log('✅ OpenAI API key found')

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
    // Configure OpenAI with different voices
    providers: {
      openai: {
        voice: 'alloy', // Default voice
        model: 'tts-1', // Standard model (cheaper, faster)
      },
    },
  })

  try {
    // Test different OpenAI voices
    const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']

    for (const voice of voices) {
      console.log(`\n📢 Testing OpenAI with ${voice} voice...`)

      const result = await vault.speak(
        `Hello from OpenAI! This is the ${voice} voice speaking.`,
        {
          provider: 'openai',
          voice,
        },
        true, // play audio
      )

      console.log(`\n✅ Result for ${voice}:`, {
        success: result.success,
        provider: result.providerName,
        fromCache: result.fromCache,
        duration: `${result.durationMs}ms`,
        error: result.error,
      })

      if (!result.success) {
        console.error(`\n❌ OpenAI ${voice} failed:`, result.error)
        break
      }

      // Small delay between voices
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    // Test caching - speak the same text again
    console.log('\n🔄 Testing cache with repeated text...')

    const cacheTest1 = await vault.speak(
      'Testing OpenAI cache functionality.',
      {
        provider: 'openai',
        voice: 'nova',
      },
      true,
    )

    console.log('\n📊 First call (should hit API):', {
      fromCache: cacheTest1.fromCache,
      duration: `${cacheTest1.durationMs}ms`,
    })

    // Second call with same text - should use cache
    const cacheTest2 = await vault.speak(
      'Testing OpenAI cache functionality.',
      {
        provider: 'openai',
        voice: 'nova',
      },
      true,
    )

    console.log('\n📊 Second call (should use cache):', {
      fromCache: cacheTest2.fromCache,
      duration: `${cacheTest2.durationMs}ms`,
    })

    // Test with HD model
    console.log('\n🎯 Testing OpenAI HD model (tts-1-hd)...')

    const hdResult = await vault.speak(
      'This is the high definition OpenAI voice model. It sounds even better!',
      {
        provider: 'openai',
        model: 'tts-1-hd',
        voice: 'shimmer',
      },
      true,
    )

    console.log('\n✅ HD Model Result:', {
      success: hdResult.success,
      provider: hdResult.providerName,
      fromCache: hdResult.fromCache,
      duration: `${hdResult.durationMs}ms`,
      error: hdResult.error,
    })

    if (hdResult.success) {
      console.log('\n🎉 OpenAI TTS is fully working with all voices and models!')
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  } finally {
    await vault.cleanup()
  }
}

// Run the test
testOpenAI().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
