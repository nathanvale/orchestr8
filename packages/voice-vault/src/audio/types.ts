/**
 * Voice Vault Audio System Types
 * Defines interfaces and types for audio handling and processing
 */

/**
 * Supported audio formats
 */
export type AudioFormat =
  | 'mp3'
  | 'opus'
  | 'aac'
  | 'flac'
  | 'wav'
  | 'pcm'
  | 'ulaw'
  | 'alaw'
  | 'ogg'
  | 'webm'

/**
 * Audio quality levels
 */
export type AudioQuality = 'low' | 'medium' | 'high' | 'lossless'

/**
 * Audio encoding parameters
 */
export interface AudioEncodingParams {
  /** Audio format */
  format: AudioFormat
  /** Quality level */
  quality?: AudioQuality
  /** Bit rate in kbps */
  bitrate?: number
  /** Sample rate in Hz */
  sampleRate?: number
  /** Number of audio channels */
  channels?: number
  /** Compression level (0-10) */
  compression?: number
}

/**
 * Audio metadata information
 */
export interface AudioMetadata {
  /** Format of the audio */
  format: AudioFormat
  /** Duration in milliseconds */
  durationMs: number
  /** File size in bytes */
  sizeBytes: number
  /** Sample rate in Hz */
  sampleRate?: number
  /** Bit rate in kbps */
  bitrate?: number
  /** Number of channels */
  channels?: number
  /** Audio quality assessment */
  quality?: AudioQuality
  /** Original text that generated this audio */
  originalText?: string
  /** Provider that generated the audio */
  provider?: string
  /** Voice used for generation */
  voice?: string
  /** Correlation ID for tracking */
  correlationId: string
  /** Creation timestamp */
  createdAt: number
}

/**
 * Audio file information
 */
export interface AudioFileInfo {
  /** File path */
  path: string
  /** File name */
  name: string
  /** File extension */
  extension: string
  /** File size in bytes */
  sizeBytes: number
  /** Last modified timestamp */
  lastModified: number
  /** Audio metadata */
  metadata: AudioMetadata
  /** File checksum (for integrity validation) */
  checksum?: string
}

/**
 * Audio processing options
 */
export interface AudioProcessingOptions {
  /** Target format for conversion */
  targetFormat?: AudioFormat
  /** Target quality level */
  targetQuality?: AudioQuality
  /** Volume adjustment (-100 to 100) */
  volumeAdjustment?: number
  /** Speed adjustment (0.5 to 2.0) */
  speedAdjustment?: number
  /** Apply noise reduction */
  noiseReduction?: boolean
  /** Normalize audio levels */
  normalize?: boolean
  /** Trim silence from start/end */
  trimSilence?: boolean
  /** Fade in/out duration in milliseconds */
  fadeMs?: number
  /** Correlation ID for processing tracking */
  correlationId?: string
}

/**
 * Audio processing result
 */
export interface AudioProcessingResult {
  /** Processing success status */
  success: boolean
  /** Processed audio data */
  audioData?: Buffer
  /** Original audio metadata */
  originalMetadata: AudioMetadata
  /** Processed audio metadata */
  processedMetadata?: AudioMetadata
  /** Processing duration in milliseconds */
  processingTimeMs: number
  /** Error message if failed */
  error?: string
  /** Correlation ID for this processing */
  correlationId: string
  /** Processing operations applied */
  operationsApplied: string[]
}

/**
 * Audio validation result
 */
export interface AudioValidationResult {
  /** Validation success status */
  valid: boolean
  /** Validation errors found */
  errors: string[]
  /** Validation warnings */
  warnings: string[]
  /** Audio metadata if valid */
  metadata?: AudioMetadata
  /** Correlation ID for validation */
  correlationId: string
  /** Validation duration in milliseconds */
  validationTimeMs: number
}

/**
 * Audio stream configuration
 */
export interface AudioStreamConfig {
  /** Buffer size in bytes */
  bufferSize: number
  /** Target latency in milliseconds */
  latencyMs: number
  /** Enable real-time processing */
  realTime: boolean
  /** Stream format */
  format: AudioFormat
  /** Stream quality */
  quality: AudioQuality
  /** Correlation ID for streaming */
  correlationId?: string
}

/**
 * Audio stream chunk
 */
export interface AudioStreamChunk {
  /** Chunk sequence number */
  sequence: number
  /** Audio data chunk */
  data: Buffer
  /** Whether this is the final chunk */
  isFinal: boolean
  /** Chunk timestamp */
  timestamp: number
  /** Chunk metadata */
  metadata: {
    /** Format of this chunk */
    format: AudioFormat
    /** Chunk size in bytes */
    sizeBytes: number
    /** Duration of this chunk in milliseconds */
    durationMs: number
  }
  /** Correlation ID for tracking */
  correlationId: string
}

/**
 * Audio playback configuration
 */
export interface AudioPlaybackConfig {
  /** Audio device to use */
  device?: string
  /** Playback volume (0.0-1.0) */
  volume?: number
  /** Start playback at specific time (ms) */
  startTime?: number
  /** Loop playback */
  loop?: boolean
  /** Playback speed multiplier */
  speed?: number
  /** Enable crossfade between tracks */
  crossfade?: boolean
  /** Correlation ID for playback tracking */
  correlationId?: string
}

/**
 * Audio playback result
 */
export interface AudioPlaybackResult {
  /** Playback success status */
  success: boolean
  /** Playback duration in milliseconds */
  durationMs?: number
  /** Audio device used */
  deviceUsed?: string
  /** Error message if failed */
  error?: string
  /** Correlation ID for this playback */
  correlationId: string
  /** Playback start timestamp */
  startedAt: number
  /** Playback end timestamp */
  endedAt?: number
}

/**
 * Audio analyzer configuration
 */
export interface AudioAnalyzerConfig {
  /** Enable frequency analysis */
  enableFrequencyAnalysis?: boolean
  /** Enable volume analysis */
  enableVolumeAnalysis?: boolean
  /** Enable quality assessment */
  enableQualityAssessment?: boolean
  /** Sample window size for analysis */
  windowSizeMs?: number
  /** Correlation ID for analysis */
  correlationId?: string
}

/**
 * Audio analysis result
 */
export interface AudioAnalysisResult {
  /** Analysis success status */
  success: boolean
  /** Audio metadata */
  metadata: AudioMetadata
  /** Volume analysis results */
  volume?: {
    /** Average volume level (0-100) */
    average: number
    /** Peak volume level (0-100) */
    peak: number
    /** Volume range (peak - average) */
    range: number
    /** Silent segments in milliseconds */
    silentSegments: Array<{ start: number; end: number }>
  }
  /** Frequency analysis results */
  frequency?: {
    /** Frequency spectrum data */
    spectrum: number[]
    /** Dominant frequencies */
    dominantFrequencies: number[]
    /** Frequency range */
    range: { min: number; max: number }
  }
  /** Quality assessment */
  quality?: {
    /** Overall quality score (0-100) */
    score: number
    /** Quality factors */
    factors: {
      /** Signal to noise ratio */
      signalToNoise: number
      /** Dynamic range */
      dynamicRange: number
      /** Frequency response */
      frequencyResponse: number
    }
    /** Quality issues detected */
    issues: string[]
  }
  /** Analysis duration in milliseconds */
  analysisTimeMs: number
  /** Error message if failed */
  error?: string
  /** Correlation ID for this analysis */
  correlationId: string
}

/**
 * Audio converter configuration
 */
export interface AudioConverterConfig {
  /** Input format (auto-detect if not specified) */
  inputFormat?: AudioFormat
  /** Output format */
  outputFormat: AudioFormat
  /** Quality settings */
  quality: AudioQuality
  /** Preserve metadata during conversion */
  preserveMetadata?: boolean
  /** Enable progress tracking */
  enableProgress?: boolean
  /** Correlation ID for conversion */
  correlationId?: string
}

/**
 * Audio conversion result
 */
export interface AudioConversionResult {
  /** Conversion success status */
  success: boolean
  /** Converted audio data */
  audioData?: Buffer
  /** Original metadata */
  originalMetadata: AudioMetadata
  /** Converted metadata */
  convertedMetadata?: AudioMetadata
  /** Conversion duration in milliseconds */
  conversionTimeMs: number
  /** Size reduction percentage */
  sizeReduction?: number
  /** Quality loss percentage */
  qualityLoss?: number
  /** Error message if failed */
  error?: string
  /** Correlation ID for this conversion */
  correlationId: string
}

/**
 * Audio cache entry with extended information
 */
export interface AudioCacheEntry {
  /** Cache key */
  key: string
  /** Audio file information */
  fileInfo: AudioFileInfo
  /** Access statistics */
  accessStats: {
    /** Hit count */
    hits: number
    /** Last access timestamp */
    lastAccessed: number
    /** Creation timestamp */
    created: number
  }
  /** Cache metadata */
  cacheMetadata: {
    /** Provider that created this entry */
    provider: string
    /** Voice used */
    voice: string
    /** Original text */
    text: string
    /** Entry size in bytes */
    sizeBytes: number
    /** TTL in milliseconds */
    ttlMs: number
  }
  /** Correlation ID for cache entry */
  correlationId: string
}
