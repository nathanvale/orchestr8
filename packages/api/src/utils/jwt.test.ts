import { describe, it, expect, beforeEach } from 'vitest'
import { createJWT, verifyJWT, type JWTPayload } from './jwt.js'

describe('JWT Utilities', () => {
  const secret = 'test-secret-key'
  let payload: JWTPayload

  beforeEach(() => {
    payload = {
      team: 'test-team',
      sub: 'test-user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    }
  })

  describe('createJWT', () => {
    it('should create a valid JWT token', () => {
      const token = createJWT(payload, secret)

      expect(token).toBeTruthy()
      expect(token.split('.')).toHaveLength(3)
    })

    it('should create different tokens for different payloads', () => {
      const token1 = createJWT(payload, secret)
      const token2 = createJWT({ ...payload, team: 'different-team' }, secret)

      expect(token1).not.toBe(token2)
    })

    it('should create different tokens with different secrets', () => {
      const token1 = createJWT(payload, secret)
      const token2 = createJWT(payload, 'different-secret')

      expect(token1).not.toBe(token2)
    })

    it('should handle empty payload', () => {
      const token = createJWT({}, secret)

      expect(token).toBeTruthy()
      expect(token.split('.')).toHaveLength(3)
    })

    it('should include correct header', () => {
      const token = createJWT(payload, secret)
      const [encodedHeader] = token.split('.')
      const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'))

      expect(header).toEqual({
        alg: 'HS256',
        typ: 'JWT',
      })
    })
  })

  describe('verifyJWT', () => {
    it('should verify a valid JWT token', () => {
      const token = createJWT(payload, secret)
      const decoded = verifyJWT(token, secret)

      expect(decoded).toEqual(payload)
    })

    it('should return null for invalid signature', () => {
      const token = createJWT(payload, secret)
      const decoded = verifyJWT(token, 'wrong-secret')

      expect(decoded).toBeNull()
    })

    it('should return null for malformed token', () => {
      const malformedToken = 'invalid.token'
      const decoded = verifyJWT(malformedToken, secret)

      expect(decoded).toBeNull()
    })

    it('should return null for token with missing parts', () => {
      const incompleteToken = 'header.payload'
      const decoded = verifyJWT(incompleteToken, secret)

      expect(decoded).toBeNull()
    })

    it('should return null for expired token', () => {
      const expiredPayload = {
        ...payload,
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      }
      const token = createJWT(expiredPayload, secret)
      const decoded = verifyJWT(token, secret)

      expect(decoded).toBeNull()
    })

    it('should accept token without expiration', () => {
      const noExpPayload = { ...payload }
      delete noExpPayload.exp
      const token = createJWT(noExpPayload, secret)
      const decoded = verifyJWT(token, secret)

      expect(decoded).toEqual(noExpPayload)
    })

    it('should handle corrupted JSON in payload', () => {
      const token = createJWT(payload, secret)
      const [header, , signature] = token.split('.')
      const corruptedToken = `${header}.invalid-base64.${signature}`
      const decoded = verifyJWT(corruptedToken, secret)

      expect(decoded).toBeNull()
    })
  })

  describe('JWT Security', () => {
    it('should be resistant to signature manipulation', () => {
      const token = createJWT(payload, secret)
      const [header, payload_part] = token.split('.')
      const manipulatedToken = `${header}.${payload_part}.manipulated-signature`
      const decoded = verifyJWT(manipulatedToken, secret)

      expect(decoded).toBeNull()
    })

    it('should be resistant to header manipulation', () => {
      const token = createJWT(payload, secret)
      const [, payload_part, signature] = token.split('.')
      const manipulatedHeader = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' }),
        'utf8',
      ).toString('base64url')
      const manipulatedToken = `${manipulatedHeader}.${payload_part}.${signature}`
      const decoded = verifyJWT(manipulatedToken, secret)

      expect(decoded).toBeNull()
    })

    it('should be resistant to payload manipulation', () => {
      const token = createJWT(payload, secret)
      const [header, , signature] = token.split('.')
      const manipulatedPayload = Buffer.from(
        JSON.stringify({ ...payload, team: 'hacker-team' }),
        'utf8',
      ).toString('base64url')
      const manipulatedToken = `${header}.${manipulatedPayload}.${signature}`
      const decoded = verifyJWT(manipulatedToken, secret)

      expect(decoded).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long secrets', () => {
      const longSecret = 'x'.repeat(1000)
      const token = createJWT(payload, longSecret)
      const decoded = verifyJWT(token, longSecret)

      expect(decoded).toEqual(payload)
    })

    it('should handle special characters in payload', () => {
      const specialPayload = {
        team: 'test-team-with-ünicode-and-émojis-🚀',
        sub: 'user@domain.com',
        data: 'Special chars: ñáéíóú',
      }
      const token = createJWT(specialPayload, secret)
      const decoded = verifyJWT(token, secret)

      expect(decoded).toEqual(specialPayload)
    })

    it('should handle empty string secret', () => {
      const token = createJWT(payload, '')
      const decoded = verifyJWT(token, '')

      expect(decoded).toEqual(payload)
    })

    it('should handle numeric values in payload', () => {
      const numericPayload = {
        userId: 12345,
        permissions: 777,
        version: 1.5,
      }
      const token = createJWT(numericPayload, secret)
      const decoded = verifyJWT(token, secret)

      expect(decoded).toEqual(numericPayload)
    })
  })
})
