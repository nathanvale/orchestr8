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
      // Storage is cleared when convex instance is recreated
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
      // Cast the return type to match the expected interface
      return state.convexInstance.withIdentity(
        identity as UserIdentity,
      ) as unknown as ConvexTestInstance<SchemaDefinition<Schema, boolean>>
    },

    withoutAuth() {
      debugLog('Removing user identity')
      state.currentUser = null
      // Return anonymous context for chaining
      return state.convexInstance as unknown as ConvexTestInstance<
        SchemaDefinition<Schema, boolean>
      >
    },

    switchUser(identity) {
      debugLog('Switching user identity', identity)
      state.currentUser = identity
      // Return a new context with switched identity
      return state.convexInstance.withIdentity(
        identity as UserIdentity,
      ) as unknown as ConvexTestInstance<SchemaDefinition<Schema, boolean>>
    },

    asAnonymous() {
      debugLog('Switching to anonymous context')
      state.currentUser = null
      return state.convexInstance as unknown as ConvexTestInstance<
        SchemaDefinition<Schema, boolean>
      >
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

  // Storage context implementation using convex-test's storage via t.run
  const storage: ConvexStorageContext = {
    async uploadFile(name, content) {
      debugLog('Uploading file', { name })
      const buffer = typeof content === 'string' ? Buffer.from(content) : content

      // Use convex-test's storage context via run
      return state.convexInstance.run(async (ctx) => {
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

        // Use ctx.storage for proper integration with convex-test
        const blob = new Blob([arrayBuffer])
        const storageId = await ctx.storage.store(blob)
        debugLog('File uploaded via convex-test', { storageId, name, size: arrayBuffer.byteLength })
        return storageId
      })
    },

    async getFile(storageId) {
      debugLog('Getting file', { storageId })
      // Use convex-test's storage context via run
      return state.convexInstance.run(async (ctx) => {
        const blob = await ctx.storage.get(storageId)
        if (!blob) return null
        const arrayBuffer = await blob.arrayBuffer()
        return arrayBuffer
      })
    },

    async deleteFile(storageId) {
      debugLog('Deleting file', { storageId })
      // Use convex-test's storage context via run
      return state.convexInstance.run(async (ctx) => {
        await ctx.storage.delete(storageId)
      })
    },

    async listFiles() {
      debugLog('listFiles called')
      // Convex-test doesn't provide a way to list all stored files
      throw new ConvexTestError(
        'listFiles not implemented. Convex-test does not expose storage listing functionality',
        'NOT_IMPLEMENTED',
      )
    },

    async clearFiles() {
      debugLog('clearFiles called')
      // Convex-test doesn't provide a way to clear all files
      throw new ConvexTestError(
        'clearFiles not implemented. Files are cleared when test harness is reset',
        'NOT_IMPLEMENTED',
      )
    },
  }

  // Scheduler context implementation
  const scheduler: ConvexSchedulerContext = {
    async getPendingFunctions() {
      debugLog('getPendingFunctions called')
      throw new ConvexTestError(
        'getPendingFunctions not implemented. Convex-test does not expose internal scheduler state',
        'NOT_IMPLEMENTED',
      )
    },

    async finishInProgress() {
      debugLog('Finishing in-progress scheduled functions')
      return state.convexInstance.finishInProgressScheduledFunctions()
    },

    async finishAll(advanceTimers) {
      debugLog('Finishing all scheduled functions')
      // The convex-test library requires a function, so provide a no-op if not specified
      return state.convexInstance.finishAllScheduledFunctions(advanceTimers ?? (() => {}))
    },

    async cancelAll() {
      debugLog('cancelAll called')
      throw new ConvexTestError(
        'cancelAll not implemented. Use finishAll() or let functions complete naturally',
        'NOT_IMPLEMENTED',
      )
    },

    async advanceTime(ms) {
      debugLog('advanceTime called', { ms })
      throw new ConvexTestError(
        'advanceTime not implemented. Use vi.advanceTimersByTime() directly with finishAll()',
        'NOT_IMPLEMENTED',
        { ms },
      )
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
      // Storage is cleared when convex instance is recreated
      state.currentUser = originalConfig.defaultUser || null
      state.isCleanedUp = false
      debugLog('Reset complete - test harness in clean state')
    },

    async cleanup() {
      debugLog('Cleaning up test harness')
      // Storage is handled by convex-test instance
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
