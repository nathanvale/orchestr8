import { createHmac } from 'node:crypto'
import { verifyJWT } from './utils/jwt.js'

/**
 * Remote cache configuration
 */
export interface RemoteCacheConfig {
  /** Turbo team identifier */
  team?: string
  /** Authentication token */
  token?: string
  /** HMAC signature key for artifact verification */
  signatureKey?: string
  /** Cache endpoint URL */
  endpoint?: string
  /** Request timeout in milliseconds */
  timeout?: number
  /** Enable parallel uploads/downloads */
  parallel?: boolean
  /** Maximum number of concurrent requests */
  maxConcurrency?: number
}

/**
 * Cache artifact metadata
 */
export interface CacheArtifact {
  /** Content hash */
  hash: string
  /** Artifact size in bytes */
  size: number
  /** Content type */
  contentType: string
  /** Compression algorithm */
  compression?: 'gzip' | 'brotli'
  /** Creation timestamp */
  createdAt: Date
  /** HMAC signature */
  signature?: string
}

/**
 * Cache upload/download result
 */
export interface CacheOperationResult {
  /** Operation success status */
  success: boolean
  /** Error message if operation failed */
  error?: string
  /** Operation duration in milliseconds */
  duration: number
  /** Bytes transferred */
  bytesTransferred: number
  /** Cache hit/miss for downloads */
  cacheHit?: boolean
}

/**
 * Remote cache client for Turbo
 */
export class RemoteCacheClient {
  private config: Required<RemoteCacheConfig>
  private _simulateCacheHit?: boolean

  constructor(config: RemoteCacheConfig = {}) {
    this.config = {
      team: config.team ?? process.env.TURBO_TEAM ?? '',
      token: config.token ?? process.env.TURBO_TOKEN ?? '',
      signatureKey: config.signatureKey ?? process.env.TURBO_REMOTE_CACHE_SIGNATURE_KEY ?? '',
      endpoint: config.endpoint ?? 'https://api.vercel.com/v8/artifacts',
      timeout: config.timeout ?? 30000,
      parallel: config.parallel ?? true,
      maxConcurrency: config.maxConcurrency ?? 4,
    }
  }

  /**
   * Authenticate with the remote cache service
   */
  async authenticate(): Promise<boolean> {
    if (!this.config.token || this.config.token.trim() === '') {
      throw new Error('No authentication token provided')
    }

    try {
      // Verify token is valid JWT if it looks like one
      if (this.config.token.includes('.')) {
        const decoded = verifyJWT(this.config.token, this.config.signatureKey)
        return decoded !== null
      }

      return true
    } catch {
      return false
    }
  }

  /**
   * Upload an artifact to the remote cache
   */
  async uploadArtifact(hash: string, data: Buffer): Promise<CacheOperationResult> {
    const startTime = Date.now()

    try {
      if (!this.config.token || this.config.token.trim() === '') {
        return {
          success: false,
          error: 'Authentication required',
          duration: Date.now() - startTime,
          bytesTransferred: 0,
        }
      }

      const artifact: CacheArtifact = {
        hash,
        size: data.length,
        contentType: 'application/octet-stream',
        compression: 'gzip',
        createdAt: new Date(),
      }

      // Sign artifact if signature key is provided
      if (this.config.signatureKey) {
        artifact.signature = this.signArtifact(data, this.config.signatureKey)
      }

      // Simulate upload (in real implementation, this would make HTTP request)
      await this.delay(100) // Simulate network latency

      return {
        success: true,
        duration: Date.now() - startTime,
        bytesTransferred: data.length,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
        duration: Date.now() - startTime,
        bytesTransferred: 0,
      }
    }
  }

  /**
   * Download an artifact from the remote cache
   */
  async downloadArtifact(hash: string): Promise<CacheOperationResult & { data?: Buffer }> {
    const startTime = Date.now()

    try {
      if (!this.config.token || this.config.token.trim() === '') {
        return {
          success: false,
          error: 'Authentication required',
          duration: Date.now() - startTime,
          bytesTransferred: 0,
          cacheHit: false,
        }
      }

      // Simulate cache lookup and download
      await this.delay(50) // Simulate network latency

      // For demonstration, simulate cache miss 20% of the time
      const cacheHit = this._simulateCacheHit ?? Math.random() > 0.2

      if (!cacheHit) {
        return {
          success: false,
          error: 'Cache miss',
          duration: Date.now() - startTime,
          bytesTransferred: 0,
          cacheHit: false,
        }
      }

      // Simulate downloaded data
      const data = Buffer.from(`cached-artifact-${hash}`, 'utf8')

      return {
        success: true,
        duration: Date.now() - startTime,
        bytesTransferred: data.length,
        cacheHit: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
        duration: Date.now() - startTime,
        bytesTransferred: 0,
        cacheHit: false,
      }
    }
  }

  /**
   * Check if an artifact exists in the remote cache
   */
  async artifactExists(_hash: string): Promise<boolean> {
    try {
      if (!this.config.token || this.config.token.trim() === '') {
        return false
      }

      // Simulate cache lookup
      await this.delay(25)

      // For demonstration, simulate 80% cache hit rate
      return this._simulateCacheHit ?? Math.random() > 0.2
    } catch {
      return false
    }
  }

  /**
   * Upload multiple artifacts in parallel
   */
  async uploadArtifacts(
    artifacts: Array<{ hash: string; data: Buffer }>,
  ): Promise<CacheOperationResult[]> {
    if (!this.config.parallel) {
      return Promise.all(artifacts.map(({ hash, data }) => this.uploadArtifact(hash, data)))
    }

    return this.executeInBatches(
      artifacts,
      ({ hash, data }) => this.uploadArtifact(hash, data),
      this.config.maxConcurrency,
    )
  }

  /**
   * Download multiple artifacts in parallel
   */
  async downloadArtifacts(
    hashes: string[],
  ): Promise<Array<CacheOperationResult & { data?: Buffer }>> {
    if (!this.config.parallel) {
      return Promise.all(hashes.map((hash) => this.downloadArtifact(hash)))
    }

    return this.executeInBatches(
      hashes,
      (hash) => this.downloadArtifact(hash),
      this.config.maxConcurrency,
    )
  }

  /**
   * Sign an artifact using HMAC-SHA256
   */
  private signArtifact(data: Buffer, key: string): string {
    return createHmac('sha256', key).update(data).digest('hex')
  }

  /**
   * Verify an artifact signature
   */
  verifyArtifact(data: Buffer, signature: string, key?: string): boolean {
    const signatureKey = key || this.config.signatureKey
    if (!signatureKey) {
      return false
    }

    const expectedSignature = this.signArtifact(data, signatureKey)
    return signature === expectedSignature
  }

  /**
   * Execute operations in parallel batches
   */
  private async executeInBatches<T, R>(
    items: T[],
    operation: (item: T) => Promise<R>,
    batchSize: number,
  ): Promise<R[]> {
    const results: R[] = []

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const batchResults = await Promise.all(batch.map(operation))
      results.push(...batchResults)
    }

    return results
  }

  /**
   * Utility delay function for simulation
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Control cache hit simulation for testing purposes
   * @param cacheHit - true for cache hit, false for cache miss, undefined for random
   */
  _setCacheSimulation(cacheHit?: boolean): void {
    this._simulateCacheHit = cacheHit
  }
}

/**
 * Create a remote cache client with environment-based configuration
 */
export function createRemoteCacheClient(config?: RemoteCacheConfig): RemoteCacheClient {
  return new RemoteCacheClient(config)
}
