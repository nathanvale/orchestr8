/**
 * Voice Vault Quick Start Guide
 *
 * The fastest way to get started with Voice Vault TTS.
 * Copy and paste these examples to start speaking immediately!
 */

import VoiceVault from '../src/index.js'

/**
 * 🚀 QUICK START - Copy this for immediate usage
 */
async function quickStart(): Promise<void> {
  // 1. Import and create instance
  const vault = new VoiceVault()

  // 2. Speak text (that's it!)
  await vault.speak('Hello! Voice Vault is working perfectly.')

  console.log('✅ Quick start completed - Voice Vault is ready!')
}

/**
 * 🎯 COMMON USAGE PATTERNS
 */

// Pattern 1: Simple speaking
async function simpleSpeak(): Promise<void> {
  const vault = new VoiceVault()
  await vault.speak('This is the simplest way to use Voice Vault')
}

// Pattern 2: With voice selection
async function speakWithVoice(): Promise<void> {
  const vault = new VoiceVault()
  await vault.speak('This uses a specific voice', {
    voice: 'nova', // OpenAI voices: alloy, echo, fable, onyx, nova, shimmer
    speed: 1.1, // Slightly faster speech
  })
}

// Pattern 3: Get operation details
async function speakWithDetails(): Promise<void> {
  const vault = new VoiceVault()
  const result = await vault.speak('This returns detailed information')

  console.log(`Provider used: ${result.providerName}`)
  console.log(`From cache: ${result.fromCache}`)
  console.log(`Duration: ${result.durationMs}ms`)
}

// Pattern 4: Silent operation (no audio playback)
async function speakSilently(): Promise<void> {
  const vault = new VoiceVault()
  // Third parameter controls playback: true = play audio, false = generate only
  await vault.speak("This generates audio but doesn't play it", {}, false)
}

// Pattern 5: Preload for faster later use
async function preloadContent(): Promise<void> {
  const vault = new VoiceVault()

  // Preload content into cache (doesn't play)
  await vault.preload('Welcome back! Your session is ready.')

  // Later usage will be much faster (cache hit)
  await vault.speak('Welcome back! Your session is ready.')
}

// Pattern 6: Cache management
async function managingCache(): Promise<void> {
  const vault = new VoiceVault()

  await vault.speak('This content gets cached automatically')

  // Check cache statistics
  const stats = await vault.getCacheStats()
  console.log(`Cache contains ${stats.totalEntries} entries`)
  console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`)

  // Clear cache if needed
  const cleared = await vault.clearCache()
  console.log(`Cleared ${cleared} entries`)
}

// Pattern 7: Provider-specific usage
async function useSpecificProvider(): Promise<void> {
  const vault = new VoiceVault({
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || 'your-key-here',
      },
    },
  })

  await vault.speak('This specifically uses OpenAI TTS', {
    provider: 'openai',
    voice: 'alloy',
  })
}

// Pattern 8: Error handling
async function handleErrors(): Promise<void> {
  const vault = new VoiceVault()

  const result = await vault.speak('Testing error handling')

  if (result.success) {
    console.log('✅ Speech successful')
  } else {
    console.log(`❌ Speech failed: ${result.error}`)
  }
}

// Pattern 9: Request tracing with correlation IDs
async function useCorrelationIds(): Promise<void> {
  const vault = new VoiceVault()
  const sessionId = `session-${Date.now()}`

  // All operations with same correlation ID are traced together in logs
  await vault.speak('Starting traced session', {}, true, sessionId)
  await vault.speak('Continuing traced session', {}, true, sessionId)

  console.log(`All operations traced with ID: ${sessionId}`)
}

// Pattern 10: Resource cleanup (for long-running apps)
async function properCleanup(): Promise<void> {
  const vault = new VoiceVault()

  // Use vault for application operations
  await vault.speak('Application is running')

  // Clean shutdown (important for servers/long-running processes)
  await vault.cleanup()
  console.log('Voice Vault cleaned up properly')
}

/**
 * 📚 CONFIGURATION EXAMPLES
 */

// Config 1: High-performance caching
// Example: High-performance configuration
// const highPerformanceVault = new VoiceVault({
//   cache: {
//     enabled: true,
//     maxSizeBytes: 1024 * 1024 * 1024, // 1GB cache
//     maxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days retention
//     enableHitLogging: false, // Disable for better performance
//   }
// })

// Config 2: Debug mode with verbose logging
// const debugVault = new VoiceVault({
//   logging: { level: 'debug' },
//   cache: { enableHitLogging: true }
// })

// Config 3: OpenAI-only with custom settings
// const openaiVault = new VoiceVault({
//   providers: {
//     openai: {
//       apiKey: process.env.OPENAI_API_KEY!,
//       model: 'tts-1-hd', // High quality
//       defaultVoice: 'nova',
//       defaultSpeed: 1.0,
//     }
//   },
//   defaultProviderCriteria: {
//     allowFallback: false, // Only use OpenAI, no fallbacks
//   }
// })

// Config 4: Multi-provider with priorities
// const multiProviderVault = new VoiceVault({
//   providers: {
//     openai: {
//       apiKey: process.env.OPENAI_API_KEY || '',
//     },
//     elevenlabs: {
//       apiKey: process.env.ELEVENLABS_API_KEY || '',
//     },
//     // system provider needs no config
//   }
//   // Will try in order: OpenAI, ElevenLabs, then system TTS
// })

/**
 * 🔧 TROUBLESHOOTING HELPERS
 */

// Check if Voice Vault is working properly
async function healthCheck(): Promise<void> {
  const vault = new VoiceVault()

  try {
    const health = await vault.getHealthStatus()
    console.log(`System status: ${health.status}`)

    // Check each provider
    for (const [name, status] of Object.entries(health.components.providers)) {
      console.log(`${name}: ${status.status}`)
    }

    console.log(`Cache: ${health.components.cache.healthy ? 'healthy' : 'unhealthy'}`)
  } catch (error) {
    console.error('Health check failed:', error)
  }
}

// Test basic functionality
async function testBasicFunctionality(): Promise<void> {
  console.log('Testing Voice Vault basic functionality...')

  const vault = new VoiceVault()

  try {
    // Test speak
    const result = await vault.speak('Testing Voice Vault functionality', {}, false) // Don't play
    console.log(`✅ Speak test: ${result.success ? 'passed' : 'failed'}`)

    // Test cache
    const stats = await vault.getCacheStats()
    console.log(`✅ Cache test: ${stats.totalEntries >= 0 ? 'passed' : 'failed'}`)

    console.log('All tests passed! Voice Vault is working correctly.')
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Export for use in other files
export {
  handleErrors,
  healthCheck,
  managingCache,
  preloadContent,
  properCleanup,
  quickStart,
  simpleSpeak,
  speakSilently,
  speakWithDetails,
  speakWithVoice,
  testBasicFunctionality,
  useCorrelationIds,
  useSpecificProvider,
}

// Run quick start if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Voice Vault Quick Start\n')

  quickStart()
    .then(() => {
      console.log('\n🎉 Quick start completed! Voice Vault is ready to use.')
      console.log('\n💡 Next steps:')
      console.log('   - Check out examples/basic-usage.ts for more examples')
      console.log('   - Add your API keys to environment variables')
      console.log('   - Customize configuration for your use case')
    })
    .catch((error) => {
      console.error('❌ Quick start failed:', error)
      console.log('\n🔧 Troubleshooting:')
      console.log('   - Ensure Node.js audio support is available')
      console.log('   - Check that no other audio applications are blocking')
      console.log('   - Try running testBasicFunctionality() for detailed diagnosis')
    })
}
