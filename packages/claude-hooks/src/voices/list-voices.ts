#!/usr/bin/env tsx

/**
 * Voice Discovery & Management CLI
 * Lists available voices for all TTS providers
 */

import type { Voice } from '../speech/providers/tts-provider.js'

import { ElevenLabsProvider } from '../speech/providers/elevenlabs-provider.js'
import { MacOSProvider } from '../speech/providers/macos-provider.js'
import { OpenAIProvider } from '../speech/providers/openai-provider.js'
import { createLogger } from '../utils/logger.js'

interface VoiceListOptions {
  provider?: 'openai' | 'macos' | 'elevenlabs' | 'all'
  format?: 'table' | 'json'
  preview?: boolean
  apiKey?: string
}

const logger = createLogger('Voice Discovery', false)

// Gender name lists for macOS voice classification (hoisted for performance)
const MALE_VOICE_NAMES = ['Alex', 'Daniel', 'Diego', 'Fred', 'Jorge', 'Juan', 'Oliver', 'Tom']

const FEMALE_VOICE_NAMES = ['Allison', 'Ava', 'Kate', 'Samantha', 'Susan', 'Victoria', 'Zoe']

/**
 * Get voices from macOS system using `say -v ?`
 */
async function getMacOSVoices(): Promise<Voice[]> {
  try {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execFileAsync = promisify(execFile)

    const { stdout } = await execFileAsync('say', ['-v', '?'])

    const voices: Voice[] = []
    const lines = stdout.split('\n').filter((line) => line.trim())

    for (const line of lines) {
      // Parse lines like: "Alex              en_US    # Most people recognize me by my voice."
      const match = line.match(/^(\S+)\s+(\S+)\s+#\s*(.+)$/)
      if (match) {
        const [, name, locale, description] = match

        // Determine gender from common voice names (heuristic)
        let gender: 'male' | 'female' | 'neutral' = 'neutral'
        if (MALE_VOICE_NAMES.includes(name)) gender = 'male'
        else if (FEMALE_VOICE_NAMES.includes(name)) gender = 'female'

        voices.push({
          id: name,
          name,
          language: locale.replace('_', '-'), // Convert en_US to en-US
          gender,
          description: description.trim(),
        })
      }
    }

    return voices
  } catch (error) {
    logger.warning(`Failed to get macOS voices: ${String(error)}`)
    return []
  }
}

/**
 * Get voices from OpenAI (static list)
 */
async function getOpenAIVoices(): Promise<Voice[]> {
  try {
    const provider = new OpenAIProvider({})
    return await provider.getVoices()
  } catch (error) {
    logger.warning(`Failed to get OpenAI voices: ${String(error)}`)
    return []
  }
}

/**
 * Get voices from ElevenLabs API
 */
async function getElevenLabsVoices(apiKey?: string): Promise<Voice[]> {
  try {
    const effectiveApiKey = apiKey ?? process.env['ELEVENLABS_API_KEY']
    if (effectiveApiKey == null || effectiveApiKey === '') {
      logger.warning(
        'ElevenLabs API key not found. Use --api-key or set ELEVENLABS_API_KEY environment variable.',
      )
      return []
    }

    const provider = new ElevenLabsProvider({ apiKey: effectiveApiKey })
    return await provider.getVoices()
  } catch (error) {
    logger.warning(`Failed to get ElevenLabs voices: ${String(error)}`)
    return []
  }
}

/**
 * Format voices as table
 */
function formatAsTable(voicesByProvider: Record<string, Voice[]>): string {
  let output = ''

  for (const [providerName, voices] of Object.entries(voicesByProvider)) {
    if (voices.length === 0) continue

    output += `\n📢 ${providerName.toUpperCase()} VOICES\n`
    output += `${'─'.repeat(80)}\n`

    // Table headers
    const headers = ['ID', 'Name', 'Language', 'Gender', 'Description']
    const columnWidths = [20, 20, 12, 8, 35]

    // Header row
    output += `${headers.map((header, i) => header.padEnd(columnWidths[i])).join(' │ ')}\n`
    output += `${columnWidths.map((width) => '─'.repeat(width)).join('─┼─')}\n`

    // Voice rows
    for (const voice of voices) {
      const row = [
        voice.id.substring(0, columnWidths[0] - 1),
        voice.name.substring(0, columnWidths[1] - 1),
        voice.language.substring(0, columnWidths[2] - 1),
        (voice.gender ?? 'neutral').substring(0, columnWidths[3] - 1),
        (voice.description ?? '').substring(0, columnWidths[4] - 1),
      ]
      output += `${row.map((cell, i) => cell.padEnd(columnWidths[i])).join(' │ ')}\n`
    }
    output += '\n'
  }

  return output
}

/**
 * Format voices as JSON
 */
function formatAsJSON(voicesByProvider: Record<string, Voice[]>): string {
  return JSON.stringify(voicesByProvider, null, 2)
}

/**
 * Preview a voice by speaking sample text
 */
async function previewVoice(provider: string, voiceId: string, apiKey?: string): Promise<void> {
  const sampleText = 'Hello! This is a preview of my voice. How do I sound?'

  try {
    switch (provider) {
      case 'openai': {
        const openaiProvider = new OpenAIProvider({
          apiKey: apiKey ?? process.env['OPENAI_API_KEY'],
          voice: voiceId as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
        })
        const result = await openaiProvider.speak(sampleText)
        if (result.success !== true) {
          logger.error(`Preview failed: ${String(result.error)}`)
        }
        break
      }

      case 'macos': {
        const macosProvider = new MacOSProvider({ voice: voiceId })
        const result = await macosProvider.speak(sampleText)
        if (result.success !== true) {
          logger.error(`Preview failed: ${String(result.error)}`)
        }
        break
      }

      case 'elevenlabs': {
        const elevenLabsProvider = new ElevenLabsProvider({
          apiKey: apiKey ?? process.env['ELEVENLABS_API_KEY'],
          voiceId,
        })
        const result = await elevenLabsProvider.speak(sampleText)
        if (result.success !== true) {
          logger.error(`Preview failed: ${String(result.error)}`)
        }
        break
      }

      default:
        logger.error(`Unknown provider: ${provider}`)
    }
  } catch (error) {
    logger.error(`Preview error: ${String(error)}`)
  }
}

/**
 * Main function to list voices
 */
export async function main(): Promise<number> {
  const args = process.argv.slice(2)

  const options: VoiceListOptions = {
    provider: 'all',
    format: 'table',
    preview: false,
  }

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '--provider':
      case '-p':
        options.provider = args[++i] as VoiceListOptions['provider']
        break

      case '--format':
      case '-f':
        options.format = args[++i] as VoiceListOptions['format']
        break

      case '--preview':
        options.preview = true
        break

      case '--api-key':
        options.apiKey = args[++i]
        break

      case '--help':
      case '-h':
        logger.info(`
🎙️  Claude Hooks Voice Discovery

USAGE:
  claude-hooks-list-voices [OPTIONS]

OPTIONS:
  -p, --provider <provider>    Provider to list voices for (openai|macos|elevenlabs|all) [default: all]
  -f, --format <format>       Output format (table|json) [default: table]  
  --preview                   Enable voice preview capability
  --api-key <key>            API key for cloud providers (OpenAI/ElevenLabs)
  -h, --help                 Show this help message

EXAMPLES:
  claude-hooks-list-voices                           # List all voices in table format
  claude-hooks-list-voices -p openai                 # List only OpenAI voices
  claude-hooks-list-voices -f json                   # Output as JSON
  claude-hooks-list-voices --preview                 # Enable voice previews
  claude-hooks-list-voices --api-key sk-...         # Use specific API key

ENVIRONMENT VARIABLES:
  OPENAI_API_KEY           OpenAI API key
  ELEVENLABS_API_KEY       ElevenLabs API key
        `)
        return 0

      default:
        if (arg.startsWith('--preview:')) {
          const [, providerAndVoice] = arg.split(':')
          const [provider, voiceId] = providerAndVoice.split('/')
          await previewVoice(provider, voiceId, options.apiKey)
          return 0
        }
        logger.error(`Unknown option: ${arg}`)
        return 1
    }
  }

  logger.info('🔍 Discovering available TTS voices...')

  const voicesByProvider: Record<string, Voice[]> = {}

  // Collect voices from requested providers
  if (options.provider === 'all' || options.provider === 'macos') {
    if (process.platform === 'darwin') {
      logger.info('Getting macOS system voices...')
      voicesByProvider['macOS'] = await getMacOSVoices()
      logger.info(`Found ${voicesByProvider['macOS'].length} macOS voices`)
    } else {
      logger.info('macOS voices not available on this platform')
      voicesByProvider['macOS'] = []
    }
  }

  if (options.provider === 'all' || options.provider === 'openai') {
    logger.info('Getting OpenAI voices...')
    voicesByProvider['OpenAI'] = await getOpenAIVoices()
    logger.info(`Found ${voicesByProvider['OpenAI'].length} OpenAI voices`)
  }

  if (options.provider === 'all' || options.provider === 'elevenlabs') {
    logger.info('Getting ElevenLabs voices...')
    voicesByProvider['ElevenLabs'] = await getElevenLabsVoices(options.apiKey)
    logger.info(`Found ${voicesByProvider['ElevenLabs'].length} ElevenLabs voices`)
  }

  // Output results
  const output =
    options.format === 'json' ? formatAsJSON(voicesByProvider) : formatAsTable(voicesByProvider)

  process.stdout.write(`${output}\n`)

  // Show preview instructions if enabled
  if (options.preview === true) {
    logger.info('\n🎵 VOICE PREVIEW')
    logger.info('To preview a voice, use: --preview:provider/voice-id')
    logger.info('Examples:')
    logger.info('  claude-hooks-list-voices --preview:openai/alloy')
    logger.info('  claude-hooks-list-voices --preview:macos/Alex')
    logger.info('  claude-hooks-list-voices --preview:elevenlabs/pNInz6obpgDQGcFmaJgB')
  }

  const totalVoices = Object.values(voicesByProvider).reduce(
    (sum, voices) => sum + voices.length,
    0,
  )
  logger.success(`✅ Voice discovery complete! Found ${totalVoices} total voices.`)

  return 0
}
