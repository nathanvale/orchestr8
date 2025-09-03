/**
 * Chat transcript parser for Claude Code hooks
 * Parses and stores conversation transcripts
 */

import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'human'
  content: string
  timestamp?: string
}

export interface ParsedTranscript {
  turns: ConversationTurn[]
  lastAssistantMessage?: string
  metadata?: {
    parsedAt: string
    totalTurns: number
    filePath?: string
  }
}

export interface TranscriptParserConfig {
  storageDir?: string
  useLocalDir?: boolean
}

export interface StoredTranscript {
  id: string
  timestamp: string
  transcript: ParsedTranscript
  originalPath?: string
}

export class TranscriptParser {
  private readonly storageDir: string

  constructor(config: TranscriptParserConfig = {}) {
    if (config.storageDir != null && config.storageDir !== '') {
      this.storageDir = config.storageDir
    } else if (config.useLocalDir === true) {
      this.storageDir = path.join(process.cwd(), '.claude', 'logs', 'transcripts')
    } else {
      this.storageDir = path.join(os.homedir(), '.claude', 'logs', 'transcripts')
    }
  }

  /**
   * Parse a transcript string into structured conversation turns
   */
  parseTranscript(transcriptContent: string, filePath?: string): ParsedTranscript {
    const lines = transcriptContent.split('\n')
    const turns: ConversationTurn[] = []
    let currentTurn: ConversationTurn | null = null
    let lastAssistantMessage = ''

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      // Check for role indicators
      const userMatch = trimmedLine.match(/^(User|Human):\s*(.*)$/)
      const assistantMatch = trimmedLine.match(/^Assistant:\s*(.*)$/)

      if (userMatch) {
        // Save previous turn if exists
        if (currentTurn) {
          turns.push(currentTurn)
        }
        // Start new user turn
        currentTurn = {
          role: userMatch[1].toLowerCase() as 'user' | 'human',
          content: userMatch[2],
        }
      } else if (assistantMatch) {
        // Save previous turn if exists
        if (currentTurn) {
          turns.push(currentTurn)
        }
        // Start new assistant turn
        const content = assistantMatch[1]
        currentTurn = {
          role: 'assistant',
          content,
        }
        lastAssistantMessage = content
      } else if (currentTurn) {
        // Continue current turn
        currentTurn.content += `\n${trimmedLine}`
        if (currentTurn.role === 'assistant') {
          lastAssistantMessage = currentTurn.content
        }
      }
    }

    // Add final turn
    if (currentTurn) {
      turns.push(currentTurn)
    }

    return {
      turns,
      lastAssistantMessage: lastAssistantMessage || undefined,
      metadata: {
        parsedAt: new Date().toISOString(),
        totalTurns: turns.length,
        filePath,
      },
    }
  }

  /**
   * Parse and store a transcript from a file path
   */
  async parseAndStoreTranscript(transcriptPath: string): Promise<StoredTranscript | null> {
    try {
      const content = await fs.readFile(transcriptPath, 'utf-8')
      if (!content.trim()) {
        return null
      }

      const parsed = this.parseTranscript(content, transcriptPath)
      const stored = await this.storeTranscript(parsed, transcriptPath)
      return stored
    } catch {
      // Silently fail - transcript parsing shouldn't break the hook
      return null
    }
  }

  /**
   * Store a parsed transcript to disk
   */
  async storeTranscript(
    transcript: ParsedTranscript,
    originalPath?: string,
  ): Promise<StoredTranscript> {
    try {
      // Ensure storage directory exists
      await fs.mkdir(this.storageDir, { recursive: true })

      // Generate unique ID and timestamp
      const timestamp = new Date().toISOString()
      const id = this.generateTranscriptId(timestamp)

      const stored: StoredTranscript = {
        id,
        timestamp,
        transcript,
        originalPath,
      }

      // Write to storage
      const fileName = `${id}.json`
      const filePath = path.join(this.storageDir, fileName)
      await fs.writeFile(filePath, JSON.stringify(stored, null, 2))

      return stored
    } catch {
      // If storage fails, still return the transcript data
      const timestamp = new Date().toISOString()
      return {
        id: this.generateTranscriptId(timestamp),
        timestamp,
        transcript,
        originalPath,
      }
    }
  }

  /**
   * Read stored transcripts from disk
   */
  async getStoredTranscripts(limit = 10): Promise<StoredTranscript[]> {
    try {
      const files = await fs.readdir(this.storageDir)
      const jsonFiles = files
        .filter((file) => file.endsWith('.json'))
        .sort()
        .reverse() // Most recent first
        .slice(0, limit)

      const transcripts: StoredTranscript[] = []
      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(path.join(this.storageDir, file), 'utf-8')
          const stored = JSON.parse(content) as StoredTranscript
          transcripts.push(stored)
        } catch {
          // Skip malformed files
        }
      }

      return transcripts
    } catch {
      return []
    }
  }

  /**
   * Generate a unique transcript ID
   */
  private generateTranscriptId(timestamp: string): string {
    const date = timestamp.split('T')[0] // YYYY-MM-DD
    const time = timestamp.split('T')[1].replace(/[:.]/g, '-').split('Z')[0]
    const random = Math.random().toString(36).substring(2, 8)
    return `transcript-${date}-${time}-${random}`
  }

  /**
   * Extract the last assistant message from a transcript
   */
  getLastAssistantMessage(transcript: ParsedTranscript): string | null {
    return transcript.lastAssistantMessage ?? null
  }

  /**
   * Get conversation summary
   */
  getSummary(transcript: ParsedTranscript): {
    totalTurns: number
    userTurns: number
    assistantTurns: number
    lastRole: string | null
  } {
    const userTurns = transcript.turns.filter((t) => t.role === 'user' || t.role === 'human').length
    const assistantTurns = transcript.turns.filter((t) => t.role === 'assistant').length
    const lastTurn = transcript.turns[transcript.turns.length - 1]

    return {
      totalTurns: transcript.turns.length,
      userTurns,
      assistantTurns,
      lastRole: lastTurn?.role || null,
    }
  }
}
