import * as fs from 'node:fs'
import * as readline from 'node:readline'
import * as stream from 'node:stream'
import { promisify } from 'node:util'
import type { CancellationToken } from '../core/timeout-manager.js'

export interface StreamingReaderOptions {
  encoding?: BufferEncoding
  highWaterMark?: number
  chunkSize?: number
  maxLines?: number
  skipEmptyLines?: boolean
  token?: CancellationToken
}

export interface FileChunk {
  content: string
  lineNumber: number
  offset: number
  isLast: boolean
}

export interface LineInfo {
  text: string
  number: number
  isEmpty: boolean
}

/**
 * Streaming file reader for efficient processing of large files
 */
export class StreamingFileReader {
  private static readonly DEFAULT_CHUNK_SIZE = 64 * 1024 // 64KB
  private static readonly DEFAULT_HIGH_WATER_MARK = 16 * 1024 // 16KB

  constructor(private options: StreamingReaderOptions = {}) {}

  /**
   * Read file content in chunks
   */
  async *readChunks(filePath: string): AsyncGenerator<FileChunk, void, undefined> {
    const chunkSize = this.options.chunkSize ?? StreamingFileReader.DEFAULT_CHUNK_SIZE
    const encoding = this.options.encoding ?? 'utf8'

    const fileHandle = await fs.promises.open(filePath, 'r')
    let offset = 0
    let lineNumber = 1
    const buffer = Buffer.alloc(chunkSize)

    try {
      while (true) {
        // Check for cancellation
        if (this.options.token?.isCancellationRequested) {
          break
        }

        const { bytesRead } = await fileHandle.read(buffer, 0, chunkSize, offset)

        if (bytesRead === 0) {
          break // End of file
        }

        const chunk = buffer.subarray(0, bytesRead)
        const content = chunk.toString(encoding)
        const isLast = bytesRead < chunkSize

        // Count lines in chunk for accurate line numbering
        const newlineCount = (content.match(/\n/g) || []).length

        yield {
          content,
          lineNumber,
          offset,
          isLast,
        }

        offset += bytesRead
        lineNumber += newlineCount

        if (isLast) {
          break
        }
      }
    } finally {
      await fileHandle.close()
    }
  }

  /**
   * Read file line by line
   */
  async *readLines(filePath: string): AsyncGenerator<LineInfo, void, undefined> {
    const encoding = this.options.encoding ?? 'utf8'
    const maxLines = this.options.maxLines
    const skipEmptyLines = this.options.skipEmptyLines ?? false

    const fileStream = fs.createReadStream(filePath, {
      encoding,
      highWaterMark: this.options.highWaterMark ?? StreamingFileReader.DEFAULT_HIGH_WATER_MARK,
    })

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    })

    let lineNumber = 0

    try {
      for await (const line of rl) {
        // Check for cancellation
        if (this.options.token?.isCancellationRequested) {
          break
        }

        lineNumber++
        const isEmpty = line.trim().length === 0

        if (skipEmptyLines && isEmpty) {
          continue
        }

        yield {
          text: line,
          number: lineNumber,
          isEmpty,
        }

        if (maxLines && lineNumber >= maxLines) {
          break
        }
      }
    } finally {
      rl.close()
      fileStream.destroy()
    }
  }

  /**
   * Read file with backpressure control
   */
  async readWithBackpressure(
    filePath: string,
    processor: (chunk: FileChunk) => Promise<void>,
  ): Promise<void> {
    const pipeline = promisify(stream.pipeline)

    const readStream = this.createReadableStream(filePath)
    const processStream = new stream.Transform({
      objectMode: true,
      async transform(chunk: FileChunk, _encoding, callback) {
        try {
          await processor(chunk)
          callback()
        } catch (error) {
          callback(error as Error)
        }
      },
    })

    const writeStream = new stream.Writable({
      objectMode: true,
      write(_chunk, _encoding, callback) {
        callback()
      },
    })

    try {
      await pipeline(readStream, processStream, writeStream)
    } catch (error) {
      // Handle pipeline errors
      throw new Error(
        `File processing failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Create a readable stream from file
   */
  private createReadableStream(filePath: string): stream.Readable {
    let chunkIterator: AsyncGenerator<FileChunk, void, undefined> | null = null
    const readChunks = this.readChunks.bind(this)

    return new stream.Readable({
      objectMode: true,
      async read() {
        if (!chunkIterator) {
          chunkIterator = readChunks(filePath)
        }

        try {
          const { value, done } = await chunkIterator!.next()
          if (done) {
            this.push(null) // End of stream
          } else {
            this.push(value)
          }
        } catch (error) {
          this.destroy(error as Error)
        }
      },
    })
  }

  /**
   * Read file and collect statistics
   */
  async getFileStats(filePath: string): Promise<{
    size: number
    lines: number
    emptyLines: number
    encoding: BufferEncoding
    estimatedMemoryUsage: number
  }> {
    const stats = await fs.promises.stat(filePath)
    const encoding = this.options.encoding ?? 'utf8'

    let lines = 0
    let emptyLines = 0

    // Use line-by-line reading to count lines efficiently
    for await (const line of this.readLines(filePath)) {
      lines++
      if (line.isEmpty) {
        emptyLines++
      }

      // Check for cancellation
      if (this.options.token?.isCancellationRequested) {
        break
      }
    }

    // Estimate memory usage based on file size and encoding
    const bytesPerChar = encoding === 'utf8' ? 1.5 : encoding === 'utf16le' ? 2 : 1
    const estimatedMemoryUsage = stats.size * bytesPerChar

    return {
      size: stats.size,
      lines,
      emptyLines,
      encoding,
      estimatedMemoryUsage,
    }
  }

  /**
   * Search for patterns in file with streaming
   */
  async *searchPattern(
    filePath: string,
    pattern: RegExp | string,
  ): AsyncGenerator<{ line: LineInfo; matches: RegExpMatchArray[] }, void, undefined> {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'g') : pattern

    for await (const line of this.readLines(filePath)) {
      const matches = [...line.text.matchAll(regex)]
      if (matches.length > 0) {
        yield { line, matches }
      }

      // Check for cancellation
      if (this.options.token?.isCancellationRequested) {
        break
      }
    }
  }

  /**
   * Process file in batches of lines
   */
  async processBatches(
    filePath: string,
    batchSize: number,
    processor: (batch: LineInfo[]) => Promise<void>,
  ): Promise<void> {
    let batch: LineInfo[] = []

    for await (const line of this.readLines(filePath)) {
      batch.push(line)

      if (batch.length >= batchSize) {
        await processor(batch)
        batch = []
      }

      // Check for cancellation
      if (this.options.token?.isCancellationRequested) {
        break
      }
    }

    // Process remaining lines
    if (batch.length > 0) {
      await processor(batch)
    }
  }

  /**
   * Copy file with streaming and progress tracking
   */
  async copyFile(
    sourcePath: string,
    destPath: string,
    onProgress?: (bytesProcessed: number, totalBytes: number) => void,
  ): Promise<void> {
    const stats = await fs.promises.stat(sourcePath)
    const totalBytes = stats.size

    const readStream = fs.createReadStream(sourcePath, {
      highWaterMark: this.options.highWaterMark ?? StreamingFileReader.DEFAULT_HIGH_WATER_MARK,
    })

    const writeStream = fs.createWriteStream(destPath, {
      highWaterMark: this.options.highWaterMark ?? StreamingFileReader.DEFAULT_HIGH_WATER_MARK,
    })

    let bytesProcessed = 0

    readStream.on('data', (chunk: string | Buffer) => {
      const chunkLength = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
      bytesProcessed += chunkLength
      if (onProgress) {
        onProgress(bytesProcessed, totalBytes)
      }

      // Check for cancellation
      if (this.options.token?.isCancellationRequested) {
        readStream.destroy()
        writeStream.destroy()
        return
      }
    })

    const pipeline = promisify(stream.pipeline)
    await pipeline(readStream, writeStream)
  }

  /**
   * Validate file can be read with current options
   */
  async validateFile(filePath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check if file exists and is readable
      await fs.promises.access(filePath, fs.constants.R_OK)

      const stats = await fs.promises.stat(filePath)

      // Check if it's actually a file
      if (!stats.isFile()) {
        return { valid: false, error: 'Path is not a file' }
      }

      // Check file size limits (optional)
      const maxSize = 1024 * 1024 * 1024 // 1GB limit
      if (stats.size > maxSize) {
        return { valid: false, error: `File too large (${stats.size} bytes, max ${maxSize})` }
      }

      // Try to read first chunk to validate encoding
      try {
        const reader = new StreamingFileReader({ ...this.options, maxLines: 1 })
        for await (const _line of reader.readLines(filePath)) {
          break // Just read first line to test
        }
      } catch (error) {
        return {
          valid: false,
          error: `Encoding validation failed: ${error instanceof Error ? error.message : String(error)}`,
        }
      }

      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

/**
 * Utility function to create a streaming reader with common options
 */
export function createStreamingReader(options?: StreamingReaderOptions): StreamingFileReader {
  return new StreamingFileReader(options)
}

/**
 * Utility function to read a file line by line with minimal setup
 */
export async function* readFileLines(
  filePath: string,
  options?: StreamingReaderOptions,
): AsyncGenerator<LineInfo, void, undefined> {
  const reader = new StreamingFileReader(options)
  yield* reader.readLines(filePath)
}

/**
 * Utility function to get file statistics quickly
 */
export async function getQuickFileStats(filePath: string): Promise<{
  size: number
  lines: number
  encoding: BufferEncoding
}> {
  const reader = new StreamingFileReader({ maxLines: 10000 }) // Limit for quick stats
  const stats = await reader.getFileStats(filePath)
  return {
    size: stats.size,
    lines: stats.lines,
    encoding: stats.encoding,
  }
}
