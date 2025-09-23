import { describe, it, expect, vi } from 'vitest'
import { withTransaction, type TransactionAdapter } from '../txn'

describe('SQLite Transaction Utilities', () => {
  describe('TransactionAdapter interface', () => {
    it('should define the required adapter shape', () => {
      const adapter: TransactionAdapter<any, any> = {
        begin: vi.fn(),
        commit: vi.fn(),
        rollback: vi.fn(),
      }

      expect(adapter.begin).toBeDefined()
      expect(adapter.commit).toBeDefined()
      expect(adapter.rollback).toBeDefined()
    })
  })

  describe('withTransaction', () => {
    it('should execute transaction successfully with commit', async () => {
      // Create a fake database and transaction
      const fakeDb = { id: 'db' }
      const fakeTx = { id: 'tx' }

      // Create a mock adapter
      const adapter: TransactionAdapter<typeof fakeDb, typeof fakeTx> = {
        begin: vi.fn().mockResolvedValue(fakeTx),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
      }

      // Execute a successful transaction
      const result = await withTransaction(fakeDb, adapter, async (tx) => {
        expect(tx).toBe(fakeTx)
        return 'success'
      })

      // Verify the result
      expect(result).toBe('success')

      // Verify adapter methods were called correctly
      expect(adapter.begin).toHaveBeenCalledWith(fakeDb)
      expect(adapter.begin).toHaveBeenCalledTimes(1)

      expect(adapter.commit).toHaveBeenCalledWith(fakeTx)
      expect(adapter.commit).toHaveBeenCalledTimes(1)

      expect(adapter.rollback).not.toHaveBeenCalled()
    })

    it('should rollback transaction on error', async () => {
      const fakeDb = { id: 'db' }
      const fakeTx = { id: 'tx' }
      const testError = new Error('Transaction failed')

      const adapter: TransactionAdapter<typeof fakeDb, typeof fakeTx> = {
        begin: vi.fn().mockResolvedValue(fakeTx),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
      }

      // Execute a failing transaction
      await expect(
        withTransaction(fakeDb, adapter, async () => {
          throw testError
        }),
      ).rejects.toThrow(testError)

      // Verify rollback was called
      expect(adapter.begin).toHaveBeenCalledWith(fakeDb)
      expect(adapter.rollback).toHaveBeenCalledWith(fakeTx)
      expect(adapter.commit).not.toHaveBeenCalled()
    })

    it('should handle rollback failure gracefully', async () => {
      const fakeDb = { id: 'db' }
      const fakeTx = { id: 'tx' }
      const originalError = new Error('Transaction failed')
      const rollbackError = new Error('Rollback failed')

      const adapter: TransactionAdapter<typeof fakeDb, typeof fakeTx> = {
        begin: vi.fn().mockResolvedValue(fakeTx),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockRejectedValue(rollbackError),
      }

      // Execute a failing transaction with failing rollback
      await expect(
        withTransaction(fakeDb, adapter, async () => {
          throw originalError
        }),
      ).rejects.toThrow(originalError) // Should throw original error, not rollback error

      expect(adapter.rollback).toHaveBeenCalledWith(fakeTx)
    })

    it('should pass transaction to callback function', async () => {
      const fakeDb = { id: 'db', data: [] as Array<string> }
      const fakeTx = { id: 'tx', tempData: [] as Array<string> }

      const adapter: TransactionAdapter<typeof fakeDb, typeof fakeTx> = {
        begin: vi.fn().mockResolvedValue(fakeTx),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
      }

      const result = await withTransaction(fakeDb, adapter, async (tx) => {
        // Simulate database operations
        tx.tempData.push('item1')
        tx.tempData.push('item2')
        return tx.tempData.length
      })

      expect(result).toBe(2)
      expect(adapter.commit).toHaveBeenCalled()
    })

    it('should handle async operations in transaction', async () => {
      const fakeDb = { id: 'db' }
      const fakeTx = { id: 'tx' }

      const adapter: TransactionAdapter<typeof fakeDb, typeof fakeTx> = {
        begin: vi.fn().mockResolvedValue(fakeTx),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
      }

      const result = await withTransaction(fakeDb, adapter, async () => {
        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'async-result'
      })

      expect(result).toBe('async-result')
      expect(adapter.commit).toHaveBeenCalled()
    })

    it('should maintain transaction isolation', async () => {
      const db1 = { id: 'db1' }
      const db2 = { id: 'db2' }
      const tx1 = { id: 'tx1' }
      const tx2 = { id: 'tx2' }

      const adapter1: TransactionAdapter<typeof db1, typeof tx1> = {
        begin: vi.fn().mockResolvedValue(tx1),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
      }

      const adapter2: TransactionAdapter<typeof db2, typeof tx2> = {
        begin: vi.fn().mockResolvedValue(tx2),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
      }

      // Run two transactions in parallel
      const [result1, result2] = await Promise.all([
        withTransaction(db1, adapter1, async (tx) => {
          expect(tx).toBe(tx1)
          return 'result1'
        }),
        withTransaction(db2, adapter2, async (tx) => {
          expect(tx).toBe(tx2)
          return 'result2'
        }),
      ])

      expect(result1).toBe('result1')
      expect(result2).toBe('result2')

      // Each adapter should have been used independently
      expect(adapter1.begin).toHaveBeenCalledWith(db1)
      expect(adapter1.commit).toHaveBeenCalledWith(tx1)

      expect(adapter2.begin).toHaveBeenCalledWith(db2)
      expect(adapter2.commit).toHaveBeenCalledWith(tx2)
    })

    describe('adapter patterns', () => {
      it('should support a mock adapter for testing', async () => {
        // Example of creating a test adapter
        class MockAdapter<T> implements TransactionAdapter<Map<string, T>, Map<string, T>> {
          async begin(db: Map<string, T>): Promise<Map<string, T>> {
            // Create a copy for transaction
            return new Map(db)
          }

          async commit(): Promise<void> {
            // In a real adapter, this would persist changes
            return
          }

          async rollback(tx: Map<string, T>): Promise<void> {
            // In a real adapter, this would discard changes
            tx.clear()
            return
          }
        }

        const db = new Map<string, string>()
        db.set('key1', 'value1')

        const adapter = new MockAdapter<string>()

        const result = await withTransaction(db, adapter, async (tx) => {
          tx.set('key2', 'value2')
          return tx.size
        })

        expect(result).toBe(2)
      })

      it('should demonstrate adapter type safety', async () => {
        // Type-safe adapter for specific database/transaction types
        interface Database {
          readonly connection: string
        }

        interface Transaction {
          readonly txId: string
          execute(sql: string): Promise<void>
        }

        const adapter: TransactionAdapter<Database, Transaction> = {
          begin: async () => ({
            txId: `tx_${Date.now()}`,
            execute: vi.fn(),
          }),
          commit: vi.fn(),
          rollback: vi.fn(),
        }

        const db: Database = { connection: 'sqlite://memory' }

        await withTransaction(db, adapter, async (tx) => {
          expect(tx.txId).toBeTruthy()
          expect(typeof tx.execute).toBe('function')
        })
      })
    })

    describe('error handling patterns', () => {
      it('should preserve stack trace on error', async () => {
        const fakeDb = {}
        const fakeTx = {}
        const adapter: TransactionAdapter<typeof fakeDb, typeof fakeTx> = {
          begin: vi.fn().mockResolvedValue(fakeTx),
          commit: vi.fn(),
          rollback: vi.fn(),
        }

        const testError = new Error('Test error')
        const stackBefore = testError.stack

        try {
          await withTransaction(fakeDb, adapter, async () => {
            throw testError
          })
        } catch (err) {
          expect(err).toBe(testError)
          expect((err as Error).stack).toBe(stackBefore)
        }
      })

      it('should handle begin() failure', async () => {
        const fakeDb = {}
        const beginError = new Error('Failed to begin transaction')

        const adapter: TransactionAdapter<typeof fakeDb, any> = {
          begin: vi.fn().mockRejectedValue(beginError),
          commit: vi.fn(),
          rollback: vi.fn(),
        }

        await expect(
          withTransaction(fakeDb, adapter, async () => 'should not execute'),
        ).rejects.toThrow(beginError)

        expect(adapter.commit).not.toHaveBeenCalled()
        expect(adapter.rollback).not.toHaveBeenCalled()
      })

      it('should handle commit() failure', async () => {
        const fakeDb = {}
        const fakeTx = {}
        const commitError = new Error('Failed to commit')

        const adapter: TransactionAdapter<typeof fakeDb, typeof fakeTx> = {
          begin: vi.fn().mockResolvedValue(fakeTx),
          commit: vi.fn().mockRejectedValue(commitError),
          rollback: vi.fn(),
        }

        await expect(withTransaction(fakeDb, adapter, async () => 'success')).rejects.toThrow(
          commitError,
        )

        // Should attempt rollback after commit failure
        expect(adapter.rollback).toHaveBeenCalledWith(fakeTx)
      })
    })
  })
})
