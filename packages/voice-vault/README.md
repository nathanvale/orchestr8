# Voice Vault 🎙️

> High-performance Text-to-Speech caching library with multi-provider support

Voice Vault is a production-ready Text-to-Speech (TTS) package that reduces API
costs through intelligent caching, provides multiple provider support with
automatic fallback, and offers complete observability through correlation ID
tracking.

## Features

- 🎯 **Zero-config usage** - Works immediately with `new VoiceVault()`
- 💾 **Smart caching** - Reduces API calls by 80%+ for repeated phrases
- 🔗 **Correlation ID tracking** - Every operation traceable with `vv-` prefixed
  IDs
- 📊 **Comprehensive logging** - Structured logs with @orchestr8/logger
- 🔄 **Provider fallback** - Automatic fallback: OpenAI → ElevenLabs → System
- 🚀 **ADHD-optimized** - Simple mental model, minimal cognitive load
- 📈 **Performance metrics** - Cache hit rates, API savings, operation timing

## Installation

```bash
pnpm add @template/voice-vault
```

## Quick Start

### Zero Configuration

```typescript
import VoiceVault from '@template/voice-vault'

const vault = new VoiceVault()
await vault.speak('Hello world!') // Just works!
```

### With Configuration

```typescript
const vault = new VoiceVault({
  provider: 'openai',
  cache: {
    enabled: true,
    maxSizeMB: 100,
    maxAgeDays: 30,
  },
  logging: {
    level: 'debug',
    dir: './logs',
  },
})

const result = await vault.speak('Build successful!')
console.log(`Correlation ID: ${result.correlationId}`)
```

## API Reference

### Core Methods

#### `speak(text: string, options?: SpeakOptions): Promise<SpeakResult>`

Converts text to speech and plays the audio.

```typescript
const result = await vault.speak('Deploy complete', {
  correlationId: 'deploy-123', // Optional: provide your own
  voice: 'alloy', // Provider-specific voice
  speed: 1.0, // Playback speed
})

// Result includes:
// - success: boolean
// - correlationId: string (for tracing)
// - providerName: string (which provider was used)
// - fromCache: boolean
// - durationMs: number
```

#### `preload(text: string, options?: PreloadOptions): Promise<PreloadResult>`

Pre-caches text for faster playback later.

```typescript
await vault.preload('Welcome back!') // Warm the cache
```

#### `getCacheStats(): Promise<CacheStats>`

Returns cache performance metrics.

```typescript
const stats = await vault.getCacheStats()
console.log(`Cache hit rate: ${stats.hitRate}%`)
console.log(`API calls saved: ${stats.apiCallsSaved}`)
```

#### `clearCache(): Promise<void>`

Clears all cached audio files.

```typescript
await vault.clearCache() // Clean up when needed
```

## Correlation ID Tracking

Every operation in Voice Vault is tracked with a correlation ID for complete
observability:

### Automatic Generation

```typescript
const vault = new VoiceVault()
const result = await vault.speak('Test message')
// Correlation ID automatically generated: vv-abc123-def456
console.log(`Check logs for: ${result.correlationId}`)
```

### Manual Correlation

```typescript
const correlationId = 'vv-custom-trace-id'
await vault.speak('Important message', { correlationId })
// All operations use your provided ID
```

### Log Tracing

Logs are structured with correlation IDs for easy tracing:

```log
[2025-01-23T10:30:45.123Z] [INFO] [correlation-id: vv-abc123-def456] [VoiceVault] TTS operation started
  text_length: 18
  cache_enabled: true
  provider: openai

[2025-01-23T10:30:45.245Z] [INFO] [correlation-id: vv-abc123-def456] [VoiceVault.Cache] Cache HIT
  file_path: ~/.voice-vault-cache/5f4d3e2b1a.mp3
  age_days: 2
  api_calls_saved: 47

[2025-01-23T10:30:46.789Z] [INFO] [correlation-id: vv-abc123-def456] [VoiceVault] Operation complete
  total_duration_ms: 1566
  from_cache: true
```

## Provider Configuration

### OpenAI

```typescript
const vault = new VoiceVault({
  provider: 'openai',
  providerConfig: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'tts-1-hd',
    voice: 'alloy',
    speed: 1.0,
  },
})
```

### ElevenLabs

```typescript
const vault = new VoiceVault({
  provider: 'elevenlabs',
  providerConfig: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: 'voice_id_here',
    modelId: 'eleven_turbo_v2_5',
  },
})
```

### System (macOS/Windows/Linux)

```typescript
const vault = new VoiceVault({
  provider: 'system', // Uses platform native TTS
})
```

## Environment Variables

Voice Vault automatically detects API keys from environment variables, making it
easy to use in different environments without hardcoding credentials.

### Supported Environment Variables

```bash
# OpenAI TTS Provider
OPENAI_API_KEY=sk-proj-...

# ElevenLabs TTS Provider
ELEVENLABS_API_KEY=sk_...
```

### Setting Up Environment Variables

#### For Local Development

Create a `.env` file in your project root:

```bash
# .env
OPENAI_API_KEY=your-openai-api-key-here
ELEVENLABS_API_KEY=your-elevenlabs-api-key-here
```

Then load it in your application:

```typescript
// Using dotenv (for Node.js)
import 'dotenv/config'
import { VoiceVault } from '@template/voice-vault'

const vault = new VoiceVault()
// API keys are automatically detected from process.env
```

#### For Production

Set environment variables in your deployment platform:

- **Vercel**: Add in project settings → Environment Variables
- **Heroku**: Use `heroku config:set OPENAI_API_KEY=...`
- **Docker**: Pass with `-e OPENAI_API_KEY=...` or use docker-compose
- **CI/CD**: Add as secrets in GitHub Actions, GitLab CI, etc.

### Configuration Priority

Voice Vault uses the following priority for configuration:

1. **Programmatic configuration** (highest priority)
2. **Environment variables**
3. **Default values** (lowest priority)

```typescript
// This will override the environment variable
const vault = new VoiceVault({
  providerConfig: {
    apiKey: 'override-api-key', // Takes precedence over OPENAI_API_KEY
  },
})

// This will use the environment variable
const vault = new VoiceVault()
// Uses OPENAI_API_KEY from environment
```

## Logging Configuration

Voice Vault uses @orchestr8/logger for structured logging:

### Log Levels

```typescript
const vault = new VoiceVault({
  logging: {
    level: 'debug', // trace | debug | info | warn | error
    dir: './logs', // Output directory
    pretty: true, // Human-readable format
  },
})
```

### Environment Variables

```bash
LOG_LEVEL=debug
LOG_PRETTY=true
VOICE_VAULT_LOG_DIR=./logs
```

## Cache Management

### Cache Configuration

```typescript
const vault = new VoiceVault({
  cache: {
    enabled: true,
    maxSizeMB: 100, // Maximum cache size
    maxAgeDays: 30, // Maximum age of entries
    maxEntries: 1000, // Maximum number of files
    cacheDir: '~/.voice-vault-cache',
  },
})
```

### Caching Strategy

Voice Vault implements intelligent caching to optimize costs and performance:

- **Paid Providers (OpenAI, ElevenLabs)**: Audio responses are cached to reduce
  API costs
- **Free System TTS**: Not cached since there's no API cost
- **Cache Key Generation**: Based on normalized text + voice + speed + provider
  settings
- **LRU Eviction**: Automatically removes least recently used entries when cache
  is full
- **TTL Expiration**: Entries expire after configured maxAgeDays

```typescript
// Example: OpenAI responses are cached
const result1 = await vault.speak('Hello', { provider: 'openai' })
// Makes API call, caches result

const result2 = await vault.speak('Hello', { provider: 'openai' })
// Uses cached audio, no API call

// System TTS is never cached
const result3 = await vault.speak('Hello', { provider: 'system' })
// Always generates fresh audio
```

### Cache Statistics

Monitor cache performance:

```typescript
const stats = await vault.getCacheStats()
console.log({
  hitRate: stats.hitRate,
  totalRequests: stats.totalRequests,
  cacheHits: stats.cacheHits,
  cacheMisses: stats.cacheMisses,
  apiCallsSaved: stats.apiCallsSaved,
  diskUsageMB: stats.totalSizeMB,
})
```

## Error Handling

Voice Vault provides graceful error handling with provider fallback:

```typescript
try {
  const result = await vault.speak('Test message')
  if (!result.success) {
    console.error(`TTS failed: ${result.error}`)
    // Check correlation ID in logs for details
    console.log(`Debug with: ${result.correlationId}`)
  }
} catch (error) {
  // Only thrown for critical errors
  console.error('Critical error:', error)
}
```

## Examples

### Basic Usage

```typescript
import VoiceVault from '@template/voice-vault'

const vault = new VoiceVault()

// Simple usage
await vault.speak('Hello world!')

// With options
await vault.speak('Build complete', {
  voice: 'nova',
  speed: 1.2,
})

// Check cache
const stats = await vault.getCacheStats()
console.log(`Saved ${stats.apiCallsSaved} API calls`)
```

### Advanced Configuration

```typescript
const vault = new VoiceVault({
  provider: 'openai',
  providerConfig: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'tts-1-hd',
    voice: 'alloy',
  },
  cache: {
    enabled: true,
    maxSizeMB: 200,
    maxAgeDays: 60,
  },
  logging: {
    level: 'info',
    dir: './logs',
  },
})

// Preload common phrases
await vault.preload('Welcome back!')
await vault.preload('Task completed!')

// Use with correlation tracking
const correlationId = `user-${userId}-session-${sessionId}`
await vault.speak('Welcome back!', { correlationId })
```

### Debugging with Logs

```typescript
// Enable debug logging
const vault = new VoiceVault({
  logging: { level: 'debug' },
})

const result = await vault.speak('Debug test')

// Find all logs for this operation
console.log(`grep "${result.correlationId}" logs/*.log`)
```

## Architecture

Voice Vault is built with a modular architecture:

- **Cache Layer**: Intelligent audio caching with LRU eviction
- **Provider System**: Pluggable TTS providers with fallback
- **Audio Player**: Cross-platform audio playback
- **Logging Infrastructure**: Structured logging with correlation IDs

## Performance

- **Cache Hit Rate**: Typically 80%+ for repeated phrases
- **Operation Overhead**: <5ms for cache hits
- **API Latency**: 200-500ms for cache misses (provider dependent)
- **Memory Usage**: ~10MB base + cache size

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run examples
pnpm example:basic
pnpm example:cache
pnpm example:logging
```

## License

MIT

## Contributing

Contributions are welcome! Please ensure all operations include correlation ID
tracking and comprehensive logging.

---

Built with 🧠 ADHD-friendly design principles and complete observability in
mind.
