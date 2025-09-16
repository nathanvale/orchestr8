import { createHmac } from 'node:crypto'

/**
 * JWT Header for Turbo remote cache authentication
 */
export interface JWTHeader {
  alg: 'HS256'
  typ: 'JWT'
}

/**
 * JWT Payload for Turbo remote cache authentication
 */
export interface JWTPayload {
  /** Team identifier */
  team?: string
  /** Token expiration timestamp */
  exp?: number
  /** Issued at timestamp */
  iat?: number
  /** Subject (user/service identifier) */
  sub?: string
  /** Allow additional properties */
  [key: string]: unknown
}

/**
 * Create a JWT token for Turbo remote cache authentication
 * @param payload - JWT payload
 * @param secret - HMAC secret key
 * @returns Signed JWT token
 */
export function createJWT(payload: JWTPayload, secret: string): string {
  const header: JWTHeader = {
    alg: 'HS256',
    typ: 'JWT',
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const message = `${encodedHeader}.${encodedPayload}`

  const signature = createHmac('sha256', secret).update(message).digest('base64url')

  return `${message}.${signature}`
}

/**
 * Verify a JWT token
 * @param token - JWT token to verify
 * @param secret - HMAC secret key
 * @returns Decoded payload if valid, null if invalid
 */
export function verifyJWT(token: string, secret: string): JWTPayload | null {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.')
    if (!encodedHeader || !encodedPayload || !signature) {
      return null
    }

    const message = `${encodedHeader}.${encodedPayload}`
    const expectedSignature = createHmac('sha256', secret).update(message).digest('base64url')

    if (signature !== expectedSignature) {
      return null
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JWTPayload

    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

/**
 * Base64 URL encode a string
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf8').toString('base64url')
}

/**
 * Base64 URL decode a string
 */
function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8')
}
