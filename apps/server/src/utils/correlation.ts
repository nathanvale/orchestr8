/**
 * Generate a unique correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 11)
  return `req-${timestamp}-${randomPart}`
}
