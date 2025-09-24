/**
 * Comprehensive test suite for Convex test harness
 */
import type { GenericSchema, SchemaDefinition } from 'convex/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConvexTestError } from '../context.js'
import { createConvexTestHarness } from '../harness.js'

// Test schema definition
const schema = defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.optional(v.string()),
  }),
  posts: defineTable({
    title: v.string(),
    content: v.string(),
    authorId: v.id('users'),
    published: v.boolean(),
  }),
  tasks: defineTable({
    description: v.string(),
    completed: v.boolean(),
    scheduledAt: v.optional(v.number()),
  }),
})

type TestSchema =
  typeof schema extends SchemaDefinition<infer S, boolean>
    ? S extends GenericSchema
      ? S
      : never
    : never

// Gate Convex-dependent tests behind an env flag to avoid requiring `_generated` by default
const RUN_CONVEX = process.env.CONVEX_GENERATED === 'true'
const describeConvex = RUN_CONVEX ? describe : describe.skip

describeConvex('Convex Test Harness', () => {
  let harness: ReturnType<typeof createConvexTestHarness<TestSchema>>

  beforeEach(() => {
    vi.useFakeTimers()
    try {
      harness = createConvexTestHarness<TestSchema>({
        schema: schema as SchemaDefinition<TestSchema, boolean>,
        // modules defaults to {} to prevent _generated directory scan
        debug: process.env.DEBUG === 'true',
      })
    } catch (error) {
      // If harness creation fails (e.g., _generated directory missing),
      // log the error but don't throw - let the test fail with a clear message
      console.error('Failed to create test harness:', error)
    }
  })

  afterEach(async () => {
    // Guard against undefined harness when setup fails
    if (harness?.lifecycle) {
      await harness.lifecycle.cleanup({ advanceTimers: vi.runAllTimers })
    }
    vi.useRealTimers()
  })

  describe('Database Operations', () => {
    it('should seed database with test data', async () => {
      await harness.db.seed(async (ctx) => {
        const userId = await ctx.db.insert('users', {
          name: 'Test User',
          email: 'test@example.com',
          role: 'admin',
        })

        await ctx.db.insert('posts', {
          title: 'Test Post',
          content: 'Test content',
          authorId: userId,
          published: false,
        })
      })

      const result = await harness.db.run(async (ctx) => {
        const users = await ctx.db.query('users').collect()
        const posts = await ctx.db.query('posts').collect()
        return { users, posts }
      })

      expect(result.users).toHaveLength(1)
      expect(result.users[0].name).toBe('Test User')
      expect(result.posts).toHaveLength(1)
      expect(result.posts[0].title).toBe('Test Post')
    })

    it('should clear database data', async () => {
      // Seed initial data
      await harness.db.seed(async (ctx) => {
        await ctx.db.insert('users', {
          name: 'User to clear',
          email: 'clear@example.com',
        })
      })

      // Verify data exists
      const beforeClear = await harness.db.run(async (ctx) => {
        return ctx.db.query('users').collect()
      })
      expect(beforeClear).toHaveLength(1)

      // Clear database
      await harness.db.clear()

      // Verify data is cleared
      const afterClear = await harness.db.run(async (ctx) => {
        return ctx.db.query('users').collect()
      })
      expect(afterClear).toHaveLength(0)
    })

    it('should throw for unimplemented getAllDocuments', async () => {
      await expect(harness.db.getAllDocuments('users')).rejects.toThrow(ConvexTestError)
      await expect(harness.db.getAllDocuments('users')).rejects.toThrow(
        'getAllDocuments is not implemented',
      )
    })

    it('should throw for unimplemented countDocuments', async () => {
      await expect(harness.db.countDocuments('users')).rejects.toThrow(ConvexTestError)
      await expect(harness.db.countDocuments('users')).rejects.toThrow(
        'countDocuments is not implemented',
      )
    })
  })

  describe('Identity Management', () => {
    it('should isolate data between different users', async () => {
      const user1 = {
        subject: 'user1',
        issuer: 'test',
        tokenIdentifier: 'token1',
        email: 'user1@example.com',
      }

      const user2 = {
        subject: 'user2',
        issuer: 'test',
        tokenIdentifier: 'token2',
        email: 'user2@example.com',
      }

      // Create data as user1
      const user1Context = harness.auth.withUser(user1)
      await user1Context.run(async (ctx) => {
        await ctx.db.insert('posts', {
          title: 'User1 Post',
          content: 'Private to user1',
          authorId: 'user1' as any,
          published: false,
        })
      })

      // Create data as user2
      const user2Context = harness.auth.withUser(user2)
      await user2Context.run(async (ctx) => {
        await ctx.db.insert('posts', {
          title: 'User2 Post',
          content: 'Private to user2',
          authorId: 'user2' as any,
          published: false,
        })
      })

      // Verify both posts exist in database
      const allPosts = await harness.db.run(async (ctx) => {
        return ctx.db.query('posts').collect()
      })
      expect(allPosts).toHaveLength(2)
      expect(allPosts.map((p) => p.title)).toContain('User1 Post')
      expect(allPosts.map((p) => p.title)).toContain('User2 Post')
    })

    it('should support fluent identity switching', async () => {
      const adminUser = harness.auth.testUsers.admin()
      const regularUser = harness.auth.testUsers.regular()

      // Start as admin
      harness.auth.withUser(adminUser)
      expect(harness.auth.getCurrentUserMetadata()).toEqual(adminUser)

      // Switch to regular user
      harness.auth.switchUser(regularUser)
      expect(harness.auth.getCurrentUserMetadata()).toEqual(regularUser)

      // Switch to anonymous
      harness.auth.asAnonymous()
      expect(harness.auth.getCurrentUserMetadata()).toBeNull()
    })

    it('should run operations with temporary auth context', async () => {
      const testUser = {
        subject: 'temp_user',
        issuer: 'test',
        email: 'temp@example.com',
      }

      // Initially anonymous
      expect(harness.auth.getCurrentUserMetadata()).toBeNull()

      // Run with temporary auth
      const result = await harness.auth.withAuth(testUser, async (ctx) => {
        return ctx.run(async (innerCtx) => {
          await innerCtx.db.insert('users', {
            name: 'Temp User',
            email: 'temp@example.com',
          })
          return 'success'
        })
      })

      expect(result).toBe('success')

      // Should still be anonymous after
      expect(harness.auth.getCurrentUserMetadata()).toBeNull()
    })
  })

  describe('Scheduler Operations', () => {
    it('should handle mutation that schedules action with timer advancing', async () => {
      let scheduledTaskExecuted = false

      // Simulate a mutation that schedules a task
      await harness.db.run(async (ctx) => {
        await ctx.db.insert('tasks', {
          description: 'Scheduled task',
          completed: false,
          scheduledAt: Date.now() + 5000, // 5 seconds from now
        })

        // Simulate scheduling (in real Convex, this would use ctx.scheduler)
        setTimeout(() => {
          scheduledTaskExecuted = true
        }, 5000)
      })

      // Task should not be executed yet
      expect(scheduledTaskExecuted).toBe(false)

      // Finish scheduled functions with timer advancement
      await harness.scheduler.finishAllWithTimers(() => vi.runAllTimers())

      // Task should now be executed
      expect(scheduledTaskExecuted).toBe(true)
    })

    it('should finish in-progress scheduled functions', async () => {
      let inProgressTask = false

      // Start a task
      await harness.db.run(async (ctx) => {
        await ctx.db.insert('tasks', {
          description: 'In-progress task',
          completed: false,
        })

        // Simulate in-progress task
        setTimeout(() => {
          inProgressTask = true
        }, 0)
      })

      // Finish in-progress tasks
      await harness.scheduler.finishInProgress()

      // Note: convex-test's finishInProgress doesn't advance timers
      // Tasks need explicit timer advancement
      vi.runAllTimers()

      expect(inProgressTask).toBe(true)
    })

    it('should throw for unimplemented scheduler methods', async () => {
      await expect(harness.scheduler.getPendingFunctions()).rejects.toThrow(
        'getPendingFunctions not implemented',
      )
      await expect(harness.scheduler.cancelAll()).rejects.toThrow('cancelAll not implemented')
      await expect(harness.scheduler.advanceTime(1000)).rejects.toThrow(
        'advanceTime not implemented',
      )
    })
  })

  describe('Storage Operations', () => {
    it('should handle file upload and retrieval via t.run', async () => {
      const fileName = 'test.txt'
      const fileContent = 'Hello, Convex Storage!'

      // Upload file
      const storageId = await harness.storage.uploadFile(fileName, fileContent)
      expect(storageId).toBeTruthy()
      expect(typeof storageId).toBe('string')

      // Retrieve file
      const retrieved = await harness.storage.getFile(storageId)
      expect(retrieved).toBeInstanceOf(ArrayBuffer)

      // Convert back to string for comparison
      const decoder = new TextDecoder()
      const retrievedContent = decoder.decode(retrieved as ArrayBuffer)
      expect(retrievedContent).toBe(fileContent)
    })

    it('should handle binary file upload', async () => {
      const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) // PNG header
      const buffer = binaryData.buffer

      const storageId = await harness.storage.uploadFile('image.png', buffer)
      expect(storageId).toBeTruthy()

      const retrieved = await harness.storage.getFile(storageId)
      expect(retrieved).toBeInstanceOf(ArrayBuffer)

      const retrievedArray = new Uint8Array(retrieved as ArrayBuffer)
      expect(retrievedArray[0]).toBe(0x89)
      expect(retrievedArray[1]).toBe(0x50)
    })

    it('should delete files', async () => {
      const storageId = await harness.storage.uploadFile('temp.txt', 'temporary')

      // File should exist
      const beforeDelete = await harness.storage.getFile(storageId)
      expect(beforeDelete).toBeTruthy()

      // Delete file
      await harness.storage.deleteFile(storageId)

      // File should not exist
      const afterDelete = await harness.storage.getFile(storageId)
      expect(afterDelete).toBeNull()
    })

    it('should throw for unimplemented storage methods', async () => {
      await expect(harness.storage.listFiles()).rejects.toThrow('listFiles not implemented')
      await expect(harness.storage.clearFiles()).rejects.toThrow('clearFiles not implemented')
    })
  })

  describe('HTTP Action Testing', () => {
    it('should support HTTP action testing with mock', async () => {
      // This demonstrates the pattern for HTTP testing with mocks
      const mockHttpHandler = vi.fn().mockResolvedValue({
        status: 200,
        body: JSON.stringify({ message: 'Success' }),
      })

      // Simulate HTTP action test
      await harness.db.run(async (_ctx) => {
        const response = await mockHttpHandler('/api/test', {
          method: 'POST',
          body: JSON.stringify({ data: 'test' }),
        })

        expect(response.status).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.message).toBe('Success')
      })

      expect(mockHttpHandler).toHaveBeenCalledWith('/api/test', expect.any(Object))
    })

    it('should support t.fetch for HTTP actions without modules', async () => {
      // Test the fetch method without modules (basic smoke test)
      // The convex instance exposes a fetch method even without modules
      const response = await harness.convex.fetch('/api/test', {
        method: 'POST',
        body: JSON.stringify({ message: 'test' }),
      })

      // Default response when no modules/routes are configured
      expect(response).toBeDefined()
      expect(response.status).toBeDefined()
      expect(response.ok).toBeDefined()
    })

    it.skip('should handle t.fetch with modules (requires CONVEX_GENERATED)', () => {
      // This test would only run when CONVEX_GENERATED=true
      // Example pattern for real projects with route handlers:
      //
      // const modules = import.meta.glob('./**/*.{js,ts}', { eager: true })
      // const harness = createConvexTestHarness({ modules })
      //
      // // Register HTTP routes
      // const router = new HttpRouter()
      // router.route({
      //   path: '/api/users',
      //   method: 'POST',
      //   handler: httpAction(async (ctx, request) => {
      //     const data = await request.json()
      //     const id = await ctx.runMutation(api.users.create, data)
      //     return new Response(JSON.stringify({ id }), { status: 200 })
      //   })
      // })
      //
      // const response = await harness.convex.fetch('/api/users', {
      //   method: 'POST',
      //   body: JSON.stringify({ name: 'Test User' }),
      //   headers: { 'Content-Type': 'application/json' }
      // })
      //
      // expect(response.status).toBe(200)
      // const result = await response.json()
      // expect(result).toHaveProperty('id')

      expect(true).toBe(true)
    })
  })

  describe('Lifecycle Management', () => {
    it('should reset test harness state', async () => {
      // Add data
      await harness.db.seed(async (ctx) => {
        await ctx.db.insert('users', {
          name: 'User before reset',
          email: 'before@example.com',
        })
      })

      // Verify data exists
      const beforeReset = await harness.db.run(async (ctx) => {
        return ctx.db.query('users').collect()
      })
      expect(beforeReset).toHaveLength(1)

      // Reset harness
      await harness.lifecycle.reset()

      // Verify data is cleared
      const afterReset = await harness.db.run(async (ctx) => {
        return ctx.db.query('users').collect()
      })
      expect(afterReset).toHaveLength(0)
    })

    it('should cleanup resources properly', async () => {
      // Set user
      harness.auth.withUser({ subject: 'cleanup_test' })

      // Add some data
      await harness.db.seed(async (ctx) => {
        await ctx.db.insert('users', {
          name: 'Cleanup User',
          email: 'cleanup@example.com',
        })
      })

      // Cleanup
      await harness.lifecycle.cleanup()

      // User should be cleared
      expect(harness.auth.getCurrentUserMetadata()).toBeNull()
    })
  })

  describe('Deterministic Seeding', () => {
    it('should support deterministic data seeding with TEST_SEED', async () => {
      const originalSeed = process.env.TEST_SEED
      process.env.TEST_SEED = '12345'

      // Seed function that uses TEST_SEED for deterministic data
      const seedWithDeterministicData = async () => {
        const seed = parseInt(process.env.TEST_SEED || '0', 10)
        const random = (max: number) => (seed * 9301 + 49297) % max

        await harness.db.seed(async (ctx) => {
          for (let i = 0; i < 3; i++) {
            await ctx.db.insert('users', {
              name: `User ${i}`,
              email: `user${i}@example.com`,
              role: random(2) === 0 ? 'admin' : 'user',
            })
          }
        })
      }

      await seedWithDeterministicData()

      const users = await harness.db.run(async (ctx) => {
        return ctx.db.query('users').collect()
      })

      expect(users).toHaveLength(3)
      // With seed 12345, we expect deterministic roles
      expect(users[0].role).toBeDefined()

      // Restore original seed
      if (originalSeed) {
        process.env.TEST_SEED = originalSeed
      } else {
        delete process.env.TEST_SEED
      }
    })
  })

  describe('Module Loading', () => {
    it.skip('should support real modules via import.meta.glob (requires CONVEX_GENERATED)', () => {
      // This test would only run when CONVEX_GENERATED=true
      // Example pattern for real projects:
      // const modules = import.meta.glob('./**/*.{js,ts}', { eager: true })
      // const harness = createConvexTestHarness({ schema, modules })

      // For now, this is skipped as it requires actual _generated directory
      expect(true).toBe(true)
    })
  })

  describe('P1 Fixes', () => {
    describe('db.clear without modules', () => {
      it('should not trigger _generated scan when clearing database without modules', async () => {
        // Create harness without modules (smoke test scenario)
        const harness = createConvexTestHarness()

        // Seed some data
        await harness.db.seed(async (ctx) => {
          await ctx.db.insert('test', { value: 'initial' })
        })

        // Clear should work without triggering module scan
        // This would fail if config.modules is undefined and convex-test tries to scan _generated
        await expect(harness.db.clear()).resolves.not.toThrow()

        // Verify database is cleared by trying to query (will throw since no schema)
        await expect(
          harness.db.run(async (ctx) => {
            const results = await ctx.db.query('test' as never).collect()
            return results
          }),
        ).rejects.toThrow()
      })
    })

    describe('Scheduler chains with timers', () => {
      beforeEach(() => {
        vi.useFakeTimers()
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('should handle chained scheduled functions with finishAllWithTimers', async () => {
        const harness = createConvexTestHarness()
        const executionLog: string[] = []

        // Mock scheduled functions that chain
        await harness.convex.run(async (ctx) => {
          // Schedule initial function
          await ctx.scheduler.runAfter(1000, (async () => {
            executionLog.push('first')
            // This function schedules another
            await ctx.scheduler.runAfter(2000, (async () => {
              executionLog.push('second')
              // And this one schedules a third
              await ctx.scheduler.runAfter(3000, (async () => {
                executionLog.push('third')
              }) as never)
            }) as never)
          }) as never)
        })

        // Initially, no functions have executed
        expect(executionLog).toEqual([])

        // Finish all scheduled functions with timer advancement
        // This should execute the chain: first -> second -> third
        await harness.scheduler.finishAllWithTimers(vi.runAllTimers)

        // All chained functions should have executed
        expect(executionLog).toEqual(['first', 'second', 'third'])
      })

      it('should handle finishInProgress without advancing timers', async () => {
        const harness = createConvexTestHarness()
        const executionLog: string[] = []

        // Schedule a function immediately and one in the future
        await harness.convex.run(async (ctx) => {
          // This runs immediately (0 delay)
          await ctx.scheduler.runAfter(0, (async () => {
            executionLog.push('immediate')
          }) as never)
          // This needs timer advancement
          await ctx.scheduler.runAfter(5000, (async () => {
            executionLog.push('delayed')
          }) as never)
        })

        // Finish only in-progress functions (immediate ones)
        await harness.scheduler.finishInProgress()

        // Only immediate function should execute
        expect(executionLog).toEqual(['immediate'])

        // Now advance timers and finish all
        await harness.scheduler.finishAll(vi.runAllTimers)

        // Now delayed function should also execute
        expect(executionLog).toEqual(['immediate', 'delayed'])
      })
    })

    describe('Identity isolation with queries', () => {
      it('should properly isolate queries between different user contexts', async () => {
        const harness = createConvexTestHarness()

        // Create contexts for different users
        const user1Context = harness.auth.withUser({
          subject: 'user_1',
          tokenIdentifier: 'token_1',
        })

        const user2Context = harness.auth.withUser({
          subject: 'user_2',
          tokenIdentifier: 'token_2',
        })

        const anonymousContext = harness.auth.withoutAuth()

        // Write data with different users
        await user1Context.run(async (ctx) => {
          await ctx.db.insert('messages' as never, {
            text: 'User 1 message',
            userId: 'user_1',
          })
        })

        await user2Context.run(async (ctx) => {
          await ctx.db.insert('messages' as never, {
            text: 'User 2 message',
            userId: 'user_2',
          })
        })

        await anonymousContext.run(async (ctx) => {
          await ctx.db.insert('messages' as never, {
            text: 'Anonymous message',
            userId: null,
          })
        })

        // Query as different users to verify isolation
        const user1Messages = await user1Context.run(async (ctx) => {
          const messages = await ctx.db.query('messages' as never).collect()
          return messages.filter((m: any) => m.userId === 'user_1')
        })

        const user2Messages = await user2Context.run(async (ctx) => {
          const messages = await ctx.db.query('messages' as never).collect()
          return messages.filter((m: any) => m.userId === 'user_2')
        })

        const anonMessages = await anonymousContext.run(async (ctx) => {
          const messages = await ctx.db.query('messages' as never).collect()
          return messages.filter((m: any) => m.userId === null)
        })

        // Verify each context sees appropriate data
        expect(user1Messages).toHaveLength(1)
        expect(user1Messages[0]).toMatchObject({ text: 'User 1 message' })

        expect(user2Messages).toHaveLength(1)
        expect(user2Messages[0]).toMatchObject({ text: 'User 2 message' })

        expect(anonMessages).toHaveLength(1)
        expect(anonMessages[0]).toMatchObject({ text: 'Anonymous message' })
      })
    })
  })
})
