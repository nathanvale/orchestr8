#!/usr/bin/env tsx
/**
 * Simple test to verify audio playback works
 */

import { VoiceVault } from './voice-vault.js'

async function testAudio() {
  console.log('🎙️  Testing audio playback with system TTS...\n')

  const vault = new VoiceVault({
    logging: {
      level: 'info',
      pretty: true,
      enabled: true,
    },
  })

  try {
    // Test with system TTS (should always work on macOS)
    console.log('📢 Speaking with system TTS...')
    const result = await vault.speak(
      'Testing audio playback. Can you hear me?',
      {
        provider: 'system',
      },
      true, // play audio
    )

    console.log('\n✅ Result:', {
      success: result.success,
      provider: result.providerName,
      duration: `${result.durationMs}ms`,
    })

    if (result.success) {
      console.log(
        '\n🎉 If you heard "Testing audio playback. Can you hear me?" then audio is working!',
      )
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  } finally {
    await vault.cleanup()
  }
}

// Run the test
testAudio().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
