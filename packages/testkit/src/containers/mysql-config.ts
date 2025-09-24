/**
 * MySQL-specific configuration interfaces and utilities
 */

import type { BaseDatabaseConfig, DatabaseExtensions, PoolConfig } from './types.js'

/**
 * MySQL SQL modes for controlling server behavior
 */
export enum MySQLSQLMode {
  /** Default mode with basic error checking */
  TRADITIONAL = 'TRADITIONAL',
  /** Strict mode with comprehensive error checking */
  STRICT_TRANS_TABLES = 'STRICT_TRANS_TABLES',
  /** All strict modes enabled */
  STRICT_ALL_TABLES = 'STRICT_ALL_TABLES',
  /** Disable zero dates */
  NO_ZERO_DATE = 'NO_ZERO_DATE',
  /** Disable zero in dates */
  NO_ZERO_IN_DATE = 'NO_ZERO_IN_DATE',
  /** ANSI SQL mode */
  ANSI = 'ANSI',
  /** Enable all error checks */
  ERROR_FOR_DIVISION_BY_ZERO = 'ERROR_FOR_DIVISION_BY_ZERO',
  /** No auto-creation of users */
  NO_AUTO_CREATE_USER = 'NO_AUTO_CREATE_USER',
  /** Require explicit engine selection */
  NO_ENGINE_SUBSTITUTION = 'NO_ENGINE_SUBSTITUTION',
}

/**
 * MySQL character sets supported
 */
export enum MySQLCharacterSet {
  /** UTF-8 encoding (3-byte) */
  UTF8 = 'utf8',
  /** UTF-8 encoding (4-byte) - recommended for full Unicode support */
  UTF8MB4 = 'utf8mb4',
  /** Latin-1 encoding */
  LATIN1 = 'latin1',
  /** ASCII encoding */
  ASCII = 'ascii',
}

/**
 * MySQL collations for different character sets
 */
export enum MySQLCollation {
  /** UTF8MB4 general case-insensitive */
  UTF8MB4_GENERAL_CI = 'utf8mb4_general_ci',
  /** UTF8MB4 Unicode case-insensitive */
  UTF8MB4_UNICODE_CI = 'utf8mb4_unicode_ci',
  /** UTF8MB4 binary */
  UTF8MB4_BIN = 'utf8mb4_bin',
  /** UTF8 general case-insensitive */
  UTF8_GENERAL_CI = 'utf8_general_ci',
  /** UTF8 Unicode case-insensitive */
  UTF8_UNICODE_CI = 'utf8_unicode_ci',
  /** UTF8 binary */
  UTF8_BIN = 'utf8_bin',
  /** Latin1 general case-insensitive */
  LATIN1_GENERAL_CI = 'latin1_general_ci',
  /** Latin1 binary */
  LATIN1_BIN = 'latin1_bin',
}

/**
 * MySQL storage engines
 */
export enum MySQLStorageEngine {
  /** InnoDB storage engine (default, ACID-compliant) */
  INNODB = 'InnoDB',
  /** MyISAM storage engine (fast, non-transactional) */
  MYISAM = 'MyISAM',
  /** Memory storage engine (temporary tables in RAM) */
  MEMORY = 'MEMORY',
  /** Archive storage engine (compressed storage) */
  ARCHIVE = 'ARCHIVE',
}

/**
 * MySQL connection configuration options
 */
export interface MySQLConnectionOptions {
  /** Character set for the connection */
  characterSet?: MySQLCharacterSet
  /** Collation for the connection */
  collation?: MySQLCollation
  /** Connection timeout in milliseconds */
  connectTimeout?: number
  /** Socket timeout in milliseconds */
  socketTimeout?: number
  /** Enable SSL connection */
  ssl?: boolean | Record<string, unknown>
  /** MySQL connection flags */
  flags?: string[]
  /** Timezone for the connection */
  timezone?: string
  /** Enable multiple statements */
  multipleStatements?: boolean
  /** Date strings instead of Date objects */
  dateStrings?: boolean | string[]
  /** Enable debug output */
  debug?: boolean
  /** Trace function calls */
  trace?: boolean
  /** Maximum allowed packet size */
  maxPacketSize?: number
}

/**
 * MySQL replication configuration
 */
export interface MySQLReplicationConfig {
  /** Enable replication setup */
  enabled: boolean
  /** Number of replica instances */
  replicas?: number
  /** Replication mode */
  mode?: 'async' | 'semi-sync'
  /** Custom replication options */
  options?: Record<string, unknown>
}

/**
 * MySQL performance configuration
 */
export interface MySQLPerformanceConfig {
  /** Enable slow query log */
  enableSlowQueryLog?: boolean
  /** Slow query time threshold in seconds */
  slowQueryTimeThreshold?: number
  /** Query cache size (0 to disable) */
  queryCacheSize?: number
  /** Query cache type */
  queryCacheType?: 'OFF' | 'ON' | 'DEMAND'
  /** InnoDB buffer pool size */
  innodbBufferPoolSize?: string
  /** Maximum connections */
  maxConnections?: number
  /** Maximum user connections */
  maxUserConnections?: number
  /** Connection timeout */
  connectTimeout?: number
  /** Interactive timeout */
  interactiveTimeout?: number
  /** Wait timeout */
  waitTimeout?: number
}

/**
 * MySQL-specific database configuration
 */
export interface MySQLDatabaseConfig extends BaseDatabaseConfig, DatabaseExtensions {
  /** MySQL version tag (defaults to '8.0') */
  version?: string
  /** Root password for MySQL (separate from user password) */
  rootPassword?: string
  /** SQL modes to enable */
  sqlModes?: MySQLSQLMode[]
  /** Default character set */
  characterSet?: MySQLCharacterSet
  /** Default collation */
  collation?: MySQLCollation
  /** Default storage engine */
  defaultStorageEngine?: MySQLStorageEngine
  /** Connection-specific options */
  connectionOptions?: MySQLConnectionOptions
  /** Replication configuration */
  replication?: MySQLReplicationConfig
  /** Performance tuning options */
  performance?: MySQLPerformanceConfig
  /** Custom MySQL configuration file content */
  mysqlConfigFile?: string
  /** Additional MySQL command-line arguments */
  mysqlArgs?: string[]
  /** Timezone setting */
  timezone?: string
  /** Enable binary logging */
  enableBinLog?: boolean
  /** Server ID for replication */
  serverId?: number
  /** Connection pool configuration */
  poolConfig?: PoolConfig
}

/**
 * Default MySQL configuration factory
 */
export function createMySQLConfig(
  overrides: Partial<MySQLDatabaseConfig> = {},
): MySQLDatabaseConfig {
  return {
    image: `mysql:${overrides.version || '8.0'}`,
    database: 'test_db',
    username: 'test_user',
    password: 'test_password',
    rootPassword: 'root_password',
    startupTimeout: 45000, // MySQL typically takes longer to start than Postgres
    reusable: false,
    environment: {},
    initScripts: [],

    // MySQL-specific defaults
    sqlModes: [MySQLSQLMode.STRICT_TRANS_TABLES, MySQLSQLMode.NO_ZERO_DATE],
    characterSet: MySQLCharacterSet.UTF8MB4,
    collation: MySQLCollation.UTF8MB4_UNICODE_CI,
    defaultStorageEngine: MySQLStorageEngine.INNODB,
    timezone: 'UTC',

    connectionOptions: {
      characterSet: MySQLCharacterSet.UTF8MB4,
      collation: MySQLCollation.UTF8MB4_UNICODE_CI,
      connectTimeout: 10000,
      socketTimeout: 30000,
      multipleStatements: true,
      dateStrings: false,
      timezone: 'UTC',
    },

    performance: {
      enableSlowQueryLog: false,
      slowQueryTimeThreshold: 1.0,
      queryCacheSize: 0, // Disabled by default in MySQL 8.0
      queryCacheType: 'OFF',
      maxConnections: 151,
      maxUserConnections: 0,
      connectTimeout: 10,
      interactiveTimeout: 28800,
      waitTimeout: 28800,
    },

    replication: {
      enabled: false,
      replicas: 1,
      mode: 'async',
    },

    ...overrides,
  }
}

/**
 * Helper to create MySQL configuration for specific use cases
 */
export const MySQLPresets = {
  /**
   * Basic testing configuration with minimal resource usage
   */
  testing: (): MySQLDatabaseConfig =>
    createMySQLConfig({
      performance: {
        maxConnections: 50,
        innodbBufferPoolSize: '64M',
        queryCacheSize: 0,
        enableSlowQueryLog: false,
      },
      sqlModes: [MySQLSQLMode.STRICT_TRANS_TABLES],
    }),

  /**
   * Development configuration with debugging enabled
   */
  development: (): MySQLDatabaseConfig =>
    createMySQLConfig({
      performance: {
        enableSlowQueryLog: true,
        slowQueryTimeThreshold: 0.1,
        maxConnections: 100,
      },
      connectionOptions: {
        debug: false, // Keep false to avoid noise in tests
        trace: false,
      },
    }),

  /**
   * Performance testing configuration with realistic settings
   */
  performance: (): MySQLDatabaseConfig =>
    createMySQLConfig({
      performance: {
        maxConnections: 200,
        innodbBufferPoolSize: '256M',
        enableSlowQueryLog: true,
        slowQueryTimeThreshold: 0.5,
      },
      sqlModes: [
        MySQLSQLMode.STRICT_TRANS_TABLES,
        MySQLSQLMode.NO_ZERO_DATE,
        MySQLSQLMode.ERROR_FOR_DIVISION_BY_ZERO,
      ],
    }),

  /**
   * Replication testing configuration
   */
  replication: (): MySQLDatabaseConfig =>
    createMySQLConfig({
      replication: {
        enabled: true,
        replicas: 2,
        mode: 'async',
      },
      enableBinLog: true,
      serverId: 1,
    }),

  /**
   * Legacy compatibility configuration (MySQL 5.7 style)
   */
  legacy: (): MySQLDatabaseConfig =>
    createMySQLConfig({
      version: '5.7',
      sqlModes: [MySQLSQLMode.TRADITIONAL],
      characterSet: MySQLCharacterSet.UTF8,
      collation: MySQLCollation.UTF8_GENERAL_CI,
      performance: {
        queryCacheSize: 16777216, // 16MB - enabled in 5.7
        queryCacheType: 'ON',
      },
    }),
}
