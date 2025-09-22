/**
 * Convex test harness implementation
 * Provides a thin adapter layer over convex-test with additional utilities
 */

import { convexTest } from 'convex-test'
import type { TestConvex as ConvexTestInstance } from 'convex-test'
import type {
  GenericSchema,
  SchemaDefinition,
  DataModelFromSchemaDefinition,
  UserIdentity,
} from 'convex/server'
import type {
  ConvexTestContext,
  ConvexTestConfig,
  ConvexDatabaseContext,
  ConvexAuthContext,
  ConvexStorageContext,
  ConvexSchedulerContext,
  ConvexLifecycleContext,
} from './context.js'
import { ConvexTestError } from './context.js'

/**
 * Internal storage for managing test state
 */
interface TestHarnessState<Schema extends GenericSchema = GenericSchema> {
  convexInstance: ConvexTestInstance<SchemaDefinition<Schema, boolean>>
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
  const state: TestHarnessState<Schema> = {
    convexInstance: convexTest(config.schema, config.modules) as ConvexTestInstance<
      SchemaDefinition<Schema, boolean>
    >,
    mockStorage: new Map(),
    currentUser: config.defaultUser || null,
    isCleanedUp: false,
    debug: config.debug || false,
  }

  // Track original instance for reset functionality
  const originalConfig = { ...config }

  // Debug logging helper
  const debugLog = (message: string, ...args: unknown[]) => {
    if (state.debug) {
      console.log(`[ConvexTestHarness] ${message}`, ...args)
    }
  }

  debugLog('Creating test harness', { schema: !!config.schema, modules: !!config.modules })

  // Database context implementation
  const db: ConvexDatabaseContext<
    DataModelFromSchemaDefinition<SchemaDefinition<Schema, boolean>>
  > = {
    async run(func) {
      debugLog('Running database operation')
      return state.convexInstance.run(func)
    },

    async seed(seedFn) {
      debugLog('Seeding database')
      return state.convexInstance.run(seedFn)
    },

    async clear() {
      debugLog('Clearing database')
      // Note: convex-test doesn't provide explicit clear method,
      // so we recreate the instance
      state.convexInstance = convexTest(config.schema, config.modules) as ConvexTestInstance<
        SchemaDefinition<Schema, boolean>
      >
      state.mockStorage.clear()
    },

    async getAllDocuments(tableName) {
      debugLog('getAllDocuments called for table', tableName)
      throw new ConvexTestError(
        'getAllDocuments is not supported yet - use db.query() instead to fetch documents',
        'NOT_IMPLEMENTED',
      )
    },

    async countDocuments(tableName) {
      debugLog('countDocuments called for table', tableName)
      throw new ConvexTestError(
        'countDocuments is not supported yet - use db.query() instead to count documents',
        'NOT_IMPLEMENTED',
      )
    },
  }

  // Authentication context implementation with chainable API
  const auth: ConvexAuthContext<
    Schema,
    DataModelFromSchemaDefinition<SchemaDefinition<Schema, boolean>>
  > = {
    withUser(identity) {
      debugLog('Setting user identity', identity)
      state.currentUser = identity
      // Return a new context with identity applied for chaining
      const authenticatedInstance = state.convexInstance.withIdentity(identity as UserIdentity)
      return authenticatedInstance as ConvexTestInstance<SchemaDefinition<Schema, boolean>>
    },

    withoutAuth() {
      debugLog('Removing user identity')
      state.currentUser = null
      // Return anonymous context for chaining
      return state.convexInstance as ConvexTestInstance<SchemaDefinition<Schema, boolean>>
    },

    switchUser(identity) {
      debugLog('Switching user identity', identity)
      state.currentUser = identity
      // Return a new context with switched identity
      const authenticatedInstance = state.convexInstance.withIdentity(identity as UserIdentity)
      return authenticatedInstance as ConvexTestInstance<SchemaDefinition<Schema, boolean>>
    },

    asAnonymous() {
      debugLog('Switching to anonymous context')
      state.currentUser = null
      return state.convexInstance as ConvexTestInstance<SchemaDefinition<Schema, boolean>>
    },

    getCurrentUser() {
      return state.currentUser
    },

    async withAuth<T>(
      identity: Partial<UserIdentity>,
      fn: (ctx: ConvexTestInstance<SchemaDefinition<Schema, boolean>>) => Promise<T>,
    ): Promise<T> {
      debugLog('Running with authenticated context', identity)
      const authenticatedInstance = state.convexInstance.withIdentity(identity as UserIdentity)
      return fn(
        authenticatedInstance as unknown as ConvexTestInstance<SchemaDefinition<Schema, boolean>>,
      )
    },

    testUsers: {
      admin: () => ({
        subject: 'admin_user_123',
        issuer: 'test',
        tokenIdentifier: 'admin_token',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
      }),
      regular: () => ({
        subject: 'user_123',
        issuer: 'test',
        tokenIdentifier: 'user_token',
        name: 'Test User',
        email: 'user@example.com',
        role: 'user',
      }),
      anonymous: () => null,
    },
  }

  // Storage context implementation
  const storage: ConvexStorageContext = {
    async uploadFile(name, content) {
      debugLog('Uploading file', { name })
      const buffer = typeof content === 'string' ? Buffer.from(content) : content
      const id = `storage_${Date.now()}_${Math.random().toString(36).substring(7)}`

      // Handle ArrayBuffer and SharedArrayBuffer
      let arrayBuffer: ArrayBuffer
      if (buffer instanceof SharedArrayBuffer) {
        // Convert SharedArrayBuffer to ArrayBuffer
        const uint8Array = new Uint8Array(buffer)
        arrayBuffer = uint8Array.buffer
      } else if (buffer instanceof ArrayBuffer) {
        arrayBuffer = buffer
      } else {
        // Convert Buffer or other types to ArrayBuffer
        const uint8Array = new Uint8Array(buffer)
        arrayBuffer = uint8Array.buffer
      }

      state.mockStorage.set(id, {
        data: arrayBuffer,
        name,
        size: arrayBuffer.byteLength,
      })
      debugLog('File uploaded', { id, name, size: arrayBuffer.byteLength })
      return id
    },

    async getFile(storageId) {
      debugLog('Getting file', { storageId })
      const file = state.mockStorage.get(storageId)
      return file ? file.data : null
    },

    async deleteFile(storageId) {
      debugLog('Deleting file', { storageId })
      state.mockStorage.delete(storageId)
    },

    async listFiles() {
      debugLog('Listing files')
      return Array.from(state.mockStorage.entries()).map(([id, file]) => ({
        id,
        name: file.name,
        size: file.size,
      }))
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

  // Lifecycle context implementation with proper isolation
  const lifecycle: ConvexLifecycleContext = {
    async reset() {
      debugLog('Resetting test harness')
      // Recreate convex instance for complete isolation
      state.convexInstance = convexTest(
        originalConfig.schema,
        originalConfig.modules,
      ) as ConvexTestInstance<SchemaDefinition<Schema, boolean>>
      state.mockStorage.clear()
      state.currentUser = originalConfig.defaultUser || null
      state.isCleanedUp = false
      debugLog('Reset complete - test harness in clean state')
    },

    async cleanup() {
      debugLog('Cleaning up test harness')
      state.mockStorage.clear()
      state.currentUser = null
      state.isCleanedUp = true
      // Clear any pending scheduled functions
      try {
        await state.convexInstance.finishAllScheduledFunctions(() => {})
      } catch {
        // Ignore errors during cleanup
      }
      debugLog('Cleanup complete')
    },

    setupHooks(hooks) {
      debugLog('Setting up lifecycle hooks')
      // This would integrate with test framework lifecycle
      if (typeof beforeEach === 'function') {
        beforeEach(async () => {
          if (hooks.beforeEach) await hooks.beforeEach()
          await lifecycle.reset()
        })
      }
      if (typeof afterEach === 'function') {
        afterEach(async () => {
          if (hooks.afterEach) await hooks.afterEach()
          await lifecycle.cleanup()
        })
      }

      // Alternative: Store hooks in global for manual invocation
      if (typeof global !== 'undefined') {
        ;(global as Record<string, unknown>).__convexBeforeEach = async () => {
          if (hooks.beforeEach) await hooks.beforeEach()
          await lifecycle.reset()
        }
        ;(global as Record<string, unknown>).__convexAfterEach = async () => {
          if (hooks.afterEach) await hooks.afterEach()
          await lifecycle.cleanup()
        }
      }
    },
  }

  const context: ConvexTestContext<Schema> = {
    convex: state.convexInstance as ConvexTestInstance<SchemaDefinition<Schema, boolean>>,
    db,
    auth,
    storage,
    scheduler,
    lifecycle,
  }

  // Run setup hooks if provided
  if (config.setup?.beforeEach || config.setup?.afterEach) {
    lifecycle.setupHooks({
      beforeEach: config.setup.beforeEach ? () => config.setup!.beforeEach!(context) : undefined,
      afterEach: config.setup.afterEach ? () => config.setup!.afterEach!(context) : undefined,
    })
  }

  debugLog('Test harness created successfully')
  return context
}

/**
 * Setup Convex test with default configuration
 */
export function setupConvexTest<Schema extends GenericSchema = GenericSchema>(
  config?: ConvexTestConfig<Schema>,
): ConvexTestContext<Schema> {
  return createConvexTestHarness(config)
}
