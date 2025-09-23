/**
 * SQL-first migration runner (stub for Phase 3)
 */

export interface MigrationOptions {
  dir: string
  glob?: string
}

export async function applyMigrations<TDb>(_db: TDb, _options: MigrationOptions): Promise<void> {
  // Stub: implemented in Phase 3
}
