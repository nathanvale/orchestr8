# Voice Vault Examples

This directory contains comprehensive examples demonstrating how to use Voice
Vault TTS effectively.

## Quick Start

For immediate usage, start with:

```typescript
import VoiceVault from '@voice-vault/core'

const vault = new VoiceVault()
await vault.speak('Hello world!')
```

## Example Files

### 📚 [quick-start.ts](./quick-start.ts)

**Start here!** The fastest way to get Voice Vault working.

- Zero-config usage patterns
- Common configuration examples
- Troubleshooting helpers
- Copy-paste ready code snippets

### 🎯 [basic-usage.ts](./basic-usage.ts)

Comprehensive examples covering all major features:

- Zero-config and custom configurations
- Provider-specific settings
- Cache management and preloading
- Error handling and observability
- Correlation IDs for request tracing
- Proper cleanup and resource management

### 🧪 [test-audio.ts](./test-audio.ts)

Simple test script for verifying Voice Vault functionality.

## Running Examples

### Option 1: Direct Execution

```bash
# Quick start
npx tsx examples/quick-start.ts

# Full examples
npx tsx examples/basic-usage.ts

# Audio test
npx tsx examples/test-audio.ts
```

### Option 2: Import and Use

```typescript
import { quickStart, simpleSpeak } from './examples/quick-start.js'
import { example1_ZeroConfig } from './examples/basic-usage.js'

// Run individual examples
await quickStart()
await simpleSpeak()
await example1_ZeroConfig()
```

## Common Usage Patterns

### Zero Configuration

```typescript
const vault = new VoiceVault()
await vault.speak('Hello world')
```

### With Configuration

```typescript
const vault = new VoiceVault({
  cache: { maxSizeBytes: 512 * 1024 * 1024 }, // 512MB
  logging: { level: 'info' },
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY },
  },
})

const result = await vault.speak('Welcome!', { voice: 'nova' })
console.log(`Spoke in ${result.durationMs}ms using ${result.providerName}`)
```

### Cache Management

```typescript
// Preload for faster access
await vault.preload('Frequently used phrase')

// Check cache performance
const stats = await vault.getCacheStats()
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`)

// Clear cache when needed
await vault.clearCache()
```

### Error Handling

```typescript
const result = await vault.speak('Test message')
if (result.success) {
  console.log(`Success: ${result.providerName}`)
} else {
  console.error(`Failed: ${result.error}`)
}
```

### Request Tracing

```typescript
const sessionId = `session-${Date.now()}`

// All operations traced with same correlation ID
await vault.speak('Message 1', {}, true, sessionId)
await vault.speak('Message 2', {}, true, sessionId)
// Check logs for sessionId to trace full request flow
```

## Configuration Reference

### VoiceVault Configuration

```typescript
interface VoiceVaultConfig {
  cache?: {
    enabled?: boolean
    maxSizeBytes?: number
    maxAgeMs?: number
    maxEntries?: number
    cacheDir?: string
    enableHitLogging?: boolean
  }
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error'
  }
  providers?: {
    openai?: {
      apiKey: string
      model?: 'tts-1' | 'tts-1-hd'
      defaultVoice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
      defaultSpeed?: number
    }
    elevenlabs?: {
      apiKey: string
      defaultVoiceId?: string
      defaultModelId?: string
      stability?: number
      similarityBoost?: number
    }
  }
  defaultProviderCriteria?: {
    allowFallback?: boolean
    maxResponseTimeMs?: number
  }
}
```

### Speech Options

```typescript
interface TTSRequestOptions {
  voice?: string
  speed?: number
  model?: string
  format?: 'mp3' | 'opus' | 'aac' | 'flac'
  provider?: string
}
```

## API Reference

### Main Methods

#### `speak(text, options?, play?, correlationId?)`

Generate and optionally play TTS audio.

- Returns: `VoiceVaultSpeakResult` with timing and provider info
- Auto-initializes if needed
- Handles provider fallbacks automatically

#### `preload(text, options?, correlationId?)`

Generate and cache TTS audio without playing.

- Returns: `VoiceVaultPreloadResult` with cache status
- Perfect for warming cache with common phrases

#### `getCacheStats(correlationId?)`

Get current cache statistics.

- Returns: `CacheStats` with hit rates and usage info

#### `clearCache(correlationId?)`

Clear all cached audio data.

- Returns: number of entries cleared

#### `getHealthStatus(correlationId?)`

Get comprehensive system health information.

- Returns: `VoiceVaultHealthResult` with component status

#### `cleanup(correlationId?)`

Perform clean shutdown of resources.

- Important for long-running applications

## Troubleshooting

### Common Issues

**"No available TTS provider found"**

- Check API keys in environment variables
- Ensure at least one provider is configured correctly
- System TTS should work as fallback (no API key needed)

**Audio not playing**

- Verify system audio is working
- Check that no other applications are using audio exclusively
- Try `speak(text, {}, false)` to test generation without playback

**Cache not working**

- Ensure write permissions to cache directory
- Check available disk space
- Verify cache directory is accessible

### Debug Mode

```typescript
const vault = new VoiceVault({
  logging: { level: 'debug' },
})

// Generates detailed logs for troubleshooting
```

### Health Check

```typescript
const health = await vault.getHealthStatus()
console.log(`Status: ${health.status}`)

for (const [provider, status] of Object.entries(health.components.providers)) {
  console.log(`${provider}: ${status.status}`)
}
```

## Environment Variables

```bash
# Optional - for OpenAI TTS
OPENAI_API_KEY=your_openai_api_key_here

# Optional - for ElevenLabs TTS
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Optional - custom cache directory
VOICE_VAULT_CACHE_DIR=/path/to/custom/cache

# Optional - log level
VOICE_VAULT_LOG_LEVEL=info
```

## Next Steps

1. **Start with [quick-start.ts](./quick-start.ts)** for immediate usage
2. **Explore [basic-usage.ts](./basic-usage.ts)** for comprehensive examples
3. **Set up API keys** for OpenAI/ElevenLabs if needed
4. **Customize configuration** for your specific use case
5. **Implement proper cleanup** in production applications

Voice Vault is designed to work out of the box with zero configuration, but
provides extensive customization options when needed. Happy speaking! 🗣️
