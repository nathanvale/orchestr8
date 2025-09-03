#!/usr/bin/env npx tsx

import { loadConfigFromEnv } from '../src/config/env-config'
import { initializeProviders } from '../src/speech/providers/index'
import { TTSProviderFactory } from '../src/speech/providers/provider-factory'

async function testProviderSelection() {
  console.error('Testing TTS Provider Selection\n')
  console.error('Environment Variables:')
  console.error('  ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? 'Set' : 'Not set')
  console.error('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set')
  console.error('  CLAUDE_HOOKS_TTS_PROVIDER:', process.env.CLAUDE_HOOKS_TTS_PROVIDER || 'Not set')
  console.error('')

  // Initialize providers
  initializeProviders()

  // Load config from environment
  const config = loadConfigFromEnv({})
  console.log('Loaded config from environment:')
  console.log('  tts.provider:', config.tts?.provider || 'Not set')
  console.log('  tts.fallbackProvider:', config.tts?.fallbackProvider || 'Not set')
  console.log('')

  // Test factory config
  const factoryConfig = {
    provider: config.tts?.provider || 'auto',
    fallbackProvider: config.tts?.fallbackProvider || 'macos',
    openai: config.tts?.openai || {},
    macos: config.tts?.macos || { enabled: true },
    elevenlabs: config.tts?.elevenlabs || {},
  }

  console.log('Factory Config:')
  console.log('  provider:', factoryConfig.provider)
  console.log('  fallbackProvider:', factoryConfig.fallbackProvider)
  console.log('')

  try {
    const provider = await TTSProviderFactory.createWithFallback(factoryConfig)
    const info = provider.getProviderInfo()
    console.log('Selected Provider:')
    console.log('  Name:', info.name)
    console.log('  Display Name:', info.displayName)
    console.log('')

    // Test speaking
    console.log('Testing speech...')
    const result = await provider.speak('Testing provider selection')
    console.log('Speech Result:')
    console.log('  Success:', result.success)
    console.log('  Provider:', result.provider)
    if (!result.success) {
      console.log('  Error:', result.error)
    }
  } catch (error) {
    console.error('Error creating provider:', error)
  }
}

// Run the test
testProviderSelection().catch(console.error)
