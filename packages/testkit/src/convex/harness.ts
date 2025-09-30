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
  // Default to empty modules object to prevent _generated directory scan
  // For smoke tests, we explicitly pass empty modules to match the pattern that works
  const modules = config.modules ?? ({} as Record<string, () => Promise<unknown>>)

  // Match the pattern from working examples: convexTest(undefined as any, {} as any)
  // When no schema is provided, we pass undefined explicitly
  const convexTestSchema = config.schema || (undefined as unknown)

  const state: TestHarnessState<Schema> = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    convexInstance: convexTest(convexTestSchema as any, modules as any) as ConvexTestInstance<
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
      // Default to empty modules to prevent _generated directory scan
      const resetModules = config.modules ?? ({} as Record<string, () => Promise<unknown>>)
      const resetSchema = config.schema || (undefined as unknown)

      state.convexInstance = convexTest(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resetSchema as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resetModules as any,
      ) as ConvexTestInstance<SchemaDefinition<Schema, boolean>>
      // Storage is cleared when convex instance is recreated
    },

    async getAllDocuments(tableName) {
      debugLog('getAllDocuments called for table', tableName)
      throw new ConvexTestError(
        `getAllDocuments is not implemented. Use t.run(ctx => ctx.db.query('${String(tableName)}').collect()) instead`,
        'NOT_IMPLEMENTED',
      )
    },

    async countDocuments(tableName) {
      debugLog('countDocuments called for table', tableName)
      throw new ConvexTestError(
        `countDocuments is not implemented. Use t.run(ctx => ctx.db.query('${String(tableName)}').collect().then(docs => docs.length)) instead`,
        'NOT_IMPLEMENTED',
      )
    },
  }

  // Authentication context implementation with chainable API
  const auth: ConvexAuthContext<
    Schema,
    DataModelFromSchemaDefinition<SchemaDefinition<Schema, boolean>>
  > = {
    /**
     * Returns a Convex instance with the specified user identity for making authenticated calls.
     * This is the fluent API that directly affects subsequent convex operations.
     *
     * @example
     * const asUser = harness.auth.withUser({ subject: 'user123' })
     * await asUser.query(api.messages.list) // Will execute with user123 identity
     */
    withUser(identity) {
      debugLog('Setting user identity', identity)
      state.currentUser = identity
      // Cast the return type to match the expected interface
      return state.convexInstance.withIdentity(
        identity as UserIdentity,
      ) as unknown as ConvexTestInstance<SchemaDefinition<Schema, boolean>>
    },

    /**
     * Returns a Convex instance without authentication for making anonymous calls.
     * This is the fluent API that directly affects subsequent convex operations.
     *
     * @example
     * const anon = harness.auth.withoutAuth()
     * await anon.query(api.public.list) // Will execute without identity
     */
    withoutAuth() {
      debugLog('Removing user identity')
      state.currentUser = null
      // Return anonymous context for chaining
      return state.convexInstance as unknown as ConvexTestInstance<
        SchemaDefinition<Schema, boolean>
      >
    },

    /**
     * Switches to a different user identity and returns the authenticated instance.
     * This is the fluent API that directly affects subsequent convex operations.
     *
     * @example
     * const asNewUser = harness.auth.switchUser({ subject: 'user456' })
     * await asNewUser.mutation(api.messages.create, { text: 'Hello' })
     */
    switchUser(identity) {
      debugLog('Switching user identity', identity)
      state.currentUser = identity
      // Return a new context with switched identity
      return state.convexInstance.withIdentity(
        identity as UserIdentity,
      ) as unknown as ConvexTestInstance<SchemaDefinition<Schema, boolean>>
    },

    /**
     * Returns an anonymous Convex instance for making unauthenticated calls.
     * This is the fluent API that directly affects subsequent convex operations.
     *
     * @example
     * const anon = harness.auth.asAnonymous()
     * await anon.query(api.public.data) // Will execute anonymously
     */
    asAnonymous() {
      debugLog('Switching to anonymous context')
      state.currentUser = null
      return state.convexInstance as unknown as ConvexTestInstance<
        SchemaDefinition<Schema, boolean>
      >
    },

    /**
     * Get the last user identity set via metadata (does not reflect actual auth context).
     * This only returns metadata from setUser() and does NOT indicate which identity is
     * being used for actual Convex operations. Use the fluent API for real auth state.
     * @deprecated Use the fluent API instances for actual authentication state.
     */
    getCurrentUserMetadata() {
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

      // Use convex-test's storage context via run
      return state.convexInstance.run(async (ctx) => {
        // Normalize to Uint8Array for all binary inputs
        // This avoids SharedArrayBuffer vs ArrayBuffer pitfalls and Node/browser differences
        const bytes =
          typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content)

        // Use ctx.storage for proper integration with convex-test
        // Pass the Uint8Array directly to Blob - it's a BufferSource
        const blob = new Blob([bytes])
        const storageId = await ctx.storage.store(blob)
        debugLog('File uploaded via convex-test', { storageId, name, size: bytes.byteLength })
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

  // Scheduler context implementation with proper timer advancing
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
      // The convex-test library requires a function for timer advancement
      // This allows tests to explicitly control timer behavior:
      // - Pass vi.runAllTimers to advance all timers
      // - Pass () => vi.advanceTimersByTime(ms) for specific advancement
      // - Pass undefined/no-op to let functions complete without timer advancement
      return state.convexInstance.finishAllScheduledFunctions(advanceTimers ?? (() => {}))
    },

    async finishAllWithTimers(timerFn) {
      debugLog('Finishing all scheduled functions with timer advancement')
      // Convenience helper that always advances timers
      return state.convexInstance.finishAllScheduledFunctions(timerFn)
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
      // Default to empty modules to prevent _generated directory scan
      const resetModules = originalConfig.modules ?? ({} as Record<string, () => Promise<unknown>>)
      const resetSchema = originalConfig.schema || (undefined as unknown)

      state.convexInstance = convexTest(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resetSchema as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resetModules as any,
      ) as ConvexTestInstance<SchemaDefinition<Schema, boolean>>
      // Storage is cleared when convex instance is recreated
      state.currentUser = originalConfig.defaultUser || null
      state.isCleanedUp = false
      debugLog('Reset complete - test harness in clean state')
    },

    async cleanup(options?: { advanceTimers?: () => void }) {
      debugLog('Cleaning up test harness')
      // Storage is handled by convex-test instance
      state.currentUser = null
      state.isCleanedUp = true

      // Clear any pending scheduled functions with proper timer advancement
      try {
        // Check if fake timers are being used
        const isFakeTimers = typeof vi !== 'undefined' && vi.isFakeTimers?.()

        // In CI or when fake timers are detected, require advanceTimers
        if (isFakeTimers && !options?.advanceTimers) {
          const isCI = process.env.CI === 'true' || process.env.CI === '1'
          const message =
            'Cleanup detected fake timers without advanceTimers function. ' +
            'Pass advanceTimers option to cleanup() to ensure scheduled functions complete. ' +
            'Example: await cleanup({ advanceTimers: vi.runAllTimers })'

          if (isCI) {
            // Hard fail in CI
            throw new ConvexTestError(message, 'CLEANUP_ERROR')
          } else {
            // Warn locally but continue
            console.warn(`⚠️ [ConvexTestHarness] ${message}`)
          }
        }

        await state.convexInstance.finishAllScheduledFunctions(options?.advanceTimers ?? (() => {}))
      } catch (error) {
        // Log the error but don't throw during cleanup unless it's critical
        debugLog('Error during cleanup of scheduled functions:', error)
        // If there are pending scheduled functions, throw a more helpful error
        if (String(error).includes('pending') || String(error).includes('scheduled')) {
          throw new ConvexTestError(
            'Cleanup failed: Scheduled functions are still pending. ' +
              'Pass advanceTimers option to cleanup() or use vi.runAllTimers() before cleanup. ' +
              'Example: await cleanup({ advanceTimers: vi.runAllTimers })',
            'CLEANUP_ERROR',
            { originalError: error },
          )
        }
        // Re-throw if it's our own error from above
        if (error instanceof ConvexTestError) {
          throw error
        }
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
