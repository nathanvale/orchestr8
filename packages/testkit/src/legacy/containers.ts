/**
 * Legacy Container Utilities
 * 
 * ⚠️ DEPRECATED: These utilities will be removed in v3.0.0
 * 
 * This module contains deprecated container utilities that have been replaced
 * with more specific database container implementations.
 * 
 * Migration guide:
 * - Replace ContainerConfig with specific database configurations
 * - Replace createTestContainer() with createMySQLContext() or specific database helpers
 * - Replace containerConfigs with MySQLPresets or specific database presets
 * 
 * @deprecated All methods in this module will be removed in v3.0.0
 */

/**
 * Legacy container configuration for backwards compatibility
 * @deprecated Will be removed in v3.0.0. Use the specific database container implementations instead
 * 
 * @example
 * // ❌ DEPRECATED:
 * const config: ContainerConfig = {
 *   image: 'mysql:8.0',
 *   ports: [3306],
 *   env: { MYSQL_DATABASE: 'test' }
 * }
 * 
 * // ✅ NEW:
 * import { MySQLPresets } from '@orchestr8/testkit/containers'
 * const config = MySQLPresets.mysql8()
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
 * @deprecated Will be removed in v3.0.0. Use createMySQLContext or specific database helpers instead
 * 
 * @example
 * // ❌ DEPRECATED:
 * const container = createTestContainer(config)
 * await container.start()
 * 
 * // ✅ NEW:
 * import { createMySQLContext } from '@orchestr8/testkit/containers'
 * const mysql = await createMySQLContext()
 */
export function createTestContainer(config: ContainerConfig) {
  console.error(`
⚠️  [DEPRECATED] createTestContainer() will be removed in v3.0.0

Use specific database helpers instead:

  // Replace this:
  import { createTestContainer } from '@orchestr8/testkit/legacy'
  const container = createTestContainer(config)
  await container.start()

  // With this:
  import { createMySQLContext } from '@orchestr8/testkit/containers'
  const mysql = await createMySQLContext()

Migration guide: https://github.com/yourorg/testkit/blob/main/packages/testkit/MIGRATION.md
`)

  return {
    config,
    start: async () => {
      throw new Error('Legacy createTestContainer is deprecated. Use specific database helpers like createMySQLContext() instead.')
    },
    stop: async () => {
      throw new Error('Legacy createTestContainer is deprecated. Use specific database helpers like createMySQLContext() instead.')
    },
    getConnectionUrl: () => {
      throw new Error('Legacy createTestContainer is deprecated. Use specific database helpers like createMySQLContext() instead.')
    },
  }
}

/**
 * Common container configurations
 * @deprecated Will be removed in v3.0.0. Use MySQLPresets or specific database presets instead
 * 
 * @example
 * // ❌ DEPRECATED:
 * const config = containerConfigs.mysql
 * 
 * // ✅ NEW:
 * import { MySQLPresets } from '@orchestr8/testkit/containers'
 * const config = MySQLPresets.mysql8()
 */
export const containerConfigs = {
  mysql: {
    image: 'mysql:8.0',
    ports: [3306],
    env: {
      MYSQL_DATABASE: 'test',
      MYSQL_ROOT_PASSWORD: 'password',
      MYSQL_USER: 'testuser',
      MYSQL_PASSWORD: 'password',
    },
  },
  postgres: {
    image: 'postgres:15',
    ports: [5432],
    env: {
      POSTGRES_DB: 'test',
      POSTGRES_USER: 'testuser',
      POSTGRES_PASSWORD: 'password',
    },
  },
  redis: {
    image: 'redis:7',
    ports: [6379],
    env: {},
  },
}

// Log deprecation warning when containerConfigs is accessed
const handler: ProxyHandler<typeof containerConfigs> = {
  get(target, prop) {
    console.error(`
⚠️  [DEPRECATED] containerConfigs.${String(prop)} will be removed in v3.0.0

Use specific database presets instead:

  // Replace this:
  import { containerConfigs } from '@orchestr8/testkit/legacy'
  const config = containerConfigs.${String(prop)}

  // With this:
  import { MySQLPresets } from '@orchestr8/testkit/containers'
  const config = MySQLPresets.mysql8()

Migration guide: https://github.com/yourorg/testkit/blob/main/packages/testkit/MIGRATION.md
`)
    return target[prop as keyof typeof containerConfigs]
  },
}

// Export proxied version that warns on access
export const containerConfigsProxy = new Proxy(containerConfigs, handler)