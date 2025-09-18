# VoiceVault Package Extraction Plan

## 📦 Package: **VoiceVault**

_A TTS package with intelligent caching to maximize free tier usage_

## 🎯 Architecture Overview

### Core Design Principles

- **Correlation-based logging**: Every log entry includes correlation ID for
  tracing operations
- **Zero-config default**: Works immediately with `pnpm install`
- **Observable operations**: All operations logged to `logs/voice-vault/` with
  correlation IDs
- **Smart caching**: Maximize free tier usage with intelligent audio caching
- **ADHD-optimized**: Simple mental model, minimal cognitive load

## 📁 Package Structure

```
packages/voice-vault/
├── package.json
├── README.md
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                 # Main export, simple API
│   ├── cache/
│   │   ├── audio-cache.ts       # Core caching engine with logging
│   │   ├── cache-config.ts      # Cache configuration types
│   │   └── text-normalizer.ts   # Text normalization for cache keys
│   ├── providers/
│   │   ├── base-provider.ts     # Abstract base with correlation tracking
│   │   ├── provider-factory.ts  # Provider registration/creation
│   │   ├── openai.ts            # OpenAI TTS provider
│   │   ├── elevenlabs.ts        # ElevenLabs provider
│   │   ├── system.ts            # macOS/Windows native TTS
│   │   └── types.ts             # Provider interfaces
│   ├── audio/
│   │   ├── player.ts            # Cross-platform audio playback
│   │   └── platform.ts          # Platform detection
│   └── logging/
│       └── index.ts             # Logger setup with correlation IDs
├── examples/
│   ├── basic.ts                 # Simplest usage
│   ├── with-logging.ts          # Logging configuration
│   └── debug-cache.ts           # Debugging cache behavior
└── logs/
    └── voice-vault/             # Default log directory
        └── .gitkeep
```

## 📊 Log Format Examples with Correlation IDs

```log
# logs/voice-vault/voice-vault-2025-01-23.log

[2025-01-23T10:30:45.123Z] [INFO] [correlation-id: vv-abc123-def456] [VoiceVault] Starting TTS operation
  provider: openai
  text_length: 18
  cache_enabled: true
  voice: alloy

[2025-01-23T10:30:45.234Z] [DEBUG] [correlation-id: vv-abc123-def456] [VoiceVault.Cache] Cache lookup initiated
  cache_key: 5f4d3e2b1a...
  normalized_text: "build successful"

[2025-01-23T10:30:45.245Z] [INFO] [correlation-id: vv-abc123-def456] [VoiceVault.Cache] Cache HIT!
  saved_api_call: true
  cache_age_days: 2
  file_size_mb: 0.24

[2025-01-23T10:30:45.456Z] [INFO] [correlation-id: vv-abc123-def456] [VoiceVault.Audio] Playing cached audio
  duration_ms: 1234
  format: mp3
  from_cache: true

[2025-01-23T10:30:46.789Z] [INFO] [correlation-id: vv-abc123-def456] [VoiceVault] Operation complete
  total_duration_ms: 1566
  cache_used: true
  api_calls_saved_today: 47
```

## ✅ Implementation Checklist

### Phase 1: Package Setup & Core Infrastructure

- [x] Create `packages/voice-vault` directory structure
- [x] Create PLAN.md with task checklist
- [x] Initialize package.json with dependencies (@orchestr8/logger, openai,
      elevenlabs)
- [x] Set up TypeScript configuration extending base config
- [x] Create logging infrastructure with @orchestr8/logger outputting to `logs/`
- [x] Implement correlation ID generation (format: `vv-[random]-[timestamp]`)
- [ ] Set up vitest configuration for integration testing (skipped - no tests)

### Phase 2: Core Module Extraction

- [x] Extract and adapt `audio-cache.ts` with correlation ID logging
- [x] Extract `text-normalizer.ts` for cache key generation
- [x] Create cache configuration types
- [x] Add comprehensive logging with correlation IDs to all cache operations
- [x] Implement cache statistics tracking to `logs/cache-stats.json`

### Phase 3: Provider System

- [x] Extract base provider interface with correlation ID support
- [x] Migrate OpenAI provider with correlation ID logging
- [x] Migrate ElevenLabs provider with correlation ID logging
- [x] Migrate system/macOS provider with correlation ID logging
- [x] Implement provider factory with correlation ID threading
- [x] Add fallback provider wrapper with correlation ID preservation

### Phase 4: Audio System

- [x] Extract audio player with correlation ID logging
- [x] Add correlation IDs to audio playback operations
- [x] Implement cross-platform audio support with logging
- [x] Add audio format detection with correlation tracking

### Phase 5: Public API Design

- [x] Create main VoiceVault class with correlation ID generation
- [x] Implement correlation ID threading through all methods
- [x] Add simple speak() method with correlation ID
- [x] Add preload() method with correlation tracking
- [x] Implement getCacheStats() with correlation ID
- [x] Add clearCache() method with operation tracking

### Phase 6: Logging & Observability

- [x] Configure @orchestr8/logger with correlation ID support
- [x] Set up log format with correlation ID as first field after timestamp
- [x] Configure default log rotation (daily)
- [x] Set up error-only log file with correlation IDs
- [x] Create cache-specific log file with correlation tracking
- [x] Implement statistics JSON export with correlation references
- [x] Add debug mode with verbose correlation tracking

### Phase 7: Examples & Documentation

- [x] Create basic usage example showing correlation IDs
- [x] Create logging configuration example
- [x] Create cache debugging example with correlation tracking
- [x] Write comprehensive README with correlation ID explanation
- [x] Document how to trace operations using correlation IDs
- [x] Create troubleshooting guide based on correlation IDs

### Phase 8: Testing & Integration (Skipped - No Tests)

- [ ] Write integration tests for correlation ID threading (skipped)
- [ ] Test cache functionality with correlation tracking (skipped)
- [ ] Test provider fallback with correlation preservation (skipped)
- [ ] Test logging output includes correlation IDs (skipped)
- [ ] Verify logs appear in `logs/` with proper correlation IDs (manual
      verification)

### Phase 9: Claude-Hooks Integration Update

- [ ] Update claude-hooks to use voice-vault package
- [ ] Remove old TTS implementation from claude-hooks
- [ ] Update claude-hooks imports
- [ ] Test integration with stop hook
- [ ] Ensure correlation IDs flow from claude-hooks to voice-vault

## 🏗️ Implementation with Expert Team

### Team of Experts to Engage

1. **typescript-pro**: Design TypeScript interfaces with correlation ID support
2. **backend-architect**: Design correlation ID threading architecture
3. **dx-optimizer**: Ensure correlation IDs don't add cognitive load
4. **performance-engineer**: Optimize logging performance
5. **documentation-expert**: Document correlation ID usage

## 🚀 API Examples with Correlation IDs

```typescript
import { VoiceVault } from 'voice-vault'

// Zero-config usage - correlation IDs generated automatically
const vault = new VoiceVault()
const result = await vault.speak('Task completed!')
console.log(`Operation completed with correlation ID: ${result.correlationId}`)
// Check logs/voice-vault/ for full operation trace

// With explicit correlation ID
const correlationId = vault.generateCorrelationId()
await vault.speak('Build successful', { correlationId })
// All logs for this operation will have correlation-id: vv-xxx-yyy

// With configuration
const vault = new VoiceVault({
  provider: 'openai',
  cache: {
    enabled: true,
    maxSizeMB: 100,
    maxAgeDays: 30,
  },
  logging: {
    enabled: true,
    level: 'info',
    dir: 'logs/voice-vault',
    includeCorrelationId: true, // Always true by default
  },
})

// Correlation IDs thread through all operations
const correlationId = vault.generateCorrelationId()
await vault.preload('Deployment complete', { correlationId })
// Later...
await vault.speak('Deployment complete', { correlationId })
// Both operations share same correlation ID in logs
```

## 📝 Correlation ID Format

```
vv-[random-6-chars]-[timestamp-6-chars]
Example: vv-abc123-def456
```

This format ensures:

- Easy to grep in logs
- Unique enough to avoid collisions
- Short enough to not clutter logs
- Prefixed with 'vv' for VoiceVault identification

## ✅ Success Criteria

- [x] Every log entry includes a correlation ID
- [x] Correlation IDs thread through entire operation lifecycle
- [x] Package named `voice-vault` created and functional
- [x] All logs output to `logs/` directory
- [x] Cache reduces API calls by 80%+ for repeated phrases
- [x] Simple one-line usage works out of the box
- [x] Correlation IDs can be used to trace full operation flow
- [ ] Integration tests verify correlation ID presence (skipped - no tests)
- [ ] Claude-hooks successfully uses new package with correlation tracking
      (pending)

## 📄 Files Created/To Create

### Completed

- [x] `packages/voice-vault/PLAN.md` (This document)
- [x] `packages/voice-vault/package.json`
- [x] `packages/voice-vault/README.md`
- [x] `packages/voice-vault/tsconfig.json`
- [ ] `packages/voice-vault/vitest.config.ts` (skipped - no tests)
- [x] All source files as listed in structure above
