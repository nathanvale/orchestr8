/**
 * Test container utilities using testcontainers library
 */

/**
 * Base container configuration
 */
export interface ContainerConfig {
  /** Container image name */
  image: string
  /** Container ports to expose */
  ports: number[]
  /** Environment variables */
  env: Record<string, string>
  /** Container name */
  name?: string
}

/**
 * Create a test container with the given configuration
 */
export function createTestContainer(config: ContainerConfig) {
  // Container creation logic will be implemented here
  return {
    config,
    start: async () => {
      // Start container logic
    },
    stop: async () => {
      // Stop container logic
    },
    getConnectionUrl: () => {
      // Get connection URL logic
      return `http://localhost:${config.ports[0]}`
    },
  }
}

/**
 * Common container configurations
 */
export const containerConfigs = {
  postgres: {
    image: 'postgres:15',
    ports: [5432],
    env: {
      POSTGRES_DB: 'test',
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
    },
  },
  redis: {
    image: 'redis:7',
    ports: [6379],
    env: {},
  },
} as const
