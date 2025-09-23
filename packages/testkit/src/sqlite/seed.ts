/**
 * SQL seed helpers (stub for Phase 3)
 */

export async function seedWithSql<TDb>(_db: TDb, _sql: string): Promise<void> {
  // Stub: implemented in Phase 3
}

export interface SeedFilesOptions {
  dir: string
}

export async function seedWithFiles<TDb>(_db: TDb, _opts: SeedFilesOptions): Promise<void> {
  // Stub: implemented in Phase 3
}
