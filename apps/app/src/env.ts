// Environment variable access with proper typing
function getEnvVar(key: string, fallback?: string): string {
  try {
    const env = import.meta.env as Record<string, string | undefined>
    const value = env[key]
    return value ?? fallback ?? ''
  } catch {
    return fallback ?? ''
  }
}

export const API_BASE_URL = getEnvVar('VITE_API_URL', 'http://localhost:3333')
export const IS_DEVELOPMENT = getEnvVar('MODE') === 'development'
