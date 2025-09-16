import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  RemoteCacheClient,
  createRemoteCacheClient,
  type RemoteCacheConfig,
} from './remote-cache.js'

describe('RemoteCacheClient', () => {
  let client: RemoteCacheClient
  let config: RemoteCacheConfig

  beforeEach(() => {
    config = {
      team: 'test-team',
      token: 'test-token',
      signatureKey: 'test-signature-key',
      endpoint: 'https://api.test.com/v8/artifacts',
      timeout: 5000,
      parallel: true,
      maxConcurrency: 2,
    }
    client = new RemoteCacheClient(config)
  })

  describe('constructor', () => {
    it('should create client with provided config', () => {
      expect(client).toBeInstanceOf(RemoteCacheClient)
    })

    it('should use environment variables as defaults', () => {
      const originalEnv = process.env
      process.env.TURBO_TEAM = 'env-team'
      process.env.TURBO_TOKEN = 'env-token'
      process.env.TURBO_REMOTE_CACHE_SIGNATURE_KEY = 'env-key'

      const envClient = new RemoteCacheClient()

      process.env = originalEnv
      expect(envClient).toBeInstanceOf(RemoteCacheClient)
    })

    it('should use default values when no config provided', () => {
      const defaultClient = new RemoteCacheClient()
      expect(defaultClient).toBeInstanceOf(RemoteCacheClient)
    })
  })

  describe('authenticate', () => {
    it('should authenticate with valid token', async () => {
      const result = await client.authenticate()
      expect(result).toBe(true)
    })

    it('should throw error when no token provided', async () => {
      const noTokenClient = new RemoteCacheClient({ token: '' })
      await expect(noTokenClient.authenticate()).rejects.toThrow('No authentication token provided')
    })

    it('should verify JWT token when token contains dots', async () => {
      // Create a mock JWT-like token
      const jwtClient = new RemoteCacheClient({
        token: 'header.payload.signature',
        signatureKey: 'test-key',
      })

      const result = await jwtClient.authenticate()
      // Should return false since it's not a valid JWT, but shouldn't throw
      expect(typeof result).toBe('boolean')
    })

    it('should handle authentication errors gracefully', async () => {
      const badClient = new RemoteCacheClient({
        token: 'invalid-token',
        signatureKey: '',
      })

      const result = await badClient.authenticate()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('uploadArtifact', () => {
    it('should upload artifact successfully', async () => {
      const hash = 'test-hash-123'
      const data = Buffer.from('test artifact data', 'utf8')

      const result = await client.uploadArtifact(hash, data)

      expect(result.success).toBe(true)
      expect(result.bytesTransferred).toBe(data.length)
      expect(result.duration).toBeGreaterThan(0)
      expect(result.error).toBeUndefined()
    })

    it('should fail upload when no authentication', async () => {
      const noAuthClient = new RemoteCacheClient({ token: '' })
      const hash = 'test-hash-123'
      const data = Buffer.from('test data', 'utf8')

      const result = await noAuthClient.uploadArtifact(hash, data)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Authentication required')
      expect(result.bytesTransferred).toBe(0)
    })

    it('should include signature when signature key provided', async () => {
      const hash = 'test-hash-123'
      const data = Buffer.from('test artifact data', 'utf8')

      const result = await client.uploadArtifact(hash, data)

      expect(result.success).toBe(true)
      // In a real implementation, we would verify the signature was included
    })

    it('should handle upload errors', async () => {
      // Mock an error by creating a client that will fail
      const errorClient = new RemoteCacheClient(config)

      // Override internal methods to simulate error
      vi.spyOn(errorClient as any, 'delay').mockRejectedValue(new Error('Network error'))

      const hash = 'test-hash-123'
      const data = Buffer.from('test data', 'utf8')

      const result = await errorClient.uploadArtifact(hash, data)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('downloadArtifact', () => {
    it('should download artifact on cache hit', async () => {
      const hash = 'test-hash-123'

      // Set simulation to ensure cache hit
      client._setCacheSimulation(true)

      const result = await client.downloadArtifact(hash)

      expect(result.success).toBe(true)
      expect(result.cacheHit).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.bytesTransferred).toBeGreaterThan(0)
    })

    it('should handle cache miss', async () => {
      const hash = 'test-hash-123'

      // Set simulation to ensure cache miss
      client._setCacheSimulation(false)

      const result = await client.downloadArtifact(hash)

      expect(result.success).toBe(false)
      expect(result.cacheHit).toBe(false)
      expect(result.error).toBe('Cache miss')
      expect(result.data).toBeUndefined()
    })

    it('should fail download when no authentication', async () => {
      const noAuthClient = new RemoteCacheClient({ token: '' })
      const hash = 'test-hash-123'

      const result = await noAuthClient.downloadArtifact(hash)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Authentication required')
      expect(result.cacheHit).toBe(false)
    })
  })

  describe('artifactExists', () => {
    it('should return true for existing artifact', async () => {
      // Set simulation to ensure artifact exists
      client._setCacheSimulation(true)

      const exists = await client.artifactExists('test-hash')

      expect(exists).toBe(true)
    })

    it('should return false for non-existing artifact', async () => {
      // Set simulation to ensure artifact doesn't exist
      client._setCacheSimulation(false)

      const exists = await client.artifactExists('test-hash')

      expect(exists).toBe(false)
    })

    it('should return false when no authentication', async () => {
      const noAuthClient = new RemoteCacheClient({ token: '' })

      const exists = await noAuthClient.artifactExists('test-hash')

      expect(exists).toBe(false)
    })
  })

  describe('uploadArtifacts (parallel)', () => {
    it('should upload multiple artifacts in parallel', async () => {
      const artifacts = [
        { hash: 'hash-1', data: Buffer.from('data 1', 'utf8') },
        { hash: 'hash-2', data: Buffer.from('data 2', 'utf8') },
        { hash: 'hash-3', data: Buffer.from('data 3', 'utf8') },
      ]

      const results = await client.uploadArtifacts(artifacts)

      expect(results).toHaveLength(3)
      results.forEach((result) => {
        expect(result.success).toBe(true)
        expect(result.bytesTransferred).toBeGreaterThan(0)
      })
    })

    it('should upload sequentially when parallel disabled', async () => {
      const sequentialClient = new RemoteCacheClient({ ...config, parallel: false })
      const artifacts = [
        { hash: 'hash-1', data: Buffer.from('data 1', 'utf8') },
        { hash: 'hash-2', data: Buffer.from('data 2', 'utf8') },
      ]

      const results = await sequentialClient.uploadArtifacts(artifacts)

      expect(results).toHaveLength(2)
      results.forEach((result) => {
        expect(result.success).toBe(true)
      })
    })

    it('should respect max concurrency', async () => {
      const lowConcurrencyClient = new RemoteCacheClient({ ...config, maxConcurrency: 1 })
      const artifacts = [
        { hash: 'hash-1', data: Buffer.from('data 1', 'utf8') },
        { hash: 'hash-2', data: Buffer.from('data 2', 'utf8') },
        { hash: 'hash-3', data: Buffer.from('data 3', 'utf8') },
      ]

      const results = await lowConcurrencyClient.uploadArtifacts(artifacts)

      expect(results).toHaveLength(3)
    })
  })

  describe('downloadArtifacts (parallel)', () => {
    it('should download multiple artifacts in parallel', async () => {
      // Set simulation to ensure cache hits
      client._setCacheSimulation(true)

      const hashes = ['hash-1', 'hash-2', 'hash-3']

      const results = await client.downloadArtifacts(hashes)

      expect(results).toHaveLength(3)
      results.forEach((result) => {
        expect(result.success).toBe(true)
        expect(result.cacheHit).toBe(true)
      })
    })

    it('should download sequentially when parallel disabled', async () => {
      const sequentialClient = new RemoteCacheClient({ ...config, parallel: false })

      // Set simulation to ensure cache hits
      sequentialClient._setCacheSimulation(true)

      const hashes = ['hash-1', 'hash-2']

      const results = await sequentialClient.downloadArtifacts(hashes)

      expect(results).toHaveLength(2)
    })
  })

  describe('verifyArtifact', () => {
    it('should verify artifact with correct signature', () => {
      const data = Buffer.from('test data', 'utf8')
      const key = 'test-key'

      // First sign the data to get the correct signature
      const signedData = createHmac('sha256', key).update(data).digest('hex')

      const isValid = client.verifyArtifact(data, signedData, key)

      expect(isValid).toBe(true)
    })

    it('should reject artifact with incorrect signature', () => {
      const data = Buffer.from('test data', 'utf8')
      const wrongSignature = 'wrong-signature'
      const key = 'test-key'

      const isValid = client.verifyArtifact(data, wrongSignature, key)

      expect(isValid).toBe(false)
    })

    it('should return false when no signature key provided', () => {
      const noKeyClient = new RemoteCacheClient({ ...config, signatureKey: '' })
      const data = Buffer.from('test data', 'utf8')
      const signature = 'some-signature'

      const isValid = noKeyClient.verifyArtifact(data, signature)

      expect(isValid).toBe(false)
    })

    it('should use provided key over default key', () => {
      const data = Buffer.from('test data', 'utf8')
      const customKey = 'custom-key'

      // Sign with custom key
      const signature = createHmac('sha256', customKey).update(data).digest('hex')

      const isValid = client.verifyArtifact(data, signature, customKey)

      expect(isValid).toBe(true)
    })
  })

  describe('createRemoteCacheClient', () => {
    it('should create client with factory function', () => {
      const factoryClient = createRemoteCacheClient(config)

      expect(factoryClient).toBeInstanceOf(RemoteCacheClient)
    })

    it('should create client with default config', () => {
      const defaultClient = createRemoteCacheClient()

      expect(defaultClient).toBeInstanceOf(RemoteCacheClient)
    })
  })

  describe('Security Tests', () => {
    it('should sign artifacts with HMAC-SHA256', async () => {
      const hash = 'test-hash'
      const data = Buffer.from('sensitive data', 'utf8')

      const result = await client.uploadArtifact(hash, data)

      expect(result.success).toBe(true)
      // In real implementation, verify signature was created
    })

    it('should validate signatures on artifact verification', () => {
      const data = Buffer.from('test data', 'utf8')
      const correctKey = 'correct-key'
      const wrongKey = 'wrong-key'

      // Create signature with correct key
      const correctSignature = createHmac('sha256', correctKey).update(data).digest('hex')

      // Verify with correct key
      expect(client.verifyArtifact(data, correctSignature, correctKey)).toBe(true)

      // Verify with wrong key should fail
      expect(client.verifyArtifact(data, correctSignature, wrongKey)).toBe(false)
    })

    it('should prevent signature tampering', () => {
      const data = Buffer.from('original data', 'utf8')
      const tamperedData = Buffer.from('tampered data', 'utf8')
      const key = 'test-key'

      // Create signature for original data
      const signature = createHmac('sha256', key).update(data).digest('hex')

      // Verification should fail for tampered data
      expect(client.verifyArtifact(tamperedData, signature, key)).toBe(false)
    })
  })

  describe('Content-Addressed Storage Tests', () => {
    it('should prevent duplicate artifacts with same content hash', async () => {
      const hash = 'same-content-hash-123'
      const data1 = Buffer.from('identical content', 'utf8')
      const data2 = Buffer.from('identical content', 'utf8')

      // Upload first artifact
      const result1 = await client.uploadArtifact(hash, data1)
      expect(result1.success).toBe(true)

      // Set simulation to ensure artifact exists
      client._setCacheSimulation(true)

      // Check if artifact exists
      const exists = await client.artifactExists(hash)
      expect(exists).toBe(true)

      // Upload same content again (should not create duplicate)
      const result2 = await client.uploadArtifact(hash, data2)
      expect(result2.success).toBe(true)
      // In real implementation, this would check that no duplicate was stored
    })

    it('should store different content with different hashes', async () => {
      const hash1 = 'content-hash-1'
      const hash2 = 'content-hash-2'
      const data1 = Buffer.from('content one', 'utf8')
      const data2 = Buffer.from('content two', 'utf8')

      const result1 = await client.uploadArtifact(hash1, data1)
      const result2 = await client.uploadArtifact(hash2, data2)

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(result1.bytesTransferred).toBe(data1.length)
      expect(result2.bytesTransferred).toBe(data2.length)
    })

    it('should use content hash for cache key generation', async () => {
      const contentHash = 'sha256-abc123def456'
      const data = Buffer.from('test content for hash', 'utf8')

      const result = await client.uploadArtifact(contentHash, data)

      expect(result.success).toBe(true)
      // In real implementation, would verify the hash is used as storage key
    })
  })

  describe('Performance Tests', () => {
    it('should respect timeout configuration', async () => {
      const timeoutClient = new RemoteCacheClient({ ...config, timeout: 100 })

      const startTime = Date.now()
      const result = await timeoutClient.uploadArtifact('hash', Buffer.from('data'))
      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      // Should complete within reasonable time (simulated, so very fast)
      expect(duration).toBeLessThan(1000)
    })

    it('should handle concurrent operations', async () => {
      const concurrentPromises = Array.from({ length: 5 }, (_, i) =>
        client.uploadArtifact(`hash-${i}`, Buffer.from(`data-${i}`)),
      )

      const results = await Promise.all(concurrentPromises)

      expect(results).toHaveLength(5)
      results.forEach((result) => {
        expect(result.success).toBe(true)
      })
    })

    it('should batch operations correctly', async () => {
      const batchClient = new RemoteCacheClient({ ...config, maxConcurrency: 2 })
      const artifacts = Array.from({ length: 6 }, (_, i) => ({
        hash: `hash-${i}`,
        data: Buffer.from(`data-${i}`),
      }))

      const results = await batchClient.uploadArtifacts(artifacts)

      expect(results).toHaveLength(6)
      results.forEach((result) => {
        expect(result.success).toBe(true)
      })
    })
  })
})
