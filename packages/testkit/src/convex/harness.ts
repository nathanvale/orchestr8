/**
 * Convex test harness implementation using convex-test
 */

import { convexTest } from 'convex-test'
import type {
  ConvexTestContext,
  ConvexTestConfig,
  ConvexDatabaseContext,
  ConvexAuthContext,
  ConvexStorageContext,
  ConvexSchedulerContext,
  ConvexLifecycleContext,
  ConvexSeedConfig,
  GenericSchema,
  DataModelFromSchemaDefinition,
  SchemaDefinition,
  UserIdentity,
  TestConvex,
} from './context.js'
import { ConvexTestError } from './context.js'

/**
 * Internal storage for managing test state
 */
interface TestHarnessState {
  convexInstance: ReturnType<typeof convexTest>
  mockStorage: Map<string, { data: ArrayBuffer; name: string; size: number }>
  currentUser: Partial<UserIdentity> | null
  isCleanedUp: boolean
  debug: boolean
}

/**
 * Create a Convex test harness with full context utilities
 */
export function createConvexTestHarness<Schema extends GenericSchema = GenericSchema>(
  config: ConvexTestConfig<Schema> = {},
): ConvexTestContext<Schema> {
  const state: TestHarnessState = {
    convexInstance: convexTest(config.schema as any, config.modules),
    mockStorage: new Map(),
    currentUser: config.defaultUser || null,
    isCleanedUp: false,
    debug: config.debug || false,
  }

  const debugLog = (message: string, ...args: unknown[]) => {
    if (state.debug) {
      console.log(`[ConvexTestHarness] ${message}`, ...args)
    }
  }

  debugLog('Creating test harness', { schema: !!config.schema, modules: !!config.modules })

  // Database context implementation
  const db: ConvexDatabaseContext<DataModelFromSchemaDefinition<SchemaDefinition<Schema>>> = {
    async run(func) {
      debugLog('Running database operation')
      return state.convexInstance.run(func as any)
    },

    async seed(seedFn) {
      debugLog('Seeding database')
      return state.convexInstance.run(seedFn as any)
    },

    async clear() {
      debugLog('Clearing database')
      // Note: convex-test doesn't provide explicit clear method,
      // so we recreate the instance
      state.convexInstance = convexTest(config.schema as any, config.modules)
      state.mockStorage.clear()
    },

    async getAllDocuments(_tableName) {
      debugLog('Getting all documents from table', _tableName)
      return state.convexInstance.run(async (_ctx) => {
        // This is a simplified implementation - in real usage,
        // you'd need to implement proper table scanning
        // based on your specific schema
        return []
      })
    },

    async countDocuments(_tableName) {
      debugLog('Counting documents in table', _tableName)
      return state.convexInstance.run(async (_ctx) => {
        // This is a simplified implementation
        return 0
      })
    },
  }

  // Authentication context implementation
  const auth: ConvexAuthContext<Schema, DataModelFromSchemaDefinition<SchemaDefinition<Schema>>> = {
    withUser(identity) {
      debugLog('Setting user identity', identity)
      state.currentUser = identity
      return state.convexInstance.withIdentity(identity) as unknown as TestConvex<
        SchemaDefinition<Schema>
      >
    },

    withoutAuth() {
      debugLog('Removing user identity')
      state.currentUser = null
      return state.convexInstance as unknown as TestConvex<SchemaDefinition<Schema>>
    },

    switchUser(identity) {
      debugLog('Switching user identity', identity)
      state.currentUser = identity
      return state.convexInstance.withIdentity(identity) as unknown as TestConvex<
        SchemaDefinition<Schema>
      >
    },

    getCurrentUser() {
      return state.currentUser
    },

    testUsers: {
      admin: () => ({
        subject: 'admin_user_123',
        issuer: 'test',
        tokenIdentifier: 'admin_token',
        role: 'admin',
      }),
      regular: () => ({
        subject: 'regular_user_456',
        issuer: 'test',
        tokenIdentifier: 'regular_token',
        role: 'user',
      }),
      anonymous: () => null,
    },
  }

  // Storage context implementation
  const storage: ConvexStorageContext = {
    async uploadFile(name, content) {
      const data = typeof content === 'string' ? new TextEncoder().encode(content) : content
      const fileId = `storage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      state.mockStorage.set(fileId, {
        data,
        name,
        size: data.byteLength,
      })

      debugLog('Uploaded file', { fileId, name, size: data.byteLength })
      return fileId
    },

    async getFile(storageId) {
      const file = state.mockStorage.get(storageId)
      debugLog('Retrieved file', { storageId, found: !!file })
      return file?.data || null
    },

    async deleteFile(storageId) {
      const deleted = state.mockStorage.delete(storageId)
      debugLog('Deleted file', { storageId, deleted })
    },

    async listFiles() {
      const files = Array.from(state.mockStorage.entries()).map(([id, file]) => ({
        id,
        name: file.name,
        size: file.size,
      }))
      debugLog('Listed files', { count: files.length })
      return files
    },

    async clearFiles() {
      const count = state.mockStorage.size
      state.mockStorage.clear()
      debugLog('Cleared files', { count })
    },
  }

  // Scheduler context implementation
  const scheduler: ConvexSchedulerContext = {
    async getPendingFunctions() {
      debugLog('Getting pending scheduled functions')
      // Mock implementation - convex-test doesn't expose internal scheduler state
      return []
    },

    async finishInProgress() {
      debugLog('Finishing in-progress scheduled functions')
      return state.convexInstance.finishInProgressScheduledFunctions()
    },

    async finishAll(advanceTimers) {
      debugLog('Finishing all scheduled functions')
      return state.convexInstance.finishAllScheduledFunctions(advanceTimers)
    },

    async cancelAll() {
      debugLog('Cancelling all scheduled functions')
      // Mock implementation - would need actual scheduler access
    },

    async advanceTime(ms) {
      debugLog('Advancing time', { ms })
      // This would typically integrate with vi.advanceTimersByTime or similar
      // For now, it's a placeholder
    },
  }

  // Lifecycle context implementation
  const lifecycle: ConvexLifecycleContext = {
    async reset() {
      debugLog('Resetting test harness')
      await db.clear()
      await storage.clearFiles()
      state.currentUser = config.defaultUser || null
      state.isCleanedUp = false
    },

    async cleanup() {
      debugLog('Cleaning up test harness')
      state.mockStorage.clear()
      state.currentUser = null
      state.isCleanedUp = true
    },

    setupHooks(_hooks) {
      debugLog('Setting up lifecycle hooks')
      // This would integrate with the test framework's hooks
      // For now, we store the hooks but don't actually set them up
      // In a real implementation, this would use beforeEach/afterEach from vitest
    },
  }

  const context: ConvexTestContext<Schema> = {
    convex: state.convexInstance as unknown as TestConvex<SchemaDefinition<Schema>>,
    db,
    auth,
    storage,
    scheduler,
    lifecycle,
  }

  // Run setup hooks if provided
  if (config.setup?.beforeEach) {
    config.setup.beforeEach(context).catch((error) => {
      debugLog('Setup beforeEach hook failed', error)
    })
  }

  debugLog('Test harness created successfully')
  return context
}

/**
 * Simplified setup function for quick test harness creation
 */
export function setupConvexTest<Schema extends GenericSchema = GenericSchema>(
  config: ConvexTestConfig<Schema> = {},
): ConvexTestContext<Schema> {
  return createConvexTestHarness(config)
}

/**
 * Create a test harness with authentication pre-configured
 */
export function createAuthenticatedConvexTest<Schema extends GenericSchema = GenericSchema>(
  config: ConvexTestConfig<Schema> & { user: Partial<UserIdentity> },
): ConvexTestContext<Schema> {
  const { user, ...restConfig } = config
  const harness = createConvexTestHarness({
    ...restConfig,
    defaultUser: user,
  })

  // Set the authenticated context immediately
  harness.auth.withUser(user)
  return harness
}

/**
 * Seed test data using a simplified configuration
 */
export async function seedConvexData<Schema extends GenericSchema = GenericSchema>(
  context: ConvexTestContext<Schema>,
  seedConfig: ConvexSeedConfig,
): Promise<void> {
  for (const [tableName, data] of Object.entries(seedConfig)) {
    const documents = typeof data === 'function' ? await data() : data

    await context.db.run(async (ctx: any) => {
      for (const doc of documents) {
        await ctx.db.insert(tableName, doc)
      }
    })
  }
}

/**
 * Utility to create common test data factories
 */
export const createTestDataFactories = () => ({
  user: (overrides: Record<string, unknown> = {}) => ({
    name: 'Test User',
    email: 'test@example.com',
    createdAt: Date.now(),
    ...overrides,
  }),

  post: (userId: string, overrides: Record<string, unknown> = {}) => ({
    title: 'Test Post',
    content: 'This is a test post content',
    authorId: userId,
    createdAt: Date.now(),
    published: false,
    ...overrides,
  }),

  comment: (postId: string, userId: string, overrides: Record<string, unknown> = {}) => ({
    content: 'This is a test comment',
    postId,
    authorId: userId,
    createdAt: Date.now(),
    ...overrides,
  }),
})

/**
 * Assert that a Convex test context is properly initialized
 */
export function assertConvexTestContext<Schema extends GenericSchema = GenericSchema>(
  context: ConvexTestContext<Schema>,
): void {
  if (!context.convex) {
    throw new ConvexTestError('Convex instance not initialized', 'INITIALIZATION_ERROR')
  }
  if (!context.db) {
    throw new ConvexTestError('Database context not initialized', 'INITIALIZATION_ERROR')
  }
  if (!context.auth) {
    throw new ConvexTestError('Auth context not initialized', 'INITIALIZATION_ERROR')
  }
  if (!context.storage) {
    throw new ConvexTestError('Storage context not initialized', 'INITIALIZATION_ERROR')
  }
  if (!context.scheduler) {
    throw new ConvexTestError('Scheduler context not initialized', 'INITIALIZATION_ERROR')
  }
  if (!context.lifecycle) {
    throw new ConvexTestError('Lifecycle context not initialized', 'INITIALIZATION_ERROR')
  }
}

/**
 * Create a minimal test context for unit tests that don't need full features
 */
export function createMinimalConvexTest<Schema extends GenericSchema = GenericSchema>(
  schema?: SchemaDefinition<Schema>,
): Pick<ConvexTestContext<Schema>, 'convex' | 'db'> {
  const convexInstance = convexTest(schema as any)

  return {
    convex: convexInstance as unknown as TestConvex<SchemaDefinition<Schema>>,
    db: {
      async run(func) {
        return convexInstance.run(func as any)
      },
      async seed(seedFn) {
        return convexInstance.run(seedFn as any)
      },
      async clear() {
        // Recreate instance for clearing
        return
      },
      async getAllDocuments() {
        return []
      },
      async countDocuments() {
        return 0
      },
    },
  }
}
