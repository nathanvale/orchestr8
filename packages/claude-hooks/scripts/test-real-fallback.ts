#!/usr/bin/env tsx

import { ElevenLabsProvider } from '../dist/speech/providers/elevenlabs-provider'
import { OpenAIProvider } from '../dist/speech/providers/openai-provider'
import { FallbackProvider } from '../dist/speech/providers/provider-factory'
import '../src/utils/env-loader.js'

async function test() {
  console.error('\n=== Testing Fallback with Invalid ElevenLabs Key ===\n')

  const elevenlabs = new ElevenLabsProvider({
    apiKey: 'invalid-key-123',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
  })

  const openai = new OpenAIProvider({
    apiKey: process.env['OPENAI_API_KEY'],
  })

  const provider = new FallbackProvider(elevenlabs, openai)

  console.error('Speaking with invalid ElevenLabs key (should fallback to OpenAI)...')
  const result = await provider.speak('Testing fallback mechanism')

  console.error('\nResult:', result)

  if (result.success) {
    console.error(`✅ SUCCESS - Used provider: ${result.provider}`)
    if (result.provider === 'openai') {
      console.error('✅ Correctly fell back to OpenAI!')
    }
  } else {
    console.error(`❌ FAILED: ${result.error}`)
  }
}

test().catch(console.error)
