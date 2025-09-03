#!/usr/bin/env tsx

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Real API Test Script for ElevenLabs TTS Integration
 * This script tests the ElevenLabs provider with a real API key
 */

// Import from index to ensure providers are registered
import type { ElevenLabsProvider } from '../src/speech/providers/elevenlabs-provider'

import { TTSProviderFactory } from '../src/speech/providers/index'

// Set the API key
process.env.ELEVENLABS_API_KEY = 'sk_847d9febe6d894094c98f7f7a204b97343f80ec57a3615ca'

// Test configuration
const TEST_TEXTS = {
  short: 'Hello, this is a test of the ElevenLabs TTS integration.',
  medium:
    'The Claude hooks package now supports ElevenLabs text-to-speech with high-quality voice synthesis, multiple languages, and streaming capabilities.',
  long: 'This is a comprehensive test of the ElevenLabs Text-to-Speech provider integration. We are testing various voice models, output formats, and streaming capabilities to ensure everything works correctly with the real API. The integration supports 32 languages, multiple voice styles, and advanced customization options.',
}

// Available voices to test
const VOICES_TO_TEST = [
  '21m00Tcm4TlvDq8ikWAM', // Rachel
  'AZnzlk1XvdvUeBnXmlld', // Domi
  'EXAVITQu4vr4xnSDxMaL', // Bella
  'ErXwobaYiN019PkySvjV', // Antoni
  'MF3mGyEYCl7XYWbV9V6O', // Elli
]

// Audio formats to test
const FORMATS_TO_TEST = ['mp3_44100_128', 'mp3_22050_32', 'pcm_16000', 'ulaw_8000']

async function testVoices() {
  console.log('\n🎤 Testing Different Voices...\n')

  for (const voiceId of VOICES_TO_TEST) {
    try {
      console.log(`Testing voice: ${voiceId}`)
      const config = {
        provider: 'elevenlabs' as const,
        elevenlabs: {
          voiceId,
          modelId: 'eleven_monolingual_v1',
        },
      }

      const testProvider = TTSProviderFactory.create(config) as ElevenLabsProvider

      // Test with short text to save API quota
      await testProvider.speak(TEST_TEXTS.short)
      console.log(`✅ Voice ${voiceId} works correctly`)

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`❌ Voice ${voiceId} failed:`, error)
    }
  }
}

async function testFormats() {
  console.log('\n🎵 Testing Different Audio Formats...\n')

  for (const format of FORMATS_TO_TEST) {
    try {
      console.log(`Testing format: ${format}`)
      const config = {
        provider: 'elevenlabs' as const,
        elevenlabs: {
          voiceId: '21m00Tcm4TlvDq8ikWAM',
          modelId: 'eleven_monolingual_v1',
          outputFormat: format,
        },
      }

      const provider = TTSProviderFactory.create(config) as ElevenLabsProvider

      // Generate audio without playing (to test format generation)
      // We'll use speak but with a very short text to minimize playback
      await provider.speak('Test')

      // Since we can't directly get the audio data, we'll just verify the format works
      console.log(`✅ Format ${format} tested successfully`)

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`❌ Format ${format} failed:`, error)
    }
  }
}

async function testStreaming() {
  console.log('\n🌊 Testing Streaming Functionality...\n')

  try {
    const config = {
      provider: 'elevenlabs' as const,
      elevenlabs: {
        voiceId: '21m00Tcm4TlvDq8ikWAM',
        modelId: 'eleven_turbo_v2_5', // Fast model for streaming
        streaming: true,
        streamingLatency: 2,
      },
    }

    const provider = TTSProviderFactory.create(config) as ElevenLabsProvider

    console.log('Testing streaming with turbo model...')
    const startTime = Date.now()

    // Generate speech with streaming
    await provider.speak(TEST_TEXTS.medium)

    const duration = Date.now() - startTime
    console.log(`✅ Streaming completed in ${duration}ms`)
  } catch (error) {
    console.error('❌ Streaming test failed:', error)
  }
}

async function testRateLimiting() {
  console.log('\n⏱️ Testing Rate Limiting Compliance...\n')

  const provider = TTSProviderFactory.create({
    provider: 'elevenlabs',
    elevenlabs: {
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      modelId: 'eleven_monolingual_v1',
    },
  }) as ElevenLabsProvider

  console.log('Making rapid requests to test rate limiting...')

  for (let i = 0; i < 3; i++) {
    try {
      console.log(`Request ${i + 1}/3`)
      await provider.speak(`Test ${i + 1}`)
      console.log(`✅ Request ${i + 1} succeeded`)

      // Respect rate limits with a small delay
      if (i < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    } catch (error: any) {
      if (error.message.includes('rate limit')) {
        console.log(`⚠️ Rate limit detected (expected behavior)`)
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } else {
        console.error(`❌ Request ${i + 1} failed:`, error.message)
      }
    }
  }
}

async function testCaching() {
  console.log('\n💾 Testing Cache Functionality...\n')

  const provider = TTSProviderFactory.create({
    provider: 'elevenlabs',
    elevenlabs: {
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      modelId: 'eleven_monolingual_v1',
    },
  }) as ElevenLabsProvider

  const testText = 'This text will be cached.'

  console.log('First request (should call API)...')
  const start1 = Date.now()
  await provider.speak(testText)
  const duration1 = Date.now() - start1
  console.log(`✅ First request took ${duration1}ms`)

  console.log('Second request (should use cache)...')
  const start2 = Date.now()
  await provider.speak(testText)
  const duration2 = Date.now() - start2
  console.log(`✅ Second request took ${duration2}ms`)

  if (duration2 < duration1 / 2) {
    console.log('✅ Cache is working (second request was much faster)')
  } else {
    console.log('⚠️ Cache might not be working optimally')
  }
}

async function testErrorHandling() {
  console.log('\n🛡️ Testing Error Handling...\n')

  // Test with invalid API key
  const originalKey = process.env.ELEVENLABS_API_KEY
  process.env.ELEVENLABS_API_KEY = 'invalid_key_12345'

  try {
    const provider = TTSProviderFactory.create({
      provider: 'elevenlabs',
      elevenlabs: {
        voiceId: '21m00Tcm4TlvDq8ikWAM',
      },
    }) as ElevenLabsProvider

    await provider.speak('Test')
    console.error('❌ Should have thrown an error for invalid API key')
  } catch (error: any) {
    if (error.message.includes('authentication') || error.message.includes('401')) {
      console.log('✅ Correctly handled invalid API key')
    } else {
      console.error('❌ Unexpected error:', error.message)
    }
  }

  // Restore valid key
  process.env.ELEVENLABS_API_KEY = originalKey

  // Test with invalid voice ID
  try {
    const provider = TTSProviderFactory.create({
      provider: 'elevenlabs',
      elevenlabs: {
        voiceId: 'invalid_voice_id',
      },
    }) as ElevenLabsProvider

    await provider.speak('Test')
    console.error('❌ Should have thrown an error for invalid voice ID')
  } catch (error: any) {
    console.log('✅ Correctly handled invalid voice ID:', error.message)
  }
}

async function runAllTests() {
  console.log('🚀 Starting ElevenLabs Real API Tests')
  console.log('=====================================\n')

  try {
    // Test basic functionality first
    console.log('Testing basic TTS functionality...')
    const provider = TTSProviderFactory.create({
      provider: 'elevenlabs',
      elevenlabs: {
        voiceId: '21m00Tcm4TlvDq8ikWAM',
        modelId: 'eleven_monolingual_v1',
      },
    }) as ElevenLabsProvider

    await provider.speak('ElevenLabs integration test successful!')
    console.log('✅ Basic functionality works!\n')

    // Run all test suites
    await testVoices()
    await testFormats()
    await testStreaming()
    await testRateLimiting()
    await testCaching()
    await testErrorHandling()

    console.log('\n=====================================')
    console.log('✅ All ElevenLabs API tests completed!')
    console.log('=====================================\n')
  } catch (error) {
    console.error('\n❌ Test suite failed:', error)
    process.exit(1)
  }
}

// Run tests
runAllTests().catch(console.error)
