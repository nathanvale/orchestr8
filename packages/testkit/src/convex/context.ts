/**
 * Convex test context and type definitions
 */

import type { TestConvex as ConvexTestInstance } from 'convex-test'
import type {
  GenericSchema,
  GenericDataModel,
  SchemaDefinition,
  DataModelFromSchemaDefinition,
  GenericMutationCtx,
  StorageActionWriter,
  UserIdentity,
} from 'convex/server'

// Re-export all the types from convex/server
export type {
  GenericSchema,
  GenericDataModel,
  SchemaDefinition,
  DataModelFromSchemaDefinition,
  GenericMutationCtx,
  StorageActionWriter,
  UserIdentity,
}

// Re-export TestConvex with proper type constraint
export type TestConvex<
  T extends SchemaDefinition<GenericSchema, boolean> = SchemaDefinition<GenericSchema, boolean>,
> = ConvexTestInstance<T>

// Types for Convex operations
export type FunctionReference<Type extends string = string, Args = unknown> = {
  _type: Type
  _args: Args
}
export type FunctionReturnType<T> = T extends FunctionReference<string, unknown> ? unknown : unknown
export type OptionalRestArgs<T> = T extends FunctionReference<string, infer Args> ? [Args] | [] : []

// Types imported from convex/server - no local redefinition needed

/**
 * Extended test context that provides additional utilities beyond the basic convex-test
 */
export interface ConvexTestContext<
  Schema extends GenericSchema = GenericSchema,
  DataModel extends GenericDataModel = DataModelFromSchemaDefinition<
    SchemaDefinition<Schema, boolean>
  >,
> {
  /** Core convex-test instance */
  readonly convex: TestConvex<SchemaDefinition<Schema, boolean>>

  /** Database operations context */
  readonly db: ConvexDatabaseContext<DataModel>

  /** Authentication mock utilities */
  readonly auth: ConvexAuthContext<Schema, DataModel>

  /** Storage mock utilities */
  readonly storage: ConvexStorageContext

  /** Scheduler mock utilities */
  readonly scheduler: ConvexSchedulerContext

  /** Test lifecycle management */
  readonly lifecycle: ConvexLifecycleContext
}

/**
 * Database operations context for testing
 */
export interface ConvexDatabaseContext<DataModel extends GenericDataModel> {
  /** Read/write operations through run context */
  run: <Output>(
    func: (
      ctx: GenericMutationCtx<DataModel> & { storage: StorageActionWriter },
    ) => Promise<Output>,
  ) => Promise<Output>

  /** Seed database with test data */
  seed: (seedFn: (ctx: GenericMutationCtx<DataModel>) => Promise<void>) => Promise<void>

  /** Clear all data from database */
  clear: () => Promise<void>

  /** Get all documents from a table */
  getAllDocuments: <TableName extends keyof DataModel>(
    tableName: TableName,
  ) => Promise<Array<DataModel[TableName]['document']>>

  /** Count documents in a table */
  countDocuments: <TableName extends keyof DataModel>(tableName: TableName) => Promise<number>
}

/**
 * Authentication context for testing
 */
export interface ConvexAuthContext<
  Schema extends GenericSchema,
  _DataModel extends GenericDataModel,
> {
  // Fluent API (Preferred - returns new context without modifying global state)
  /** Create authenticated test context */
  withUser: (identity: Partial<UserIdentity>) => TestConvex<SchemaDefinition<Schema, boolean>>

  /** Create anonymous test context */
  withoutAuth: () => TestConvex<SchemaDefinition<Schema, boolean>>

  /** Switch to different user mid-test */
  switchUser: (identity: Partial<UserIdentity>) => TestConvex<SchemaDefinition<Schema, boolean>>

  /** Switch to anonymous context */
  asAnonymous: () => TestConvex<SchemaDefinition<Schema, boolean>>

  /** Run function with authenticated context */
  withAuth: <T>(
    identity: Partial<UserIdentity>,
    fn: (ctx: TestConvex<SchemaDefinition<Schema, boolean>>) => Promise<T>,
  ) => Promise<T>

  /**
   * Get the last user identity set via metadata (does not reflect actual auth context).
   * This only returns metadata from setUser() and does NOT indicate which identity is
   * being used for actual Convex operations. Use the fluent API for real auth state.
   * @deprecated Use the fluent API instances for actual authentication state.
   */
  getCurrentUserMetadata: () => Partial<UserIdentity> | null

  /** Common test user factories */
  testUsers: {
    admin: () => Partial<UserIdentity>
    regular: () => Partial<UserIdentity>
    anonymous: () => null
  }
}

/**
 * Storage context for testing
 */
export interface ConvexStorageContext {
  /** Mock file upload */
  uploadFile: (name: string, content: ArrayBuffer | string) => Promise<string>

  /** Mock file retrieval */
  getFile: (storageId: string) => Promise<ArrayBuffer | null>

  /** Mock file deletion */
  deleteFile: (storageId: string) => Promise<void>

  /** List all stored files */
  listFiles: () => Promise<Array<{ id: string; name: string; size: number }>>

  /** Clear all stored files */
  clearFiles: () => Promise<void>
}

/**
 * Scheduler context for testing
 */
export interface ConvexSchedulerContext {
  /** Get pending scheduled functions */
  getPendingFunctions: () => Promise<Array<{ id: string; name: string; scheduledTime: number }>>

  /** Finish all in-progress scheduled functions */
  finishInProgress: () => Promise<void>

  /** Finish all scheduled functions (including newly scheduled ones) */
  finishAll: (advanceTimers?: () => void) => Promise<void>

  /** Helper to finish all scheduled functions with timer advancement */
  finishAllWithTimers: (timerFn: () => void) => Promise<void>

  /** Cancel all pending scheduled functions */
  cancelAll: () => Promise<void>

  /** Advance time and trigger scheduled functions */
  advanceTime: (ms: number) => Promise<void>
}

/**
 * Lifecycle management for test isolation
 */
export interface ConvexLifecycleContext {
  /** Reset all test state (db, storage, scheduler) */
  reset: () => Promise<void>

  /** Cleanup resources - pass advanceTimers to ensure scheduled functions complete */
  cleanup: (options?: { advanceTimers?: () => void }) => Promise<void>

  /** Setup hooks for test lifecycle */
  setupHooks: (hooks: {
    beforeEach?: () => Promise<void>
    afterEach?: () => Promise<void>
    beforeAll?: () => Promise<void>
    afterAll?: () => Promise<void>
  }) => void
}

/**
 * Configuration for Convex test setup
 */
export interface ConvexTestConfig<Schema extends GenericSchema = GenericSchema> {
  /** Schema definition */
  schema?: SchemaDefinition<Schema, boolean>

  /** Module map for functions */
  modules?: Record<string, () => Promise<unknown>>

  /** Default user for authenticated tests */
  defaultUser?: Partial<UserIdentity>

  /** Enable automatic cleanup between tests */
  autoCleanup?: boolean

  /** Enable debug logging */
  debug?: boolean

  /** Custom setup functions */
  setup?: {
    beforeEach?: (ctx: ConvexTestContext<Schema>) => Promise<void>
    afterEach?: (ctx: ConvexTestContext<Schema>) => Promise<void>
  }
}

/**
 * Factory function type for creating test data
 */
export type ConvexTestFactory<T = unknown> = () => T | Promise<T>

/**
 * Seed data configuration - simplified version without mapped types
 */
export interface ConvexSeedConfig {
  [tableName: string]:
    | Array<Record<string, unknown>>
    | ConvexTestFactory<Array<Record<string, unknown>>>
}

// Note: Query and Mutation helpers are planned for a future release.
// For now, use the convex instance methods directly.

// Note: Assertion helpers are planned for a future release.
// For now, use standard test matchers with the results from convex operations.

/**
 * Mutation execution result with side effect tracking
 */
export interface MutationResult<T> {
  /** The mutation result */
  result: T

  /** Side effects tracking */
  sideEffects: {
    /** Documents that were created */
    created: Array<{ table: string; id: string; document: unknown }>

    /** Documents that were updated */
    updated: Array<{ table: string; id: string; before: unknown; after: unknown }>

    /** Documents that were deleted */
    deleted: Array<{ table: string; id: string; document: unknown }>

    /** Functions that were scheduled */
    scheduled: Array<{ functionName: string; args: unknown; scheduledTime: number }>

    /** Storage operations */
    storage: Array<{ operation: 'upload' | 'delete'; fileId: string; fileName?: string }>
  }

  // Note: Assertion helpers are planned for a future release
}

/**
 * Error types for Convex testing
 */
export class ConvexTestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ConvexTestError'
  }
}

export class ConvexAuthError extends ConvexTestError {
  constructor(message: string, details?: unknown) {
    super(message, 'AUTH_ERROR', details)
  }
}

export class ConvexDataError extends ConvexTestError {
  constructor(message: string, details?: unknown) {
    super(message, 'DATA_ERROR', details)
  }
}

export class ConvexTestTimeoutError extends ConvexTestError {
  constructor(message: string, details?: unknown) {
    super(message, 'TIMEOUT_ERROR', details)
  }
}
