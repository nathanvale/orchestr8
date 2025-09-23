/**
 * Transaction utilities (adapter-based)
 */

export interface TransactionAdapter<TDb, TTx> {
  begin(db: TDb): Promise<TTx>
  commit(tx: TTx): Promise<void>
  rollback(tx: TTx): Promise<void>
}

export async function withTransaction<T, TDb, TTx>(
  db: TDb,
  adapter: TransactionAdapter<TDb, TTx>,
  fn: (tx: TTx) => Promise<T>,
): Promise<T> {
  const tx = await adapter.begin(db)
  try {
    const result = await fn(tx)
    await adapter.commit(tx)
    return result
  } catch (err) {
    await Promise.resolve(adapter.rollback(tx)).catch(() => {})
    throw err
  }
}
