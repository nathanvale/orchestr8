import { describe, expect, it } from 'vitest'

import { redactString, deepRedact, truncateValue } from './redaction.js'

describe('redactString', () => {
  it('should redact API keys in various formats', () => {
    expect(redactString('api_key: "secret123"')).toBe('api_key: "[REDACTED]"')
    expect(redactString('apiKey="abc-def-123"')).toBe('apiKey="[REDACTED]"')
    expect(redactString('api-key: secret123')).toBe('api-key: [REDACTED]')
    expect(redactString('API_KEY=xyz789')).toBe('API_KEY=[REDACTED]')
  })

  it('should redact Bearer tokens', () => {
    expect(redactString('Authorization: Bearer eyJhbGc123')).toBe(
      'Authorization: Bearer [REDACTED]',
    )
    expect(redactString('Bearer abc123def456')).toBe('Bearer [REDACTED]')
  })

  it('should redact JWT tokens', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    expect(redactString(`token: ${jwt}`)).toBe('token: [REDACTED]')
  })

  it('should redact AWS keys', () => {
    expect(redactString('aws_key: AKIAIOSFODNN7EXAMPLE')).toBe(
      'aws_key: [REDACTED]',
    )
  })

  it('should redact private keys', () => {
    const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA123...
-----END RSA PRIVATE KEY-----`
    expect(redactString(privateKey)).toBe('[REDACTED]')
  })

  it('should redact passwords', () => {
    expect(redactString('password: "mySecret123"')).toBe(
      'password: "[REDACTED]"',
    )
    expect(redactString('pwd=test123')).toBe('pwd=[REDACTED]')
    expect(redactString('pass: hunter2')).toBe('pass: [REDACTED]')
  })

  it('should redact secrets', () => {
    expect(redactString('secret: "confidential"')).toBe('secret: "[REDACTED]"')
    expect(redactString('client_secret=abc123')).toBe(
      'client_secret=[REDACTED]',
    )
  })

  it('should redact tokens', () => {
    expect(redactString('token: "abc123xyz"')).toBe('token: "[REDACTED]"')
    expect(redactString('access_token=def456')).toBe('access_token=[REDACTED]')
    expect(redactString('refresh_token: ghi789')).toBe(
      'refresh_token: [REDACTED]',
    )
  })

  it('should handle multiple secrets in one string', () => {
    const input = 'api_key: "key123", password: "pass456", normal: "data"'
    const output = redactString(input)
    expect(output).toContain('[REDACTED]')
    expect(output).toContain('normal: "data"')
  })

  it('should leave non-sensitive data unchanged', () => {
    expect(redactString('username: john')).toBe('username: john')
    expect(redactString('email: test@example.com')).toBe(
      'email: test@example.com',
    )
    expect(redactString('status: active')).toBe('status: active')
  })
})

describe('deepRedact', () => {
  it('should handle null and undefined', () => {
    expect(deepRedact(null, new Set())).toBe(null)
    expect(deepRedact(undefined, new Set())).toBe(undefined)
  })

  it('should handle primitives', () => {
    expect(deepRedact(123, new Set())).toBe(123)
    expect(deepRedact(true, new Set())).toBe(true)
    expect(deepRedact('plain text', new Set())).toBe('plain text')
  })

  it('should redact sensitive keys in objects', () => {
    const obj = {
      username: 'john',
      password: 'secret123',
      apiKey: 'abc-123',
      data: 'normal',
    }

    const sensitiveKeys = new Set(['password', 'apiKey'])
    const result = deepRedact(obj, sensitiveKeys) as Record<string, unknown>

    expect(result.username).toBe('john')
    expect(result.password).toBe('[REDACTED]')
    expect(result.apiKey).toBe('[REDACTED]')
    expect(result.data).toBe('normal')
  })

  it('should redact nested objects', () => {
    const obj = {
      user: {
        name: 'John',
        credentials: {
          password: 'secret',
          token: 'abc123',
        },
      },
      config: {
        apiKey: 'xyz789',
        timeout: 5000,
      },
    }

    const sensitiveKeys = new Set(['password', 'token', 'apiKey'])
    const result = deepRedact(obj, sensitiveKeys) as any

    expect(result.user.name).toBe('John')
    expect(result.user.credentials.password).toBe('[REDACTED]')
    expect(result.user.credentials.token).toBe('[REDACTED]')
    expect(result.config.apiKey).toBe('[REDACTED]')
    expect(result.config.timeout).toBe(5000)
  })

  it('should handle arrays', () => {
    const arr = [
      { password: 'secret1' },
      { password: 'secret2' },
      { username: 'john' },
    ]

    const sensitiveKeys = new Set(['password'])
    const result = deepRedact(arr, sensitiveKeys) as any[]

    expect(result[0].password).toBe('[REDACTED]')
    expect(result[1].password).toBe('[REDACTED]')
    expect(result[2].username).toBe('john')
  })

  it('should handle case-insensitive key matching', () => {
    const obj = {
      PASSWORD: 'secret1',
      Password: 'secret2',
      password: 'secret3',
      ApiKey: 'key123',
    }

    const sensitiveKeys = new Set(['password', 'apikey'])
    const result = deepRedact(obj, sensitiveKeys) as Record<string, unknown>

    expect(result.PASSWORD).toBe('[REDACTED]')
    expect(result.Password).toBe('[REDACTED]')
    expect(result.password).toBe('[REDACTED]')
    expect(result.ApiKey).toBe('[REDACTED]')
  })

  it('should handle nested paths', () => {
    const obj = {
      headers: {
        authorization: 'Bearer token123',
        'content-type': 'application/json',
      },
    }

    const sensitiveKeys = new Set(['headers.authorization'])
    const result = deepRedact(obj, sensitiveKeys) as any

    expect(result.headers.authorization).toBe('[REDACTED]')
    expect(result.headers['content-type']).toBe('application/json')
  })

  it('should redact string values containing secrets', () => {
    const obj = {
      config: 'api_key: "secret123"',
      url: 'https://api.example.com',
    }

    const result = deepRedact(obj, new Set()) as Record<string, unknown>

    expect(result.config).toBe('api_key: "[REDACTED]"')
    expect(result.url).toBe('https://api.example.com')
  })

  it('should handle max depth to prevent infinite recursion', () => {
    const obj = {
      level1: {
        level2: {
          level3: {
            secret: 'deep-secret',
          },
        },
      },
    }

    const result = deepRedact(obj, new Set(['secret']), 2) as any

    expect(result.level1.level2).toBe('[MAX_DEPTH_EXCEEDED]')
  })

  it('should handle circular references gracefully', () => {
    const obj: any = { name: 'test' }
    obj.self = obj // Circular reference

    // Should not throw, max depth prevents infinite recursion
    const result = deepRedact(obj, new Set(), 5) as any

    expect(result.name).toBe('test')
    // After 5 levels, circular reference hits max depth
  })
})

describe('truncateValue', () => {
  it('should not truncate small strings', () => {
    const result = truncateValue('short string', 100)
    expect(result.value).toBe('short string')
    expect(result.truncated).toBe(false)
  })

  it('should truncate large strings', () => {
    const longString = 'a'.repeat(200)
    const result = truncateValue(longString, 100)

    expect(result.value).toBe('a'.repeat(100) + '... [TRUNCATED]')
    expect(result.truncated).toBe(true)
  })

  it('should not truncate small objects', () => {
    const obj = { key: 'value', number: 123 }
    const result = truncateValue(obj, 1000)

    expect(result.value).toEqual(obj)
    expect(result.truncated).toBe(false)
  })

  it('should truncate large objects', () => {
    const obj = {
      data: 'x'.repeat(500),
      more: 'y'.repeat(500),
    }
    const result = truncateValue(obj, 100)

    expect(result.truncated).toBe(true)
    const truncated = result.value as any
    expect(truncated.__truncated).toBe(true)
    expect(truncated.__originalSize).toBeGreaterThan(100)
    expect(truncated.__preview).toBeDefined()
    expect(truncated.__preview.length).toBeLessThanOrEqual(103) // 100 + '...'
  })

  it('should handle non-string, non-object values', () => {
    expect(truncateValue(123, 10)).toEqual({ value: 123, truncated: false })
    expect(truncateValue(true, 10)).toEqual({ value: true, truncated: false })
    expect(truncateValue(null, 10)).toEqual({ value: null, truncated: false })
    expect(truncateValue(undefined, 10)).toEqual({
      value: undefined,
      truncated: false,
    })
  })

  it('should preserve object reference for small objects', () => {
    const obj = { small: 'object' }
    const result = truncateValue(obj, 1000)

    expect(result.value).toBe(obj) // Same reference
  })
})
