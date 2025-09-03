#!/usr/bin/env tsx
/**
 * Test script to validate cache behavior and look for problems in logs
 */

import 'dotenv/config'
import { VoiceVault } from './voice-vault.js'

async function testCacheValidation() {
  console.log('🔍 Testing Cache Validation...\n')

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
  })

  try {
    // Test 1: Same text, different providers - should have different cache keys
    console.log('📝 Test 1: Same text, different providers\n')

    const text = 'Testing cache key generation across providers'

    // Try with system TTS
    const systemResult = await vault.speak(text, { provider: 'system' }, false)
    console.log('System cache key:', systemResult.cacheKey?.substring(0, 16) + '...')

    // Try with ElevenLabs (if configured)
    const elevenResult = await vault.speak(
      text,
      {
        provider: 'elevenlabs',
        voice: '21m00Tcm4TlvDq8ikWAM', // Rachel
      },
      false,
    )
    console.log('ElevenLabs cache key:', elevenResult.cacheKey?.substring(0, 16) + '...')

    if (systemResult.cacheKey === elevenResult.cacheKey) {
      console.error('❌ PROBLEM: Same cache key for different providers!')
    } else {
      console.log('✅ Different cache keys for different providers')
    }

    // Test 2: Same text, same provider, different voices - should have different cache keys
    console.log('\n📝 Test 2: Same provider, different voices\n')

    const voice1Result = await vault.speak(
      'Hello world',
      {
        provider: 'system',
        voice: 'Samantha',
      },
      false,
    )

    const voice2Result = await vault.speak(
      'Hello world',
      {
        provider: 'system',
        voice: 'Alex',
      },
      false,
    )

    if (voice1Result.cacheKey === voice2Result.cacheKey) {
      console.error('❌ PROBLEM: Same cache key for different voices!')
    } else {
      console.log('✅ Different cache keys for different voices')
    }

    // Test 3: Cache hit rate calculation
    console.log('\n📝 Test 3: Cache statistics\n')

    const stats = await vault.getCacheStats()
    console.log('Cache Stats:', {
      hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
      hits: stats.hits,
      misses: stats.misses,
      apiCallsSaved: stats.apiCallsSaved,
      entries: stats.entryCount,
      sizeBytes: stats.totalSizeBytes,
    })

    if (stats.hits + stats.misses === 0) {
      console.error('❌ PROBLEM: No cache operations recorded!')
    }

    // Test 4: Text normalization edge cases
    console.log('\n📝 Test 4: Text normalization edge cases\n')

    const texts = [
      'HELLO WORLD',
      'hello world',
      'Hello  World', // double space
      'Hello\nWorld', // newline
      'Hello\tWorld', // tab
    ]

    const cacheKeys = new Set()
    for (const t of texts) {
      const result = await vault.speak(t, { provider: 'system' }, false)
      cacheKeys.add(result.cacheKey)
      console.log(`Text: "${t}" -> Key: ${result.cacheKey?.substring(0, 8)}...`)
    }

    if (cacheKeys.size === 1) {
      console.log('✅ All normalized to same cache key')
    } else {
      console.log(`⚠️  Generated ${cacheKeys.size} different keys - check normalization`)
    }

    // Test 5: Cache file integrity
    console.log('\n📝 Test 5: Cache file integrity\n')

    const cacheDir = './.voice-vault-test-cache'
    const fs = await import('fs/promises')

    try {
      const entries = await fs.readdir(`${cacheDir}/entries`)
      const audioFiles = await fs.readdir(`${cacheDir}/audio`)

      console.log(`Found ${entries.length} cache entries`)
      console.log(`Found ${audioFiles.length} audio files`)

      // Check if any orphaned files
      for (const entry of entries) {
        if (entry.endsWith('.json')) {
          const data = JSON.parse(await fs.readFile(`${cacheDir}/entries/${entry}`, 'utf-8'))
          const audioPath = `${cacheDir}/audio/${data.audioFile}`

          try {
            await fs.stat(audioPath)
          } catch {
            console.error(`❌ PROBLEM: Missing audio file for entry ${entry}`)
          }
        }
      }

      console.log('✅ Cache integrity check complete')
    } catch (error) {
      console.error('❌ Error checking cache:', error)
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  } finally {
    await vault.cleanup()
  }
}

testCacheValidation().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
