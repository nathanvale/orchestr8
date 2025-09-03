#!/usr/bin/env node

/**
 * TTS Cache Explorer CLI
 * Browse, search, and manage TTS audio cache entries
 */

// Load environment variables before any other imports
import { existsSync } from 'node:fs'
import { readdir, readFile, rm, stat, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import '../utils/env-loader.js'

import { AudioCache } from '../speech/providers/audio-cache.js'

interface CacheEntryDetails {
  key: string
  text: string
  normalizedText: string
  voice: string
  model?: string
  speed?: number
  size: number
  age: number
  timestamp: number
}

/**
 * Format bytes as human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

/**
 * Format timestamp as relative time
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  if (seconds > 0) return `${seconds}s ago`
  return 'just now'
}

/**
 * Parse age filter (e.g., "7d", "24h", "30m")
 */
function parseAgeFilter(ageStr: string): number {
  const match = ageStr.match(/^(\d+)([dhms])$/)
  if (!match) {
    throw new Error('Invalid age format. Use format like: 7d, 24h, 30m, 60s')
  }

  const value = parseInt(match[1], 10)
  const unit = match[2]

  switch (unit) {
    case 'd':
      return value * 24 * 60 * 60 * 1000
    case 'h':
      return value * 60 * 60 * 1000
    case 'm':
      return value * 60 * 1000
    case 's':
      return value * 1000
    default:
      throw new Error('Invalid time unit')
  }
}

/**
 * Get all cache entries with details
 */
async function getCacheEntries(cache: AudioCache): Promise<CacheEntryDetails[]> {
  const config = cache.getConfiguration()
  const cacheDir = config.cacheDir ?? join(tmpdir(), 'claude-hooks-audio-cache')
  const entriesDir = join(cacheDir, 'entries')
  const audioDir = join(cacheDir, 'audio')

  if (!existsSync(entriesDir)) {
    return []
  }

  const entries: CacheEntryDetails[] = []
  const entryFiles = await readdir(entriesDir)

  for (const entryFile of entryFiles) {
    if (!entryFile.endsWith('.json')) continue

    try {
      const key = entryFile.replace('.json', '')
      const entryPath = join(entriesDir, entryFile)
      const audioPath = join(audioDir, `${key}.mp3`)

      // Read entry metadata
      const entryData = await readFile(entryPath, 'utf8')
      const entry = JSON.parse(entryData)

      // Get file stats
      const [entryStat, audioStat] = await Promise.all([stat(entryPath), stat(audioPath)])

      // Reverse engineer the original text from cache key
      // This is approximate since we can't recover the exact original
      const text = entry.metadata?.text ?? 'Unknown text'
      const normalizedText = cache['normalizeText'](text) // Access private method

      entries.push({
        key,
        text,
        normalizedText,
        voice: entry.metadata?.voice ?? 'unknown',
        model: entry.metadata?.model,
        speed: entry.metadata?.speed,
        size: entryStat.size + audioStat.size,
        age: Date.now() - entryStat.mtime.getTime(),
        timestamp: entryStat.mtime.getTime(),
      })
    } catch {
      // Skip corrupted entries
    }
  }

  // Sort by timestamp (newest first)
  entries.sort((a, b) => b.timestamp - a.timestamp)

  return entries
}

/**
 * Clear entire cache
 */
async function clearCache(cache: AudioCache): Promise<void> {
  const config = cache.getConfiguration()
  const cacheDir = config.cacheDir ?? join(tmpdir(), 'claude-hooks-audio-cache')

  if (existsSync(cacheDir)) {
    await rm(cacheDir, { recursive: true, force: true })
    console.log('✅ Cache cleared successfully')
  } else {
    console.log('ℹ️ Cache directory does not exist')
  }
}

/**
 * Remove old entries
 */
async function cleanupOldEntries(cache: AudioCache, olderThan: number): Promise<void> {
  const config = cache.getConfiguration()
  const cacheDir = config.cacheDir ?? join(tmpdir(), 'claude-hooks-audio-cache')
  const entriesDir = join(cacheDir, 'entries')
  const audioDir = join(cacheDir, 'audio')

  if (!existsSync(entriesDir)) {
    console.log('ℹ️ No cache entries to clean up')
    return
  }

  const now = Date.now()
  let removedCount = 0
  const entryFiles = await readdir(entriesDir)

  for (const entryFile of entryFiles) {
    if (!entryFile.endsWith('.json')) continue

    try {
      const key = entryFile.replace('.json', '')
      const entryPath = join(entriesDir, entryFile)
      const audioPath = join(audioDir, `${key}.mp3`)

      const entryStat = await stat(entryPath)
      const age = now - entryStat.mtime.getTime()

      if (age > olderThan) {
        await Promise.all([unlink(entryPath).catch(() => {}), unlink(audioPath).catch(() => {})])
        removedCount++
      }
    } catch {
      // Skip errors
    }
  }

  console.log(
    `✅ Removed ${removedCount} entries older than ${formatRelativeTime(now - olderThan)}`,
  )
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const cache = new AudioCache()

  // Parse command line arguments
  const flags = {
    clear: args.includes('--clear'),
    cleanup: args.includes('--cleanup'),
    verbose: args.includes('--verbose'),
    json: args.includes('--json'),
    voice: args.find((a) => a.startsWith('--voice='))?.split('=')[1],
    olderThan: args.find((a) => a.startsWith('--older-than='))?.split('=')[1],
  }

  // Handle clear command
  if (flags.clear) {
    await clearCache(cache)
    return
  }

  // Handle cleanup command
  if (flags.cleanup) {
    const maxAge = cache.getConfiguration().maxAgeMs ?? 7 * 24 * 60 * 60 * 1000
    await cache.cleanup() // Use built-in cleanup
    console.log(
      `✅ Cleaned up entries older than ${Math.floor(maxAge / (24 * 60 * 60 * 1000))} days`,
    )
    return
  }

  // Handle cleanup with custom age
  if (flags.olderThan != null && flags.olderThan !== '') {
    try {
      const age = parseAgeFilter(flags.olderThan)
      await cleanupOldEntries(cache, age)
      return
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`)
      process.exit(1)
    }
  }

  // Get and display cache entries
  const entries = await getCacheEntries(cache)

  // Apply filters
  let filteredEntries = entries
  if (flags.voice != null && flags.voice !== '') {
    filteredEntries = filteredEntries.filter((e) => e.voice === flags.voice)
  }

  // Output as JSON if requested
  if (flags.json) {
    console.log(JSON.stringify(filteredEntries, null, 2))
    return
  }

  // Pretty console output
  console.log('\n🔍 TTS Cache Explorer')
  console.log('━'.repeat(40))

  if (filteredEntries.length === 0) {
    console.log('\n📭 No cache entries found')
    if (flags.voice != null && flags.voice !== '') {
      console.log(`   (filtered by voice: ${flags.voice})`)
    }
  } else {
    console.log(`\nFound ${filteredEntries.length} cached entries:\n`)

    for (const [index, entry] of filteredEntries.entries()) {
      const textPreview = flags.verbose
        ? entry.text
        : entry.text.length > 50
          ? `${entry.text.substring(0, 50)}...`
          : entry.text

      console.log(`${index + 1}. "${textPreview}"`)
      console.log(`   • Voice: ${entry.voice}`, entry.model ? `• Model: ${entry.model}` : '')
      console.log(
        `   • Size: ${formatBytes(entry.size)} • Age: ${formatRelativeTime(entry.timestamp)}`,
      )

      if (flags.verbose) {
        console.log(`   • Normalized: "${entry.normalizedText}"`)
        console.log(`   • Cache Key: ${entry.key}`)
      }

      console.log()
    }

    // Summary
    const totalSize = filteredEntries.reduce((sum, e) => sum + e.size, 0)
    console.log('━'.repeat(40))
    console.log(`Total: ${filteredEntries.length} entries, ${formatBytes(totalSize)}`)
  }

  // Show available options
  console.log('\n📋 Options:')
  console.log('  --verbose          Show full text and details')
  console.log('  --clear            Clear entire cache')
  console.log('  --cleanup          Remove expired entries')
  console.log('  --older-than=<age> Remove entries older than (e.g., 7d, 24h)')
  console.log('  --voice=<name>     Filter by voice')
  console.log('  --json             Output as JSON')
  console.log()
}

// Run the CLI
try {
  await main()
} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error')
  process.exit(1)
}
