/**
 * Basic Voice Vault Usage Examples
 *
 * This file demonstrates the fundamental usage patterns of Voice Vault,
 * from zero-config usage to advanced configuration scenarios.
 */

import VoiceVault, { type CacheStats, type VoiceVaultPreloadResult } from '../src/index.js'

/**
 * Example 1: Zero-Config Usage
 * The simplest way to use Voice Vault - just speak!
 */
async function example1_ZeroConfig(): Promise<void> {
  console.log('🔹 Example 1: Zero-Config Usage')

  // Create instance with all defaults
  const vault = new VoiceVault()

  // Speak text - uses default provider, voice, and settings
  await vault.speak('Hello world! This is Voice Vault speaking.')

  // That's it! Voice Vault handles:
  // - Provider selection (tries OpenAI, ElevenLabs, then system)
  // - Caching (saves to temp directory)
  // - Audio playback (plays through system audio)
  // - Error handling and fallbacks
  // - Structured logging for observability

  console.log('✅ Zero-config example completed')
}

/**
 * Example 2: Basic Configuration
 * Customize common settings while keeping it simple
 */
async function example2_BasicConfig(): Promise<void> {
  console.log('🔹 Example 2: Basic Configuration')

  // Configure with common options
  const vault = new VoiceVault({
    logging: {
      level: 'info', // 'debug', 'info', 'warn', 'error'
    },
    cache: {
      enabled: true,
      maxSizeBytes: 256 * 1024 * 1024, // 256MB cache limit
      maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days cache retention
    },
  })

  // Speak with voice options
  const result = await vault.speak('Welcome to Voice Vault!', {
    voice: 'nova', // OpenAI voice
    speed: 1.2, // Slightly faster
  })

  console.log(`Spoke in ${result.durationMs}ms using ${result.providerName}`)
  console.log(`Audio ${result.fromCache ? 'served from cache' : 'generated fresh'}`)

  console.log('✅ Basic configuration example completed')
}

/**
 * Example 3: Provider-Specific Configuration
 * Configure specific TTS providers with their settings
 */
async function example3_ProviderConfig(): Promise<void> {
  console.log('🔹 Example 3: Provider-Specific Configuration')

  const vault = new VoiceVault({
    providers: {
      // OpenAI TTS configuration
      openai: {
        apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
        model: 'tts-1-hd', // High quality model
        defaultVoice: 'nova',
        defaultSpeed: 1.0,
        defaultFormat: 'mp3',
      },
      // ElevenLabs configuration
      elevenlabs: {
        apiKey: process.env.ELEVENLABS_API_KEY || 'your-api-key-here',
        defaultVoiceId: 'ErXwobaYiN019PkySvjV', // Antoni voice
        defaultModelId: 'eleven_monolingual_v1',
        stability: 0.5,
        similarityBoost: 0.5,
      },
    },
  })

  // Use specific provider
  const openaiResult = await vault.speak('This uses OpenAI TTS', {
    provider: 'openai',
    voice: 'alloy',
    speed: 0.9,
  })

  console.log(`OpenAI result: ${openaiResult.providerName} in ${openaiResult.durationMs}ms`)

  // Try ElevenLabs with fallback
  const elevenlabsResult = await vault.speak('This tries ElevenLabs first', {
    provider: 'elevenlabs',
    // If ElevenLabs fails, will fallback to OpenAI then system
  })

  console.log(
    `ElevenLabs result: ${elevenlabsResult.providerName} in ${elevenlabsResult.durationMs}ms`,
  )

  console.log('✅ Provider configuration example completed')
}

/**
 * Example 4: Preloading and Cache Management
 * Demonstrate cache warming and management features
 */
async function example4_CacheManagement(): Promise<void> {
  console.log('🔹 Example 4: Cache Management')

  const vault = new VoiceVault({
    cache: {
      enabled: true,
      enableHitLogging: true, // Log cache hits for observability
    },
  })

  // Preload content into cache (doesn't play)
  console.log('Preloading frequently used phrases...')

  const preloadResults: VoiceVaultPreloadResult[] = []
  const phrases = [
    'Welcome back!',
    'Please wait while we process your request.',
    'Thank you for your patience.',
    'Your request has been completed successfully.',
  ]

  for (const phrase of phrases) {
    const result = await vault.preload(phrase, { voice: 'nova' })
    preloadResults.push(result)
    console.log(
      `Preloaded "${phrase}": ${result.alreadyCached ? 'already cached' : 'generated'} in ${result.durationMs}ms`,
    )
  }

  // Now speaking should be very fast (cache hits)
  console.log('\nSpeaking preloaded phrases (should be fast):')

  for (const phrase of phrases.slice(0, 2)) {
    const result = await vault.speak(phrase, { voice: 'nova' })
    console.log(
      `Spoke "${phrase}": ${result.fromCache ? 'from cache' : 'generated'} in ${result.durationMs}ms`,
    )
  }

  // Check cache statistics
  const stats: CacheStats = await vault.getCacheStats()
  console.log('\n📊 Cache Statistics:')
  console.log(`  Total entries: ${stats.entryCount}`)
  console.log(`  Cache size: ${(stats.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`)
  console.log(`  Total hits: ${stats.cacheHits}`)
  console.log(`  Total misses: ${stats.cacheMisses}`)

  console.log('✅ Cache management example completed')
}

/**
 * Example 5: Error Handling and Observability
 * Demonstrate proper error handling and logging
 */
async function example5_ErrorHandling(): Promise<void> {
  console.log('🔹 Example 5: Error Handling and Observability')

  const vault = new VoiceVault({
    logging: { level: 'debug' }, // Verbose logging
    providers: {
      // Invalid configuration to demonstrate fallback
      openai: {
        apiKey: 'invalid-key',
      },
    },
  })

  // This should fallback gracefully
  const result = await vault.speak('Testing error handling and fallbacks')

  if (result.success) {
    console.log(`✅ Fallback successful: used ${result.providerName}`)
  } else {
    console.log(`❌ All providers failed: ${result.error}`)
  }

  // Check system health
  try {
    const health = await vault.getHealthStatus()
    console.log(`\n🏥 Health Status: ${health.status}`)
    console.log(`  Cache hit rate: ${(health.metrics.cacheHitRate * 100).toFixed(1)}%`)

    for (const [providerName, providerHealth] of Object.entries(health.components.providers)) {
      console.log(`  ${providerName}: ${providerHealth.status}`)
    }

    for (const message of health.messages) {
      console.log(`  📝 ${message}`)
    }
  } catch (error) {
    console.error('Health check failed:', error)
  }

  console.log('✅ Error handling example completed')
}

/**
 * Example 6: Advanced Usage with Correlation IDs
 * Demonstrate correlation ID usage for request tracing
 */
async function example6_CorrelationIds(): Promise<void> {
  console.log('🔹 Example 6: Correlation IDs for Request Tracing')

  const vault = new VoiceVault({
    logging: { level: 'info' },
  })

  // Use custom correlation ID for request tracing
  const sessionId = `session-${Date.now()}`

  console.log(`Starting session: ${sessionId}`)

  // All operations in this session will use the same correlation ID
  await vault.speak('Starting conversation session', {}, true, sessionId)

  const stats = await vault.getCacheStats(sessionId)
  console.log(`Cache stats for ${sessionId}: ${stats.entryCount} entries`)

  // Preload with same correlation ID
  await vault.preload('Session ending soon', {}, sessionId)

  await vault.speak('Session ending soon', {}, true, sessionId)

  console.log(`Session ${sessionId} completed`)

  // All log entries will have the same correlationId field for easy tracing
  console.log('✅ Correlation ID example completed')
}

/**
 * Example 7: Cleanup and Resource Management
 * Demonstrate proper cleanup for long-running applications
 */
async function example7_Cleanup(): Promise<void> {
  console.log('🔹 Example 7: Resource Management and Cleanup')

  const vault = new VoiceVault()

  // Use the vault
  await vault.speak('This is a demonstration of cleanup')

  // Get final stats before cleanup
  const stats = await vault.getCacheStats()
  console.log(`Before cleanup: ${stats.entryCount} cache entries`)

  // Clear cache if needed
  const clearedEntries = await vault.clearCache()
  console.log(`Cleared ${clearedEntries} cache entries`)

  // Proper cleanup (important for long-running applications)
  await vault.cleanup()
  console.log('Voice Vault cleanup completed')

  console.log('✅ Cleanup example completed')
}

/**
 * Main execution function - runs all examples
 */
async function runAllExamples(): Promise<void> {
  console.log('🚀 Voice Vault Usage Examples\n')

  try {
    await example1_ZeroConfig()
    console.log()

    await example2_BasicConfig()
    console.log()

    await example3_ProviderConfig()
    console.log()

    await example4_CacheManagement()
    console.log()

    await example5_ErrorHandling()
    console.log()

    await example6_CorrelationIds()
    console.log()

    await example7_Cleanup()
    console.log()

    console.log('🎉 All examples completed successfully!')
  } catch (error) {
    console.error('❌ Example failed:', error)
    process.exit(1)
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error)
}

// Export examples for individual testing
export {
  example1_ZeroConfig,
  example2_BasicConfig,
  example3_ProviderConfig,
  example4_CacheManagement,
  example5_ErrorHandling,
  example6_CorrelationIds,
  example7_Cleanup,
  runAllExamples,
}
