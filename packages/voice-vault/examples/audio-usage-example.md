# Voice Vault Audio System Usage Examples

The Voice Vault audio system provides simple, ADHD-friendly cross-platform audio
playback with comprehensive logging and correlation ID tracking.

## Simple Usage (Console Logging)

```typescript
import { createAudioPlayerWithConsoleLogger } from '@template/voice-vault/audio'

const player = createAudioPlayerWithConsoleLogger()

// Play an audio file
const result = await player.playAudio('/path/to/speech.mp3')

if (result.success) {
  console.log(`✅ Played successfully in ${result.durationMs}ms`)
} else {
  console.log(`❌ Failed to play: ${result.error}`)
}
```

## Advanced Usage (With Logger)

```typescript
import {
  createAudioPlayer,
  createVoiceVaultLoggerSync,
} from '@template/voice-vault'

const logger = createVoiceVaultLoggerSync({ level: 'debug' })
const player = createAudioPlayer(logger)

// Play with configuration
const result = await player.playAudio('/path/to/speech.mp3', {
  volume: 0.8,
  correlationId: 'tts-request-123',
})

console.log('Correlation ID:', result.correlationId)
```

## Platform Detection

```typescript
import { getCurrentPlatformInfo } from '@template/voice-vault/audio'

const platformInfo = getCurrentPlatformInfo()
console.log('Platform:', platformInfo.capabilities.displayName)
console.log('Supported:', platformInfo.supported)
console.log('Audio Players:', platformInfo.capabilities.audioPlayers)
```

## Cross-Platform Support

### macOS

- Uses `afplay` command
- Supports system sounds in `/System/Library/Sounds/`
- Volume control supported

### Windows

- Uses PowerShell with `System.Media.SoundPlayer`
- Supports system sounds in `C:\Windows\Media\`
- Fallback to Media.Audio if needed

### Linux

- Tries multiple players: `aplay`, `paplay`, `play`, `mpg123`, `sox`
- Falls back gracefully through available players
- No standard system sounds

## Features

- ✅ **Zero Configuration**: Works out of the box
- ✅ **Cross-Platform**: macOS, Windows, Linux support
- ✅ **Comprehensive Logging**: Full operation tracing
- ✅ **Correlation IDs**: Track audio operations across systems
- ✅ **ADHD-Friendly**: Simple API, clear feedback
- ✅ **Error Handling**: Graceful degradation with detailed errors
- ✅ **Platform Detection**: Automatic capability detection

## Error Handling

The audio player provides detailed error information:

```typescript
const result = await player.playAudio('/invalid/path.mp3')

if (!result.success) {
  console.log('Error:', result.error)
  console.log('Correlation ID:', result.correlationId)
  console.log('Duration before failure:', result.endedAt - result.startedAt)
}
```

## Performance Tracking

Every playback operation is logged with:

- Duration in milliseconds
- File size and path
- Audio device used
- Platform-specific command executed
- Success/failure status
- Correlation ID for tracing
