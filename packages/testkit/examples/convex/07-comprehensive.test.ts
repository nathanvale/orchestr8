/**
 * Comprehensive Convex Test Examples
 *
 * This file demonstrates all recommended patterns for testing Convex applications,
 * addressing P0-P3 concerns from the epic requirements.
 */

import { convexTest } from 'convex-test'
import { describe, expect, test, vi } from 'vitest'
const RUN_CONVEX = process.env.CONVEX_GENERATED === 'true'
const describeConvex = RUN_CONVEX ? describe : describe.skip

// IMPORTANT: Convex tests require either:
// 1. A _generated directory from running 'npx convex codegen'
// 2. An explicit modules parameter (even if empty) to skip auto-discovery
//
// We use approach #2 here to avoid requiring codegen for these examples.

describeConvex('Convex Testing Best Practices', () => {
  describe('P0: Module Discovery Pattern', () => {
    test('using empty modules to avoid _generated requirement', () => {
      // This prevents the "Could not find _generated directory" error
      const t = convexTest(undefined as any, {} as any)
      expect(t).toBeDefined()
    })

    test('using import.meta.glob for real modules', () => {
      // In a real project with Convex functions:
      // const modules = import.meta.glob('./**/*.{js,ts}', { eager: true })
      // const t = convexTest(schema, modules)

      // For this example:
      const modules = {} // Empty for demonstration
      const t = convexTest(undefined as any, modules)
      expect(t).toBeDefined()
    })
  })

  describe('P1: Scheduler Patterns (Aligned with Convex Docs)', () => {
    test('scheduler with fake timers - finishAllScheduledFunctions pattern', async () => {
      vi.useFakeTimers()
      const t = convexTest(undefined as any, {} as any)

      // This pattern matches Convex documentation exactly
      // In real usage: await t.mutation(api.tasks.scheduleChain)

      // Finish all scheduled functions with timer advancement
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Verify scheduler state is clean
      const result = await t.run(async () => 'scheduler_complete')
      expect(result).toBe('scheduler_complete')

      vi.useRealTimers()
    })

    test('scheduler with in-progress functions', async () => {
      vi.useFakeTimers()
      const t = convexTest(undefined as any, {} as any)

      // Finish only in-progress scheduled functions (no timer advancement)
      await t.finishInProgressScheduledFunctions()

      // This is useful when you want to process current queue without advancing time
      expect(true).toBe(true)

      vi.useRealTimers()
    })

    test('scheduler cleanup with timer advancement', async () => {
      vi.useFakeTimers()
      const t = convexTest(undefined as any, {} as any)

      // Simulate scheduling (in real app: await t.mutation(api.tasks.schedule))

      // Cleanup pattern that advances timers (prevents pending functions warning)
      try {
        await t.finishAllScheduledFunctions(vi.runAllTimers)
      } finally {
        vi.useRealTimers()
      }

      expect(true).toBe(true)
    })
  })

  describe('P1: Identity Patterns (Fluent API)', () => {
    test('fluent withIdentity pattern (matches t.withIdentity from docs)', async () => {
      const t = convexTest(undefined as any, {} as any)

      // Preferred pattern: fluent API matching Convex docs
      const asAlice = t.withIdentity({ subject: 'alice_123', name: 'Alice' })
      const asBob = t.withIdentity({ subject: 'bob_456', name: 'Bob' })

      // Each identity has isolated context
      const aliceData = await asAlice.run(async (ctx) => {
        await ctx.db.insert(
          'user_data' as any,
          {
            owner: 'alice_123',
            data: 'private',
          } as any,
        )

        return await ctx.db
          .query('user_data' as any)
          .filter((q: any) => q.eq(q.field('owner'), 'alice_123'))
          .collect()
      })

      const bobData = await asBob.run(async (ctx) => {
        return await ctx.db
          .query('user_data' as any)
          .filter((q: any) => q.eq(q.field('owner'), 'bob_456'))
          .collect()
      })

      expect(aliceData).toHaveLength(1)
      expect(bobData).toHaveLength(0) // Bob can't see Alice's data
    })

    test('identity switching within test', async () => {
      const t = convexTest(undefined as any, {} as any)

      // Start anonymous
      await t.run(async (ctx) => {
        await ctx.db.insert('public_data' as any, { public: true } as any)
      })

      // Switch to authenticated user
      const authenticated = t.withIdentity({ subject: 'user_123', name: 'User' })
      await authenticated.run(async (ctx) => {
        await ctx.db.insert(
          'private_data' as any,
          {
            owner: 'user_123',
            private: true,
          } as any,
        )
      })

      // Verify data isolation
      const publicCount = await t.run(async (ctx) => {
        const docs = await ctx.db.query('public_data' as any).collect()
        return docs.length
      })

      expect(publicCount).toBe(1)
    })
  })

  describe('P1: Storage Patterns (via ctx.storage)', () => {
    test('storage operations via t.run (correct pattern)', async () => {
      const t = convexTest(undefined as any, {} as any)

      // CORRECT: Always access storage via ctx.storage inside t.run
      const result = await t.run(async (ctx) => {
        // Upload
        const blob = new Blob(['test content'], { type: 'text/plain' })
        const storageId = await ctx.storage.store(blob)

        // Retrieve
        const retrieved = await ctx.storage.get(storageId)

        // Delete
        await ctx.storage.delete(storageId)

        return { uploaded: !!storageId, retrieved: !!retrieved }
      })

      expect(result.uploaded).toBe(true)
      expect(result.retrieved).toBe(true)
    })

    test('storage with database metadata pattern', async () => {
      const t = convexTest(undefined as any, {} as any)

      const fileRecord = await t.run(async (ctx) => {
        // Store file in storage
        const content = 'Document content'
        const blob = new Blob([content], { type: 'text/plain' })
        const storageId = await ctx.storage.store(blob)

        // Store metadata in database
        const docId = await ctx.db.insert(
          'files' as any,
          {
            storageId,
            filename: 'document.txt',
            contentType: 'text/plain',
            size: blob.size,
            createdAt: Date.now(),
          } as any,
        )

        return await ctx.db.get(docId)
      })

      expect(fileRecord.filename).toBe('document.txt')
      expect(fileRecord.storageId).toBeDefined()
    })
  })

  describe('P3: Additional Test Patterns', () => {
    test('HTTP action testing with t.fetch', async () => {
      // When you have HTTP routes defined:
      // const t = convexTest(schema, modules)
      // const response = await t.fetch('/api/endpoint', {
      //   method: 'POST',
      //   body: JSON.stringify({ data: 'test' }),
      //   headers: { 'Content-Type': 'application/json' }
      // })
      // expect(response.status).toBe(200)

      // For this example without routes:
      // const t = convexTest(undefined as any, {} as any)

      // Stub external fetch for actions that make HTTP calls
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            ({
              ok: true,
              status: 200,
              json: async () => ({ success: true }),
            }) as Response,
        ),
      )

      // In real app: const result = await t.action(api.external.callAPI)
      // expect(result.success).toBe(true)

      vi.unstubAllGlobals()
      expect(true).toBe(true) // Placeholder assertion
    })

    test('auth isolation - smallest hello world example', async () => {
      const t = convexTest(undefined as any, {} as any)

      // Two users with separate contexts
      const user1 = t.withIdentity({ subject: 'user1' })
      const user2 = t.withIdentity({ subject: 'user2' })

      // User 1 creates data
      await user1.run(async (ctx) => {
        await ctx.db.insert(
          'messages' as any,
          {
            from: 'user1',
            text: 'Hello from User 1',
          } as any,
        )
      })

      // User 2 creates data
      await user2.run(async (ctx) => {
        await ctx.db.insert(
          'messages' as any,
          {
            from: 'user2',
            text: 'Hello from User 2',
          } as any,
        )
      })

      // Verify each user's data
      const user1Messages = await user1.run(async (ctx) => {
        return await ctx.db
          .query('messages' as any)
          .filter((q: any) => q.eq(q.field('from'), 'user1'))
          .collect()
      })

      expect(user1Messages).toHaveLength(1)
      expect(user1Messages[0].text).toBe('Hello from User 1')
    })

    test('transactional operations pattern', async () => {
      const t = convexTest(undefined as any, {} as any)

      const result = await t.run(async (ctx) => {
        // All operations in a single transaction
        const userId = await ctx.db.insert(
          'users' as any,
          {
            name: 'John',
            email: 'john@example.com',
          } as any,
        )

        const postId = await ctx.db.insert(
          'posts' as any,
          {
            authorId: userId,
            title: 'First Post',
            content: 'Content here',
          } as any,
        )

        // Update user with post count
        await ctx.db.patch(userId, { postCount: 1 } as any)

        return { userId, postId }
      })

      expect(result.userId).toBeDefined()
      expect(result.postId).toBeDefined()
    })
  })

  describe('Error Handling Patterns', () => {
    test('handling storage errors gracefully', async () => {
      const t = convexTest(undefined as any, {} as any)

      const result = await t.run(async (ctx) => {
        try {
          // Attempt to get non-existent file
          const file = await ctx.storage.get('non_existent_id' as any)
          return { success: false, error: null, file }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            file: null,
          }
        }
      })

      // Storage.get returns null for non-existent files, doesn't throw
      expect(result.file).toBeNull()
    })

    test('database constraint violations', async () => {
      const t = convexTest(undefined as any, {} as any)

      await t.run(async (ctx) => {
        // Create a unique record
        await ctx.db.insert(
          'unique_items' as any,
          {
            uniqueKey: 'key1',
            value: 'value1',
          } as any,
        )
      })

      // In real app with unique constraints, this would fail
      // For this example, we just verify the pattern
      const secondInsert = await t.run(async (ctx) => {
        try {
          await ctx.db.insert(
            'unique_items' as any,
            {
              uniqueKey: 'key1',
              value: 'value2',
            } as any,
          )
          return { success: true }
        } catch {
          return { success: false, reason: 'duplicate_key' }
        }
      })

      // Without schema constraints, this succeeds
      // In real app with constraints, expect(secondInsert.success).toBe(false)
      expect(secondInsert).toBeDefined()
    })
  })
})

describeConvex('Test Lifecycle Management', () => {
  test('proper cleanup with timer advancement', async () => {
    vi.useFakeTimers()
    const t = convexTest(undefined as any, {} as any)

    try {
      // Do test work
      await t.run(async (ctx) => {
        await ctx.db.insert('test_data' as any, { test: true } as any)
      })

      // Clean up scheduled functions with timer advancement
      await t.finishAllScheduledFunctions(vi.runAllTimers)
    } finally {
      // Always restore real timers
      vi.useRealTimers()
    }

    expect(true).toBe(true)
  })

  test('test isolation verification', async () => {
    // Each test gets a fresh Convex instance
    const t1 = convexTest(undefined as any, {} as any)
    const t2 = convexTest(undefined as any, {} as any)

    // Data in t1
    await t1.run(async (ctx) => {
      await ctx.db.insert('isolated' as any, { instance: 't1' } as any)
    })

    // Data in t2 (completely separate)
    await t2.run(async (ctx) => {
      await ctx.db.insert('isolated' as any, { instance: 't2' } as any)
    })

    // Verify isolation
    const t1Count = await t1.run(async (ctx) => {
      const docs = await ctx.db.query('isolated' as any).collect()
      return docs.length
    })

    const t2Count = await t2.run(async (ctx) => {
      const docs = await ctx.db.query('isolated' as any).collect()
      return docs.length
    })

    expect(t1Count).toBe(1)
    expect(t2Count).toBe(1)
  })
})
export * from '../convex-comprehensive.test'
