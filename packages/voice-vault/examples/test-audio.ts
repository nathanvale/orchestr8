#!/usr/bin/env tsx

/**
 * Voice Vault Audio System Test
 * Simple test to verify cross-platform audio playback works
 */

import { createAudioPlayerWithConsoleLogger, getCurrentPlatformInfo } from '../src/audio/index.js'

async function testAudioSystem(): Promise<void> {
  console.log('🎵 Voice Vault Audio System Test\n')

  // Get platform info
  const platformInfo = getCurrentPlatformInfo()
  console.log(`Platform: ${platformInfo.capabilities.displayName}`)
  console.log(`Supported: ${platformInfo.supported ? '✅' : '❌'}`)
  console.log(`Audio Players: ${platformInfo.capabilities.audioPlayers.join(', ')}\n`)

  if (!platformInfo.supported) {
    console.log('❌ Audio playback not supported on this platform')
    return
  }

  // Create audio player
  const player = createAudioPlayerWithConsoleLogger()
  console.log('📱 Audio player created\n')

  // Try to play a system sound (if available)
  let testFilePath: string

  switch (platformInfo.platform) {
    case 'darwin': // macOS
      testFilePath = '/System/Library/Sounds/Glass.aiff'
      break
    case 'win32': // Windows
      testFilePath = 'C:\\Windows\\Media\\chimes.wav'
      break
    case 'linux': // Linux
      // Linux doesn't have standard system sounds, create a test tone or skip
      console.log('⏭️  Linux detected - skipping audio test (no standard system sounds)')
      return
    default:
      console.log('❌ Unsupported platform for audio test')
      return
  }

  console.log(`🎵 Attempting to play: ${testFilePath}`)

  try {
    const result = await player.playAudio(testFilePath, {
      volume: 0.5,
      correlationId: 'audio-test-001',
    })

    if (result.success) {
      console.log('✅ Audio playback successful!')
      console.log(`   Duration: ${result.durationMs}ms`)
      console.log(`   Device: ${result.deviceUsed || 'Unknown'}`)
      console.log(`   Correlation ID: ${result.correlationId}`)
    } else {
      console.log('❌ Audio playback failed')
      console.log(`   Error: ${result.error}`)
      console.log(`   Correlation ID: ${result.correlationId}`)
    }
  } catch (error) {
    console.error('💥 Unexpected error:', error)
  }

  console.log('\n🎵 Audio system test complete')
}

if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  testAudioSystem().catch(console.error)
}
