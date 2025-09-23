/**
 * Recommended pragmas helper (Phase 2 adapter will execute these)
 */

export interface AppliedPragmas {
  journal_mode?: string
  foreign_keys?: 'on' | 'off'
  busy_timeout?: number
}

export interface PragmasOptions {
  busyTimeoutMs?: number
  // future: adapter flags
}

export async function applyRecommendedPragmas<TDb>(
  _db: TDb,
  _opts: PragmasOptions = {},
): Promise<AppliedPragmas> {
  // Placeholder: real execution requires a driver adapter (Phase 2)
  // Return defaults so tests can assert shape without a driver
  const busyTimeoutMs = _opts.busyTimeoutMs ?? 2000
  return {
    journal_mode: 'wal',
    foreign_keys: 'on',
    busy_timeout: busyTimeoutMs,
  }
}
