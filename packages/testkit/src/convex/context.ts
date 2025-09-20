/**
 * Convex test context and type definitions
 */

// Base types for Convex testing
export type GenericDataModel = Record<string, { document: Record<string, any> }>
export type GenericSchema = Record<string, any>
export type SchemaDefinition<T = any> = T
export type DataModelFromSchemaDefinition<T> =
  T extends SchemaDefinition<infer U> ? U : GenericDataModel
export type FunctionReference<T = any, U = any> = { _type: T; _args: U }
export type FunctionReturnType<T> = T extends FunctionReference<any, infer U> ? U : any
export type OptionalRestArgs<T> = T extends FunctionReference<any, infer U> ? [U] | [] : []
export type GenericMutationCtx<_DataModel = GenericDataModel> = {
  db: {
    insert: (table: string, doc: unknown) => Promise<string>
    get: (id: string) => Promise<unknown>
  }
}
export type StorageActionWriter = {
  store: (blob: ArrayBuffer) => Promise<string>
  delete: (id: string) => Promise<void>
}
export type UserIdentity = {
  subject: string
  issuer?: string
  tokenIdentifier?: string
  [key: string]: any
}

// TestConvex type from convex-test
export type TestConvex<T = any> = {
  query: <Q extends FunctionReference<'query', any>>(
    query: Q,
    ...args: OptionalRestArgs<Q>
  ) => Promise<FunctionReturnType<Q>>
  mutation: <M extends FunctionReference<'mutation', any>>(
    mutation: M,
    ...args: OptionalRestArgs<M>
  ) => Promise<FunctionReturnType<M>>
  action: <A extends FunctionReference<'action', any>>(
    action: A,
    ...args: OptionalRestArgs<A>
  ) => Promise<FunctionReturnType<A>>
  run: <Output>(
    func: (ctx: GenericMutationCtx<any> & { storage: StorageActionWriter }) => Promise<Output>,
  ) => Promise<Output>
  withIdentity: (identity: Partial<UserIdentity>) => TestConvex<T>
  finishInProgressScheduledFunctions: () => Promise<void>
  finishAllScheduledFunctions: (advanceTimers: () => void) => Promise<void>
}

/**
 * Extended test context that provides additional utilities beyond the basic convex-test
 */
export interface ConvexTestContext<
  Schema extends GenericSchema = GenericSchema,
  DataModel extends GenericDataModel = DataModelFromSchemaDefinition<SchemaDefinition<Schema>>,
> {
  /** Core convex-test instance */
  readonly convex: TestConvex<SchemaDefinition<Schema>>

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
  /** Create authenticated test context */
  withUser: (identity: Partial<UserIdentity>) => TestConvex<SchemaDefinition<Schema>>

  /** Create anonymous test context */
  withoutAuth: () => TestConvex<SchemaDefinition<Schema>>

  /** Switch to different user mid-test */
  switchUser: (identity: Partial<UserIdentity>) => TestConvex<SchemaDefinition<Schema>>

  /** Current user identity */
  getCurrentUser: () => Partial<UserIdentity> | null

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
  finishAll: (advanceTimers: () => void) => Promise<void>

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

  /** Cleanup resources */
  cleanup: () => Promise<void>

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
  schema?: SchemaDefinition<Schema>

  /** Module map for functions */
  modules?: Record<string, () => Promise<any>>

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
export type ConvexTestFactory<T = any> = () => T | Promise<T>

/**
 * Seed data configuration - simplified version without mapped types
 */
export interface ConvexSeedConfig {
  [tableName: string]: Array<Record<string, any>> | ConvexTestFactory<Array<Record<string, any>>>
}

/**
 * Query test helpers
 */
export interface ConvexQueryHelpers<_Schema extends GenericSchema> {
  /** Execute query and assert result */
  expectQuery: <Query extends FunctionReference<'query', any>>(
    query: Query,
    ...args: OptionalRestArgs<Query>
  ) => Promise<QueryAssertion<FunctionReturnType<Query>>>

  /** Execute multiple queries in parallel */
  executeQueries: <
    Queries extends Record<string, { query: FunctionReference<'query', any>; args: any[] }>,
  >(
    queries: Queries,
  ) => Promise<{ [K in keyof Queries]: FunctionReturnType<Queries[K]['query']> }>
}

/**
 * Mutation test helpers
 */
export interface ConvexMutationHelpers<_Schema extends GenericSchema> {
  /** Execute mutation and assert result */
  expectMutation: <Mutation extends FunctionReference<'mutation', any>>(
    mutation: Mutation,
    ...args: OptionalRestArgs<Mutation>
  ) => Promise<MutationAssertion<FunctionReturnType<Mutation>>>

  /** Execute mutation and verify side effects */
  executeMutation: <Mutation extends FunctionReference<'mutation', any>>(
    mutation: Mutation,
    ...args: OptionalRestArgs<Mutation>
  ) => Promise<MutationResult<FunctionReturnType<Mutation>>>
}

/**
 * Query assertion utilities
 */
export interface QueryAssertion<T> {
  /** The query result */
  result: T

  /** Assert the result matches expected value */
  toEqual: (expected: T) => void

  /** Assert the result matches partial value */
  toMatchObject: (expected: Partial<T>) => void

  /** Assert the result satisfies condition */
  toSatisfy: (predicate: (result: T) => boolean) => void

  /** Assert query completed within time limit */
  toCompleteWithin: (ms: number) => void
}

/**
 * Mutation assertion utilities
 */
export interface MutationAssertion<T> extends QueryAssertion<T> {
  /** Assert mutation invalidated specific queries */
  toInvalidateQueries: (queryNames: string[]) => void

  /** Assert mutation triggered scheduled functions */
  toScheduleFunctions: (functionNames: string[]) => void

  /** Assert mutation created/updated/deleted documents */
  toModifyDocuments: (changes: { created?: number; updated?: number; deleted?: number }) => void
}

/**
 * Mutation execution result with side effect tracking
 */
export interface MutationResult<T> {
  /** The mutation result */
  result: T

  /** Side effects tracking */
  sideEffects: {
    /** Documents that were created */
    created: Array<{ table: string; id: string; document: any }>

    /** Documents that were updated */
    updated: Array<{ table: string; id: string; before: any; after: any }>

    /** Documents that were deleted */
    deleted: Array<{ table: string; id: string; document: any }>

    /** Functions that were scheduled */
    scheduled: Array<{ functionName: string; args: any; scheduledTime: number }>

    /** Storage operations */
    storage: Array<{ operation: 'upload' | 'delete'; fileId: string; fileName?: string }>
  }

  /** Get assertion helpers */
  expect: () => MutationAssertion<T>
}

/**
 * Error types for Convex testing
 */
export class ConvexTestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any,
  ) {
    super(message)
    this.name = 'ConvexTestError'
  }
}

export class ConvexAuthError extends ConvexTestError {
  constructor(message: string, details?: any) {
    super(message, 'AUTH_ERROR', details)
  }
}

export class ConvexDataError extends ConvexTestError {
  constructor(message: string, details?: any) {
    super(message, 'DATA_ERROR', details)
  }
}

export class ConvexTestTimeoutError extends ConvexTestError {
  constructor(message: string, details?: any) {
    super(message, 'TIMEOUT_ERROR', details)
  }
}
