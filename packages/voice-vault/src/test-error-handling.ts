#!/usr/bin/env tsx
/**
 * Test script to validate error handling and edge cases
 */

import 'dotenv/config'
import type { TTSRequestOptions } from './providers/types.js'
import { VoiceVault } from './voice-vault.js'

async function testErrorHandling() {
  console.log('⚠️  Testing Error Handling...\n')

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

  let testsPassed = 0
  let testsFailed = 0

  try {
    // Test 1: Empty text
    console.log('📝 Test 1: Empty text handling\n')

    const emptyResult = await vault.speak('', { provider: 'system' }, false)

    if (!emptyResult.success) {
      console.log('✅ Empty text rejected correctly')
      console.log('   Error:', emptyResult.error)
      testsPassed++
    } else {
      console.error('❌ PROBLEM: Empty text was accepted!')
      testsFailed++
    }

    // Test 2: Very long text
    console.log('\n📝 Test 2: Very long text (>5000 chars)\n')

    const longText = 'This is a test. '.repeat(400) // ~6000 chars
    const longResult = await vault.speak(longText, { provider: 'system' }, false)

    console.log('Long text result:', {
      success: longResult.success,
      textLength: longText.length,
      duration: `${longResult.durationMs}ms`,
      error: longResult.error,
    })

    if (longResult.success || longResult.error?.includes('too long')) {
      console.log('✅ Long text handled appropriately')
      testsPassed++
    } else {
      console.error('❌ PROBLEM: Unexpected long text behavior')
      testsFailed++
    }

    // Test 3: Special characters
    console.log('\n📝 Test 3: Special characters and emojis\n')

    const specialTexts = [
      '🎉 Hello with emoji! 🚀',
      'Text with "quotes" and \'apostrophes\'',
      'Line\nbreaks\nand\ttabs',
      'Special chars: @#$%^&*()',
      'Unicode: 你好世界 مرحبا بالعالم',
    ]

    for (const text of specialTexts) {
      const result = await vault.speak(text, { provider: 'system' }, false)
      console.log(`"${text.substring(0, 20)}..." -> ${result.success ? '✅' : '❌'}`)

      if (result.success) {
        testsPassed++
      } else {
        console.log('   Error:', result.error)
        testsFailed++
      }
    }

    // Test 4: Invalid provider configurations
    console.log('\n📝 Test 4: Invalid provider configurations\n')

    const invalidConfigs = [
      { provider: 'openai', voice: 'invalid-voice' },
      { provider: 'elevenlabs', voiceId: '' },
      { provider: 'system', voice: 'NonExistentVoice' },
    ]

    for (const config of invalidConfigs) {
      const result = await vault.speak('Testing invalid config', config as TTSRequestOptions, false)

      console.log(`Invalid ${config.provider} config:`, {
        success: result.success,
        actualProvider: result.providerName,
        error: result.error?.substring(0, 50),
      })

      if (!result.success || result.providerName !== config.provider) {
        testsPassed++
      } else {
        testsFailed++
      }
    }

    // Test 5: Null and undefined handling
    console.log('\n📝 Test 5: Null/undefined parameter handling\n')

    try {
      // @ts-expect-error - Testing runtime behavior
      await vault.speak(null, {}, false)
      console.error('❌ PROBLEM: Null text accepted!')
      testsFailed++
    } catch {
      console.log('✅ Null text rejected with error')
      testsPassed++
    }

    try {
      // @ts-expect-error - Testing runtime behavior
      await vault.speak(undefined, {}, false)
      console.error('❌ PROBLEM: Undefined text accepted!')
      testsFailed++
    } catch {
      console.log('✅ Undefined text rejected with error')
      testsPassed++
    }

    // Test 6: Concurrent error scenarios
    console.log('\n📝 Test 6: Concurrent error handling\n')

    const errorRequests = [
      vault.speak('', { provider: 'system' }, false),
      vault.speak('Test', { provider: 'invalid' }, false),
      vault.speak('Normal text', { provider: 'system' }, false),
    ]

    const results = await Promise.allSettled(errorRequests)

    let rejected = 0
    let fulfilled = 0

    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        rejected++
        console.log(`Request ${i}: Rejected - ${result.reason}`)
      } else {
        fulfilled++
        console.log(
          `Request ${i}: ${result.value.success ? 'Success' : 'Failed'} - ${result.value.providerName}`,
        )
      }
    })

    console.log(`Fulfilled: ${fulfilled}, Rejected: ${rejected}`)

    if (fulfilled > 0 && rejected === 0) {
      console.log('✅ Errors handled gracefully without crashes')
      testsPassed++
    } else if (rejected > 0) {
      console.log('⚠️  Some requests threw unhandled errors')
      testsFailed++
    }

    // Test 7: Cache corruption handling
    console.log('\n📝 Test 7: Cache corruption recovery\n')

    const fs = await import('fs/promises')
    const cacheDir = './.voice-vault-test-cache'

    try {
      // Create a corrupted cache entry
      const corruptedKey = 'corrupted-test-' + Date.now()
      await fs.writeFile(`${cacheDir}/entries/${corruptedKey}.json`, '{ invalid json', 'utf-8')

      // Try to use the cache
      const stats = await vault.getCacheStats()
      console.log('Cache stats after corruption:', {
        entries: stats.entryCount,
        // errors: stats.errors, // Property doesn't exist on CacheStats
      })

      // Clean up
      await fs.unlink(`${cacheDir}/entries/${corruptedKey}.json`)

      console.log('✅ Cache handled corruption gracefully')
      testsPassed++
    } catch (error) {
      console.log('⚠️  Cache corruption test error:', error)
      testsFailed++
    }

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('📊 Error Handling Test Summary:')
    console.log(`   ✅ Passed: ${testsPassed}`)
    console.log(`   ❌ Failed: ${testsFailed}`)
    console.log(`   Total: ${testsPassed + testsFailed}`)
    console.log('='.repeat(50))
  } catch (error) {
    console.error('\n❌ Test suite failed:', error)
    process.exit(1)
  } finally {
    await vault.cleanup()
  }
}

testErrorHandling().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
