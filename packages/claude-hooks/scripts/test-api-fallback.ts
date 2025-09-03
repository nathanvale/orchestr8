#!/usr/bin/env tsx

import { ElevenLabsProvider } from '../src/speech/providers/elevenlabs-provider'
import { OpenAIProvider } from '../src/speech/providers/openai-provider'
import { FallbackProvider } from '../src/speech/providers/provider-factory'
import '../src/utils/env-loader.js'

async function test() {
  console.error('\n=== Testing Real API Fallback ===\n')

  // Test 1: Invalid ElevenLabs key should fallback to OpenAI
  console.error('TEST 1: Invalid ElevenLabs key → OpenAI')
  const elevenlabs1 = new ElevenLabsProvider({
    apiKey: 'sk_invalid_key_123456',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
  })

  const openai1 = new OpenAIProvider({
    apiKey: process.env['OPENAI_API_KEY'],
  })

  const provider1 = new FallbackProvider(elevenlabs1, openai1)

  console.error('Speaking with invalid ElevenLabs key...')
  const result1 = await provider1.speak('Test one')
  console.error('Result:', result1)

  // Test 2: Both invalid keys should fail
  console.error('\nTEST 2: Both invalid keys → Should fail')
  const elevenlabs2 = new ElevenLabsProvider({
    apiKey: 'sk_invalid_key_123456',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
  })

  const openai2 = new OpenAIProvider({
    apiKey: 'sk_invalid_openai_key',
  })

  const provider2 = new FallbackProvider(elevenlabs2, openai2)

  console.error('Speaking with both invalid keys...')
  const result2 = await provider2.speak('Test two')
  console.error('Result:', result2)
}

test().catch(console.error)
