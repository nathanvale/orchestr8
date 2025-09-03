# @template/claude-hooks

Claude Code hooks for task completion notifications, quality checks, and TTS
integration. Provides both TypeScript source for monorepo development and
compiled npm package for standalone installation.

## Overview

This package provides Claude Code hook implementations:

- **Stop Hook**: Plays completion sounds when Claude finishes tasks, with OpenAI
  and ElevenLabs TTS support
- **Notification Hook**: Plays attention sounds when Claude needs user input
- **Quality Check Hook**: Runs TypeScript, ESLint, and Prettier checks on code
  changes
- **Subagent Stop Hook**: Tracks and notifies when Claude subagents complete
  their work

## Features

- 🎯 **Type Safety**: Full TypeScript implementation with comprehensive types
- 🧩 **Modular Architecture**: Clean separation of concerns with reusable
  utilities
- 🔧 **Configurable**: Environment variables and JSON configuration support
- 🎵 **Cross-Platform Audio**: macOS, Windows, Linux support
- 🗣️ **OpenAI TTS Integration**: High-quality text-to-speech with voice options
- 🎙️ **ElevenLabs TTS Integration**: Premium voice synthesis with
  ultra-realistic voices
- 🍎 **macOS Speech**: Native macOS speech synthesis support
- 📄 **Event Logging**: JSON-based logging with rotation and transcript
  processing
- ⏰ **Smart Scheduling**: Quiet hours and cooldown periods for notifications
- 🚀 **Fast**: Optimized execution with intelligent caching
- 📦 **NPM Ready**: Install as standalone package or use in monorepo

## Installation

### Option 1: NPM Package (Recommended)

Install globally for easy access:

```bash
npm install -g @template/claude-hooks
```

Or install locally in your project:

```bash
npm install @template/claude-hooks
```

Then configure Claude Code settings with bin commands:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "claude-hooks-stop"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "claude-hooks-notification"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "claude-hooks-quality"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "claude-hooks-subagent"
          }
        ]
      }
    ]
  }
}
```

### Option 2: Monorepo Development

If you're working within the mnemosyne monorepo:

1. **Install dependencies** (from repository root):

```bash
pnpm install
```

2. **Configure Claude Code settings** in `.claude/settings.local.json`:

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "npx tsx packages/claude-hooks/src/notification/index.ts"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "npx tsx packages/claude-hooks/src/stop/index.ts"
          }
        ]
      }
    ],
    "QualityCheck": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "npx tsx packages/claude-hooks/src/quality-check/index.ts"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "npx tsx packages/claude-hooks/src/subagent-stop/index.ts"
          }
        ]
      }
    ]
  }
}
```

3. **Add configuration files** in `.claude/hooks/` directory:

```bash
# Create notification config
cat > .claude/hooks/notification.config.json << 'EOF'
{
  "settings": {
    "notifySound": true,
    "speak": false,
    "debug": false,
    "cooldownPeriod": 3000,
    "allowUrgentOverride": false,
    "quietHours": {
      "enabled": false,
      "ranges": [
        { "start": "22:00", "end": "08:00", "name": "Night" }
      ],
      "allowUrgentOverride": true
    }
  }
}
EOF

# Create stop config
cat > .claude/hooks/stop.config.json << 'EOF'
{
  "settings": {
    "chat": false,
    "speak": true,
    "debug": false
  }
}
EOF

# Create quality-check config
cat > .claude/hooks/quality-check.config.json << 'EOF'
{
  "typescript": {
    "enabled": true,
    "showDependencyErrors": false
  },
  "eslint": {
    "enabled": true,
    "autofix": true
  },
  "prettier": {
    "enabled": true,
    "autofix": true
  },
  "general": {
    "autofixSilent": true,
    "debug": false
  }
}
EOF

# Create subagent-stop config
cat > .claude/hooks/subagent-stop.config.json << 'EOF'
{
  "settings": {
    "notifySound": true,
    "speak": false,
    "debug": false
  }
}
EOF
```

4. **Test the hooks** - Trigger Claude Code events to verify they work

## Bin Commands

When installed as an npm package, the following commands are available:

| Command                     | Description                                        | Hook Type    |
| --------------------------- | -------------------------------------------------- | ------------ |
| `claude-hooks-stop`         | Task completion notifications with TTS support     | Stop         |
| `claude-hooks-notification` | User attention notifications                       | Notification |
| `claude-hooks-quality`      | Code quality checks (TypeScript, ESLint, Prettier) | PostToolUse  |
| `claude-hooks-subagent`     | Subagent completion tracking                       | SubagentStop |

### Command Examples

```bash
# Test the stop hook manually
echo '{"result": "success"}' | claude-hooks-stop

# Test the notification hook
echo '{"message": "Test notification"}' | claude-hooks-notification

# Test the quality check hook
echo '{"tool_name": "Edit", "tool_input": {"file_path": "/path/to/file.ts"}}' | claude-hooks-quality

# Test the subagent hook
echo '{"data": {"subagentType": "general-purpose"}}' | claude-hooks-subagent
```

### Global vs Local Installation

**Global installation** (recommended for most users):

- Commands available from anywhere: `claude-hooks-stop`
- Simpler Claude Code configuration
- Works across all projects

**Local installation** (for project-specific needs):

- Commands available via npx: `npx claude-hooks-stop`
- Version locked to your project
- Use `./node_modules/.bin/claude-hooks-stop` in Claude Code settings

## Usage

Each hook requires:

1. A command entry in `.claude/settings.local.json`
2. A JSON configuration file in `.claude/hooks/{hookName}.config.json`

The hooks automatically load their configuration from the `.claude/hooks/`
directory.

### Hook Configuration Files

| Hook Type     | Config File                               | Purpose                        |
| ------------- | ----------------------------------------- | ------------------------------ |
| Notification  | `.claude/hooks/notification.config.json`  | Alerts when Claude needs input |
| Stop          | `.claude/hooks/stop.config.json`          | Notifies when tasks complete   |
| Subagent Stop | `.claude/hooks/subagent-stop.config.json` | Tracks subagent completion     |
| Quality Check | `.claude/hooks/quality-check.config.json` | Runs code quality checks       |

### Notification Hook

Plays attention sounds when Claude needs user input.

**Configuration:** `.claude/hooks/notification.config.json`:

```json
{
  "settings": {
    "notifySound": true,
    "speak": false,
    "debug": false,
    "cooldownPeriod": 3000,
    "allowUrgentOverride": false,
    "quietHours": {
      "enabled": false,
      "ranges": [{ "start": "22:00", "end": "08:00", "name": "Night" }],
      "allowUrgentOverride": true
    }
  }
}
```

**Properties:**

- `notifySound` - Enable sound notifications
- `speak` - Enable speech synthesis (macOS only)
- `debug` - Enable debug logging
- `cooldownPeriod` - Cooldown between notifications (ms)
- `allowUrgentOverride` - Allow urgent notifications during cooldown
- `quietHours` - Time-based notification filtering

**Features:**

- Cross-platform audio support
- macOS speech synthesis
- Quiet hours support
- Cooldown periods
- Priority-based sound selection

### Stop Hook

Plays completion sounds when Claude finishes tasks.

**Configuration:** `.claude/hooks/stop.config.json`:

```json
{
  "settings": {
    "chat": false,
    "speak": true,
    "debug": false
  }
}
```

**Properties:**

- `chat` - Enable chat transcript processing
- `speak` - Enable speech synthesis (macOS only)
- `debug` - Enable debug logging

**Features:**

- Task completion sounds (success/error)
- OpenAI TTS with voice selection
- ElevenLabs TTS with premium voices
- macOS speech synthesis fallback
- Chat transcript logging
- Platform-specific sound selection

### Subagent Stop Hook

Tracks when Claude's Task tool subagents complete their work.

**Configuration:** `.claude/hooks/subagent-stop.config.json`:

```json
{
  "settings": {
    "notifySound": true,
    "speak": false,
    "debug": false
  }
}
```

**Properties:**

- `notifySound` - Enable notification sounds
- `speak` - Enable speech synthesis (macOS only)
- `debug` - Enable debug logging

**Features:**

- Subagent completion tracking
- Agent type formatting
- Speech announcements
- Cross-platform notifications

### Quality Check Hook

Runs comprehensive code quality checks on file changes.

**Configuration:** `.claude/hooks/quality-check.config.json`:

```json
{
  "typescript": {
    "enabled": true,
    "showDependencyErrors": false
  },
  "eslint": {
    "enabled": true,
    "autofix": true
  },
  "prettier": {
    "enabled": true,
    "autofix": true
  },
  "general": {
    "autofixSilent": true,
    "debug": false
  }
}
```

**Properties:**

- `typescript.enabled` - Enable TypeScript type checking
- `typescript.showDependencyErrors` - Show project dependency errors
- `eslint.enabled` - Enable ESLint linting
- `eslint.autofix` - Auto-fix ESLint issues
- `prettier.enabled` - Enable Prettier formatting
- `prettier.autofix` - Auto-fix Prettier issues
- `general.autofixSilent` - Don't block when auto-fixing succeeds
- `general.debug` - Enable debug logging

**Features:**

- TypeScript type checking
- ESLint with auto-fix
- Prettier formatting
- Common issue detection ("as any", console statements)
- Silent auto-fixing

## Development

```bash
# Install dependencies
pnpm install

# Build TypeScript and bundle hooks
pnpm run build

# Run type checking
pnpm run type-check

# Run linting
pnpm run lint

# Check formatting
pnpm run format:check

# Run tests
pnpm run test
```

## Configuration System

### Automatic Environment Variable Loading

Claude Hooks automatically loads environment variables from `.env` files in your
monorepo root, similar to how Next.js handles environment variables. This means
you no longer need to manually export environment variables before running CLI
commands.

**Key Features:**

- 🔄 **Automatic Loading**: No need to export variables manually
- 📁 **Monorepo Aware**: Works from any directory in your monorepo
- 🧪 **Test Safety**: Tests automatically use `.env.example` values
- 🔐 **Secure**: Real API keys stay in `.env` (git-ignored)

**Setup:**

1. Copy `.env.example` to `.env` and add your real API keys
2. Run any command - environment variables are loaded automatically
3. Tests will use safe values from `.env.example`

See [Environment Loading Documentation](./docs/ENV_LOADING.md) for detailed
information.

### How Configuration Works

1. **Auto-Config Loading** - Hooks automatically load
   `.claude/hooks/{hookName}.config.json`
2. **Environment Variable Substitution** - Use `${VAR_NAME}` syntax in JSON
   config files
3. **Environment Variables** - Override any JSON setting using `CLAUDE_HOOKS_*`
   variables
4. **CLI Arguments** - Override both JSON and environment settings
5. **Defaults** - Built-in fallbacks if nothing else is specified

### Configuration Priority

```
Defaults < JSON File < Environment Variables < CLI Arguments
```

### Environment Variable Substitution

You can use `${VAR_NAME}` syntax in JSON config files to reference environment
variables:

```json
{
  "settings": {
    "speak": true,
    "tts": {
      "provider": "auto",
      "fallbackProvider": "macos",
      "openai": {
        "apiKey": "${OPENAI_API_KEY}",
        "model": "tts-1",
        "voice": "nova",
        "speed": 0.9,
        "format": "mp3"
      },
      "macos": {
        "voice": "Alex",
        "rate": 200,
        "volume": 0.7,
        "enabled": true
      }
    }
  }
}
```

**Features:**

- Substitutes `${OPENAI_API_KEY}` with the actual environment variable value
- Keeps the placeholder if environment variable is not found (with warning)
- Works with any environment variable in any JSON field
- Processed before configuration validation

### Example Configuration Loading

The hooks use automatic configuration discovery:

1. Find project root (where `.claude/` directory exists)
2. Load `.claude/hooks/{hookName}.config.json`
3. **Process environment variable substitution** (`${VAR_NAME}` → actual values)
4. Extract `settings` object from JSON
5. Apply environment variable overrides
6. Apply CLI argument overrides

## Architecture

The package is structured as follows:

```
src/
├── audio/              # Cross-platform audio system
│   ├── audio-player.ts # Audio playback implementation
│   └── platform.ts     # Platform detection utilities
├── config/             # Configuration management
│   ├── config-schema.ts # Zod schemas for validation
│   └── env-config.ts   # Environment variable handling
├── logging/            # Event logging system
│   ├── event-logger.ts # JSON logging with rotation
│   └── transcript-parser.ts # Chat transcript processing
├── notification/       # Attention notification hook
│   └── notification.ts # User input notification logic
├── speech/             # Speech synthesis system
│   ├── speech-engine.ts # macOS say command integration
│   ├── quiet-hours.ts  # Time-based filtering
│   └── cooldown.ts     # Rate limiting
├── stop/               # Task completion hook
│   └── stop.ts         # Task completion logic
├── subagent-stop/      # Subagent completion hook
│   └── subagent-stop.ts # Subagent tracking logic
├── quality-check/      # Code quality hook
│   ├── checkers/       # TypeScript, ESLint, Prettier checkers
│   └── config.ts       # Configuration management
├── types/              # Shared TypeScript types
│   ├── claude.ts       # Claude Code event types
│   └── config.ts       # Configuration types
├── utils/              # Shared utilities
│   └── auto-config.ts  # Automatic config loading
├── base-hook.ts        # Base hook architecture
└── index.ts            # Package exports
```

## Environment Variables

Environment variables can override any JSON configuration setting. Use the
format `CLAUDE_HOOKS_{SETTING_NAME}` where `{SETTING_NAME}` is the uppercase
version of the JSON property.

### Global Settings

- `CLAUDE_HOOKS_DEBUG` - Enable debug logging for all hooks

### Notification Hook

- `CLAUDE_HOOKS_NOTIFY_SOUND` - Enable sound notifications
- `CLAUDE_HOOKS_NOTIFICATION_SPEAK` - Enable speech notifications (macOS only)
- `CLAUDE_HOOKS_NOTIFICATION_COOLDOWN_PERIOD` - Cooldown between notifications
  (ms)
- `CLAUDE_HOOKS_NOTIFICATION_ALLOW_URGENT_OVERRIDE` - Allow urgent notifications
  during cooldown

### Stop Hook

- `CLAUDE_HOOKS_STOP_CHAT` - Enable chat transcript processing
- `CLAUDE_HOOKS_STOP_SPEAK` - Enable completion speech (macOS only)

### Subagent Stop Hook

- `CLAUDE_HOOKS_SUBAGENT_STOP_NOTIFY` - Enable subagent completion sounds
- `CLAUDE_HOOKS_SUBAGENT_STOP_SPEAK` - Enable speech notifications (macOS only)

### Quality Check Hook

- `CLAUDE_HOOKS_TYPESCRIPT_ENABLED` - Enable TypeScript checking
- `CLAUDE_HOOKS_SHOW_DEPENDENCY_ERRORS` - Show project dependency errors
- `CLAUDE_HOOKS_ESLINT_ENABLED` - Enable ESLint checking
- `CLAUDE_HOOKS_ESLINT_AUTOFIX` - Enable ESLint auto-fixing
- `CLAUDE_HOOKS_PRETTIER_ENABLED` - Enable Prettier checking
- `CLAUDE_HOOKS_PRETTIER_AUTOFIX` - Enable Prettier auto-fixing
- `CLAUDE_HOOKS_AUTOFIX_SILENT` - Don't block when auto-fixing succeeds

### OpenAI TTS Configuration

For OpenAI text-to-speech integration, set the following environment variables:

- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `CLAUDE_HOOKS_TTS_PROVIDER` - Set to "openai" to enable OpenAI TTS
- `CLAUDE_HOOKS_OPENAI_VOICE` - Voice selection:
  - `alloy` (default) - Balanced, neutral voice
  - `echo` - Clear, professional voice
  - `fable` - Warm, storytelling voice
  - `onyx` - Deep, authoritative voice
  - `nova` - Bright, energetic voice
  - `shimmer` - Soft, friendly voice
- `CLAUDE_HOOKS_OPENAI_MODEL` - Model: "tts-1" (default, faster) or "tts-1-hd"
  (higher quality)
- `CLAUDE_HOOKS_OPENAI_SPEED` - Speech speed from 0.25 to 4.0 (default: 1.0)
- `CLAUDE_HOOKS_OPENAI_FORMAT` - Audio format: "mp3" (default), "opus", "aac",
  or "flac"

Example OpenAI TTS configuration:

```bash
export OPENAI_API_KEY="your-api-key-here"
export CLAUDE_HOOKS_TTS_PROVIDER="openai"
export CLAUDE_HOOKS_OPENAI_VOICE="nova"
export CLAUDE_HOOKS_OPENAI_MODEL="tts-1-hd"
export CLAUDE_HOOKS_OPENAI_SPEED="0.9"
export CLAUDE_HOOKS_OPENAI_FORMAT="mp3"
```

Or add to your `.claude/hooks/stop.config.json`:

```json
{
  "settings": {
    "speak": true,
    "tts": {
      "provider": "openai",
      "openai": {
        "apiKey": "${OPENAI_API_KEY}",
        "voice": "nova",
        "model": "tts-1-hd",
        "speed": 0.9
      }
    }
  }
}
```

**Note:** The `apiKey` field uses environment variable substitution
(`${OPENAI_API_KEY}`) to securely reference your API key without hardcoding it
in the config file.

**Voice Selection:** See `examples/stop-openai-voices.json` for a comprehensive
example with all available voices, descriptions, and recommended use cases for
different scenarios.

### ElevenLabs TTS Configuration

For high-quality ElevenLabs text-to-speech with advanced voice synthesis, set
the following environment variables:

- `ELEVENLABS_API_KEY` - Your ElevenLabs API key (required)
- `CLAUDE_HOOKS_TTS_PROVIDER` - Set to "elevenlabs" to enable ElevenLabs TTS
- `CLAUDE_HOOKS_ELEVENLABS_VOICE_ID` - Voice ID to use (get from ElevenLabs
  Voice Lab)
- `CLAUDE_HOOKS_ELEVENLABS_MODEL_ID` - Model selection:
  - `eleven_multilingual_v2` (default) - Supports multiple languages with high
    quality
  - `eleven_flash_v2_5` - Faster generation, lower latency
  - `eleven_monolingual_v1` - English-only, optimized for English
- `CLAUDE_HOOKS_ELEVENLABS_OUTPUT_FORMAT` - Audio format (default:
  "mp3_44100_128")
- `CLAUDE_HOOKS_ELEVENLABS_STABILITY` - Voice stability 0-1 (default: 0.5)
- `CLAUDE_HOOKS_ELEVENLABS_SIMILARITY_BOOST` - Voice similarity 0-1 (default:
  0.75)
- `CLAUDE_HOOKS_ELEVENLABS_SPEED` - Speech speed 0.5-2.0 (default: 1.0)
- `CLAUDE_HOOKS_ELEVENLABS_ENABLE_LOGGING` - Enable API logging (default: true)

Example ElevenLabs configuration with environment variables:

```bash
export ELEVENLABS_API_KEY="your-api-key-here"
export CLAUDE_HOOKS_TTS_PROVIDER="elevenlabs"
export CLAUDE_HOOKS_ELEVENLABS_VOICE_ID="21m00Tcm4TlvDq8ikWAM"
export CLAUDE_HOOKS_ELEVENLABS_MODEL_ID="eleven_multilingual_v2"
export CLAUDE_HOOKS_ELEVENLABS_SPEED="1.0"
```

Or add to your `.claude/hooks/stop.config.json`:

```json
{
  "settings": {
    "speak": true,
    "tts": {
      "provider": "elevenlabs",
      "elevenlabs": {
        "apiKey": "${ELEVENLABS_API_KEY}",
        "voiceId": "21m00Tcm4TlvDq8ikWAM",
        "modelId": "eleven_multilingual_v2",
        "outputFormat": "mp3_44100_128",
        "stability": 0.5,
        "similarityBoost": 0.75,
        "speed": 1.0,
        "enableLogging": true
      },
      "fallbackProvider": "macos"
    }
  }
}
```

**ElevenLabs Configuration Parameters:**

- `voiceId` (required) - The ID of the voice to use. Get available voices from
  your ElevenLabs account
- `modelId` - Language model to use:
  - `eleven_multilingual_v2` (default) - Supports multiple languages with high
    quality
  - `eleven_flash_v2_5` - Faster generation, lower latency
  - `eleven_monolingual_v1` - English-only, optimized for English
- `outputFormat` - Audio output format:
  - `mp3_44100_128` (default) - Standard MP3 format
  - `mp3_44100_192` - Higher quality MP3
  - `mp3_22050_32` - Lower quality, smaller file size
  - `pcm_16000` - Raw PCM for processing
  - `opus_48000_128` - Opus codec for streaming
- `stability` (0-1) - Voice stability, default 0.5. Lower = more variation,
  higher = more consistent
- `similarityBoost` (0-1) - Voice similarity enhancement, default 0.75
- `speed` (0.5-2.0) - Speech speed multiplier, default 1.0
- `enableLogging` - Enable/disable request logging (default: true)

**Popular ElevenLabs Voice IDs:**

- `21m00Tcm4TlvDq8ikWAM` - Rachel (American, female)
- `AZnzlk1XvdvUeBnXmlld` - Domi (American, female)
- `EXAVITQu4vr4xnSDxMaL` - Bella (American, female, young)
- `ErXwobaYiN019PkySvjV` - Antoni (American, male)
- `VR6AewLTigWG4xSOukaG` - Arnold (American, male)
- `pNInz6obpgDQGcFmaJgB` - Adam (American, male, deep)
- `yoZ06aMxZJJ28mfd3POQ` - Sam (American, male, young)
- `onwK4e9ZLuTAKqWW03F9` - Daniel (British, male)

**Note:** Get your full list of available voices (including custom cloned
voices) by visiting your [ElevenLabs Voice Lab](https://elevenlabs.io/voice-lab)
or using the API.

**Complete Example:** See `examples/stop-elevenlabs.json` for a full
configuration example with all parameters and fallback settings.

## CLI Arguments

The hooks support command-line flags that override both JSON and environment
configuration:

### Common Arguments

- `--debug` - Enable debug logging

### Notification Hook

- `--notify` - Enable notification sounds
- `--speak` - Enable speech synthesis (macOS only)

### Stop Hook

- `--chat` - Enable chat transcript processing
- `--speak` - Enable speech synthesis (macOS only)

### Subagent Stop Hook

- `--notify` - Enable notification sounds
- `--speak` - Enable speech synthesis (macOS only)

## Audio Cache

The hooks include an intelligent audio caching system that improves performance
and reduces API costs by caching generated TTS audio files.

### Overview

The audio cache stores generated TTS audio locally to avoid redundant API calls
when the same text is spoken multiple times. This is particularly useful for:

- Repeated notifications and alerts
- Common completion messages
- Frequently used voice prompts
- Testing and development

### Configuration

The cache can be configured using environment variables:

- `CLAUDE_HOOKS_AUDIO_CACHE_ENABLED` - Enable/disable caching (default: true)
- `CLAUDE_HOOKS_AUDIO_CACHE_MAX_SIZE_MB` - Maximum cache size in MB
  (default: 100)
- `CLAUDE_HOOKS_AUDIO_CACHE_MAX_AGE_DAYS` - Maximum age of cached entries in
  days (default: 30)
- `CLAUDE_HOOKS_AUDIO_CACHE_MAX_ENTRIES` - Maximum number of cached entries
  (default: 1000)

Example configuration:

```bash
export CLAUDE_HOOKS_AUDIO_CACHE_ENABLED=true
export CLAUDE_HOOKS_AUDIO_CACHE_MAX_SIZE_MB=200
export CLAUDE_HOOKS_AUDIO_CACHE_MAX_AGE_DAYS=60
export CLAUDE_HOOKS_AUDIO_CACHE_MAX_ENTRIES=2000
```

### Cache Location

By default, cached audio files are stored in:

- **macOS/Linux**: `$TMPDIR/claude-hooks-audio-cache`
- **Windows**: `%TEMP%\claude-hooks-audio-cache`

### Cache Management CLI Tools

The package includes CLI tools for managing the audio cache:

#### View Cache Statistics

```bash
claude-hooks-cache-stats
```

Shows:

- Total cache size
- Number of entries
- Hit rate
- Oldest and newest entries

#### Explore and Manage Cache

```bash
claude-hooks-cache-explorer
```

Interactive tool to:

- Browse cached entries
- Play cached audio files
- Delete specific entries
- Clear entire cache

For JSON output (useful for scripting):

```bash
claude-hooks-cache-stats --json
```

### Cache Behavior

- **Key Generation**: Cache keys are generated from the text content, provider,
  voice, and other settings
- **Text Normalization**: Text is normalized (case-insensitive, whitespace
  normalized) to improve cache hits
- **Expiration**: Entries older than the configured max age are automatically
  removed
- **Size Limits**: When cache exceeds size limits, oldest entries are evicted
  (LRU)
- **Hit Rate**: Cache tracks hit rate to help monitor effectiveness

### Disabling Cache

To disable caching temporarily:

```bash
export CLAUDE_HOOKS_AUDIO_CACHE_ENABLED=false
```

Or permanently in your config:

```json
{
  "audioCache": {
    "enabled": false
  }
}
```

## Troubleshooting

### ElevenLabs TTS Issues

**"Invalid API key" error:**

- Verify your API key is correct and active
- Check your ElevenLabs account status and quota
- Ensure the environment variable `ELEVENLABS_API_KEY` is set correctly

**"voiceId is required" error:**

- You must specify a `voiceId` in your configuration
- Get valid voice IDs from your ElevenLabs Voice Lab
- Use one of the popular voice IDs listed in the documentation

**"Rate limit exceeded" error:**

- ElevenLabs has rate limits based on your subscription tier
- The provider implements automatic retry with exponential backoff
- Consider upgrading your ElevenLabs plan for higher limits

**Audio not playing:**

- Check system audio permissions
- Verify audio output device is working
- Test with a simpler provider (e.g., macOS) to isolate the issue
- Check the generated audio files in the temp directory

**Slow response times:**

- Use `eleven_flash_v2_5` model for lower latency
- Consider using a lower quality output format for faster generation
- Enable caching to avoid regenerating the same text

### OpenAI TTS Issues

**"Invalid API key" error:**

- Verify your OpenAI API key has TTS permissions
- Check your OpenAI account credits and limits

**Audio playback issues on Windows:**

- Ensure PowerShell execution policy allows scripts
- Try running with administrator privileges
- Check Windows audio service is running

### General Troubleshooting

**Hook not triggering:**

- Verify the hook is configured in `.claude/settings.local.json`
- Check the config file exists in `.claude/hooks/`
- Enable debug mode with `--debug` flag to see detailed logs
- Ensure the command is executable and in PATH

**Permission denied errors:**

- Check file permissions in `.claude/hooks/` directory
- Ensure the hook scripts have execute permissions
- On macOS/Linux: `chmod +x` the command if needed

**Configuration not loading:**

- Verify JSON syntax in config files
- Check for typos in configuration keys
- Use debug mode to see which config is being loaded

## Testing

Tests are written using Vitest and can be run with:

```bash
pnpm test
```

Tests cover:

- Cross-platform audio functionality
- Event parsing and processing
- Configuration validation
- Speech synthesis (macOS)
- Logging and transcript processing
- Error handling and edge cases

## Build Process

The build process:

1. Compiles TypeScript to JavaScript with source maps
2. Generates TypeScript declaration files for type safety
3. Adds proper shebangs to bin files and makes them executable
4. Creates distributable package in `dist/` directory

## License

MIT - See LICENSE file for details

## Contributing

This package is part of the mnemosyne monorepo. Contributions welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes and add tests
4. Run tests: `pnpm test`
5. Run quality checks: `pnpm check`
6. Submit a pull request

## Support

- **Issues**: Report bugs and feature requests on
  [GitHub Issues](https://github.com/nathanvale/mnemosyne/issues)
- **Documentation**: Full documentation available in the
  [mnemosyne docs](https://nathanvale.github.io/mnemosyne/)
- **Discord**: Join the community for discussion and support
