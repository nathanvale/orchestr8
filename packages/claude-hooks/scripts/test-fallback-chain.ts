#!/usr/bin/env tsx

/**
 * Test script for TTS provider fallback chain
 * Tests the complete cascade: ElevenLabs → OpenAI → macOS
 */

import type { FactoryConfig } from '../src/speech/providers/provider-factory'

import { ElevenLabsProvider } from '../src/speech/providers/elevenlabs-provider'
import { MacOSProvider } from '../src/speech/providers/macos-provider'
import { OpenAIProvider } from '../src/speech/providers/openai-provider'
import { TTSProviderFactory } from '../src/speech/providers/provider-factory'
// Load environment variables
import '../src/utils/env-loader.js'

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.error(`${colors[color]}${message}${colors.reset}`)
}

function header(title: string) {
  log(`\n${'='.repeat(60)}`, 'cyan')
  log(title, 'cyan')
  log(`${'='.repeat(60)}\n`, 'cyan')
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Register providers
TTSProviderFactory.clearProviders()
TTSProviderFactory.registerProvider('elevenlabs', ElevenLabsProvider)
TTSProviderFactory.registerProvider('openai', OpenAIProvider)
TTSProviderFactory.registerProvider('macos', MacOSProvider)

const testText = 'Testing provider fallback chain.'

async function testScenario1() {
  header('TEST 1: Valid ElevenLabs → Should use ElevenLabs (no fallback)')

  const config: FactoryConfig = {
    provider: 'auto',
    fallbackProvider: 'macos',
    elevenlabs: {
      apiKey: process.env['ELEVENLABS_API_KEY'],
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
    },
    openai: {
      apiKey: process.env['OPENAI_API_KEY'],
    },
  }

  log('Creating provider with auto mode (should select ElevenLabs)...', 'yellow')
  const provider = await TTSProviderFactory.detectBestProvider(config)

  log('Speaking with provider...', 'yellow')
  const result = await provider.speak(testText)

  if (result.success) {
    log(`✅ SUCCESS: Used provider: ${result.provider}`, 'green')
    if (result.provider === 'elevenlabs') {
      log('✅ Correctly used ElevenLabs as primary', 'green')
    } else {
      log(`⚠️ Unexpected provider: ${result.provider}`, 'yellow')
    }
  } else {
    log(`❌ FAILED: ${result.error}`, 'red')
  }
}

async function testScenario2() {
  header('TEST 2: Invalid ElevenLabs key → Should fallback to OpenAI')

  const config: FactoryConfig = {
    provider: 'elevenlabs',
    fallbackProvider: 'macos',
    elevenlabs: {
      apiKey: 'invalid-key-test',
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
    },
    openai: {
      apiKey: process.env['OPENAI_API_KEY'],
    },
  }

  log('Creating provider with invalid ElevenLabs key...', 'yellow')
  const provider = await TTSProviderFactory.createWithFallback(config)

  log('Speaking with provider (should fallback)...', 'yellow')
  const result = await provider.speak(testText)

  if (result.success) {
    log(`✅ SUCCESS: Used provider: ${result.provider}`, 'green')
    if (result.provider === 'openai' || result.provider === 'macos') {
      log(`✅ Correctly fell back to ${result.provider}`, 'green')
    } else {
      log(`⚠️ Unexpected provider: ${result.provider}`, 'yellow')
    }
  } else {
    log(`❌ FAILED: ${result.error}`, 'red')
  }
}

async function testScenario3() {
  header('TEST 3: No API keys → Should fallback to macOS')

  const config: FactoryConfig = {
    provider: 'auto',
    fallbackProvider: 'macos',
    elevenlabs: {
      apiKey: '', // No API key
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
    },
    openai: {
      apiKey: '', // No API key
    },
  }

  log('Creating provider with no API keys...', 'yellow')
  const provider = await TTSProviderFactory.detectBestProvider(config)

  log('Speaking with provider (should use macOS)...', 'yellow')
  const result = await provider.speak(testText)

  if (result.success) {
    log(`✅ SUCCESS: Used provider: ${result.provider}`, 'green')
    if (result.provider === 'macos') {
      log('✅ Correctly used macOS as final fallback', 'green')
    } else {
      log(`⚠️ Unexpected provider: ${result.provider}`, 'yellow')
    }
  } else {
    log(`❌ FAILED: ${result.error}`, 'red')
  }
}

async function testScenario4() {
  header('TEST 4: Invalid keys for both ElevenLabs and OpenAI → Should use macOS')

  log('Creating provider with invalid keys for both services...', 'yellow')

  // Create a nested fallback: ElevenLabs → OpenAI → macOS
  const elevenlabsProvider = new ElevenLabsProvider({
    apiKey: 'invalid-elevenlabs-key',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
  })

  const openaiProvider = new OpenAIProvider({
    apiKey: 'invalid-openai-key',
  })

  const macosProvider = new MacOSProvider({})

  // Manually create nested fallback
  const { FallbackProvider } = await import('../src/speech/providers/provider-factory')
  const openaiWithMacOSFallback = new FallbackProvider(openaiProvider, macosProvider)
  const fullChain = new FallbackProvider(elevenlabsProvider, openaiWithMacOSFallback)

  log('Speaking with nested fallback chain...', 'yellow')
  const result = await fullChain.speak(testText)

  if (result.success) {
    log(`✅ SUCCESS: Used provider: ${result.provider}`, 'green')
    if (result.provider === 'macos') {
      log('✅ Correctly cascaded to macOS after both API failures', 'green')
    } else {
      log(`⚠️ Unexpected provider: ${result.provider}`, 'yellow')
    }
  } else {
    log(`❌ FAILED: ${result.error}`, 'red')
  }
}

async function testScenario5() {
  header('TEST 5: Simulate quota exceeded (ElevenLabs) → Should fallback')

  // Create a mock provider that simulates quota exceeded
  class MockElevenLabsProvider extends ElevenLabsProvider {
    async speak(_text: string, _options?: { detached?: boolean }) {
      log('Simulating ElevenLabs quota exceeded error...', 'magenta')
      return {
        success: false,
        provider: 'elevenlabs',
        error: 'Quota exceeded - you have used all your character allocation',
      }
    }
  }

  const mockProvider = new MockElevenLabsProvider({
    apiKey: 'test-key',
    voiceId: 'test-voice',
  })

  const openaiProvider = new OpenAIProvider({
    apiKey: process.env['OPENAI_API_KEY'] || 'test-key',
  })

  const { FallbackProvider } = await import('../src/speech/providers/provider-factory')
  const provider = new FallbackProvider(mockProvider, openaiProvider)

  log('Speaking with simulated quota error...', 'yellow')
  const result = await provider.speak(testText)

  if (result.success) {
    log(`✅ SUCCESS: Fell back to: ${result.provider}`, 'green')
    if (result.provider === 'openai' || result.provider === 'macos') {
      log('✅ Correctly handled quota exceeded error', 'green')
    }
  } else {
    log(`❌ FAILED: ${result.error}`, 'red')
  }
}

async function main() {
  header('TTS PROVIDER FALLBACK CHAIN TEST')
  log('This test validates the fallback chain: ElevenLabs → OpenAI → macOS\n', 'blue')

  try {
    await testScenario1()
    await delay(2000)

    await testScenario2()
    await delay(2000)

    await testScenario3()
    await delay(2000)

    await testScenario4()
    await delay(2000)

    await testScenario5()

    header('TEST SUITE COMPLETE')
    log('All test scenarios executed. Review the results above.', 'green')
  } catch (error) {
    log(`\n❌ Test suite failed with error: ${error}`, 'red')
    console.error(error)
    process.exit(1)
  }
}

// Run the tests
main().catch((error) => {
  log(`Fatal error: ${error}`, 'red')
  console.error(error)
  process.exit(1)
})
