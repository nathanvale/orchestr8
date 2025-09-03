#!/usr/bin/env tsx
/**
 * Test script specifically for ElevenLabs TTS
 */

// Load environment variables from .env file for testing
import 'dotenv/config'

import { VoiceVault } from './voice-vault.js'

async function testElevenLabs() {
  console.log('🎙️  Testing ElevenLabs TTS...\n')

  // Check for API key
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('❌ ELEVENLABS_API_KEY not found in environment')
    process.exit(1)
  }

  console.log('✅ ElevenLabs API key found')

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
    // Configure ElevenLabs with a default voice
    providers: {
      elevenlabs: {
        voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel voice
      },
    },
  })

  try {
    console.log('\n📢 Testing ElevenLabs with Rachel voice...')

    const result = await vault.speak(
      'Hello from ElevenLabs! This is Rachel speaking.',
      {
        provider: 'elevenlabs',
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
      console.error('\n❌ ElevenLabs failed:', result.error)
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
        console.log('\n💡 Audio playback works! The issue is with the ElevenLabs API key.')
        console.log('   Please check that your ELEVENLABS_API_KEY is valid.')
      }
    } else {
      console.log('\n🎉 ElevenLabs TTS worked! You should have heard Rachel speaking.')
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  } finally {
    await vault.cleanup()
  }
}

// Run the test
testElevenLabs().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
