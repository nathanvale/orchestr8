/**
 * Redaction utilities for sensitive data in logs
 */

/**
 * Pattern for detecting potential secrets in strings
 */
const SECRET_PATTERNS = [
  // API keys and tokens
  /(?:api[_-]?key|token|secret|password|pwd|pass|credential|auth)["\s]*[:=]["\s]*["']?([^"'\s,;}]+)["']?/gi,
  // Bearer tokens
  /Bearer\s+([A-Za-z0-9\-._~+/]+=*)/gi,
  // Base64 encoded strings that might be secrets (min 20 chars)
  /(?:key|token|secret|password)["'\s]*[:=]["'\s]*([A-Za-z0-9+/]{20,}={0,2})/gi,
  // JWT tokens
  /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
  // AWS keys
  /AKIA[0-9A-Z]{16}/g,
  // Private keys
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]+?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
]

/**
 * Redact sensitive patterns from a string
 */
export function redactString(value: string): string {
  let redacted = value

  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, (match, captured) => {
      // Keep the key part but redact the value
      if (captured) {
        return match.replace(captured, '[REDACTED]')
      }
      return '[REDACTED]'
    })
  }

  return redacted
}

/**
 * Deep redact sensitive data from an object
 */
export function deepRedact(
  obj: unknown,
  sensitiveKeys: Set<string>,
  maxDepth = 10,
): unknown {
  if (maxDepth <= 0) {
    return '[MAX_DEPTH_EXCEEDED]'
  }

  // Handle primitives
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'string') {
    // Check if the string itself contains sensitive patterns
    return redactString(obj)
  }

  if (typeof obj !== 'object') {
    return obj
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => deepRedact(item, sensitiveKeys, maxDepth - 1))
  }

  // Handle objects
  const redacted: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    // Check if key should be redacted
    if (shouldRedactKey(key, sensitiveKeys)) {
      redacted[key] = '[REDACTED]'
    } else if (typeof value === 'string') {
      // Redact string values that might contain secrets
      redacted[key] = redactString(value)
    } else if (typeof value === 'object' && value !== null) {
      // Recursively redact nested objects
      redacted[key] = deepRedact(value, sensitiveKeys, maxDepth - 1)
    } else {
      redacted[key] = value
    }
  }

  return redacted
}

/**
 * Check if a key should be redacted
 */
function shouldRedactKey(key: string, sensitiveKeys: Set<string>): boolean {
  const lowerKey = key.toLowerCase()

  // Check exact match
  if (sensitiveKeys.has(key)) {
    return true
  }

  // Check case-insensitive match
  for (const sensitiveKey of sensitiveKeys) {
    if (lowerKey === sensitiveKey.toLowerCase()) {
      return true
    }

    // Check if key contains sensitive pattern
    if (lowerKey.includes(sensitiveKey.toLowerCase())) {
      return true
    }

    // Check nested path (e.g., 'headers.authorization')
    if (sensitiveKey.includes('.')) {
      const parts = sensitiveKey.split('.')
      if (parts.some((part) => lowerKey.includes(part.toLowerCase()))) {
        return true
      }
    }
  }

  return false
}

/**
 * Truncate large values to prevent log bloat
 */
export function truncateValue(
  value: unknown,
  maxSize: number,
): { value: unknown; truncated: boolean } {
  if (typeof value === 'string' && value.length > maxSize) {
    return {
      value: value.substring(0, maxSize) + '... [TRUNCATED]',
      truncated: true,
    }
  }

  if (typeof value === 'object' && value !== null) {
    const json = JSON.stringify(value)
    if (json.length > maxSize) {
      return {
        value: {
          __truncated: true,
          __originalSize: json.length,
          __preview: json.substring(0, Math.min(100, maxSize)) + '...',
        },
        truncated: true,
      }
    }
  }

  return { value, truncated: false }
}
