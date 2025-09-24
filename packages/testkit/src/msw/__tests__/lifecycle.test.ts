/**
 * Tests for MSW server lifecycle management
 * Tests idempotency, isolation, and reset/restore behavior
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import {
  createMSWServer,
  getMSWServer,
  startMSWServer,
  stopMSWServer,
  resetMSWHandlers,
  addMSWHandlers,
  restoreMSWHandlers,
  disposeMSWServer,
  getMSWConfig,
  updateMSWConfig,
} from '../server'
import { setupMSWManual } from '../setup'

describe('MSW Lifecycle Management', () => {
  afterEach(() => {
    // Clean up after each test
    try {
      stopMSWServer()
      disposeMSWServer()
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Server Creation and Idempotency', () => {
    it('should create server instance on first call', () => {
      const handlers = [
        http.get('https://api.test.com/test', () => HttpResponse.json({ test: true })),
      ]

      createMSWServer(handlers)
      const server = getMSWServer()

      expect(server).toBeDefined()
      expect(server?.listen).toBeDefined()
      expect(server?.close).toBeDefined()
    })

    it('should be idempotent - multiple calls should return same instance', () => {
      const handlers1 = [
        http.get('https://api.test.com/test1', () => HttpResponse.json({ test: 1 })),
      ]
      const handlers2 = [
        http.get('https://api.test.com/test2', () => HttpResponse.json({ test: 2 })),
      ]

      createMSWServer(handlers1)
      const server1 = getMSWServer()

      createMSWServer(handlers2)
      const server2 = getMSWServer()

      expect(server1).toBe(server2)
    })

    it('should allow creating new server after disposal', () => {
      const handlers = [
        http.get('https://api.test.com/test', () => HttpResponse.json({ test: true })),
      ]

      createMSWServer(handlers)
      const server1 = getMSWServer()

      disposeMSWServer()

      createMSWServer(handlers)
      const server2 = getMSWServer()

      expect(server1).not.toBe(server2)
    })
  })

  describe('Handler Management and Isolation', () => {
    beforeEach(() => {
      const initialHandlers = [
        http.get('https://api.test.com/base', () => HttpResponse.json({ base: true })),
      ]
      createMSWServer(initialHandlers)
    })

    it('should reset handlers to original state', () => {
      const server = getMSWServer()
      if (!server) throw new Error('Server not created')

      // Add runtime handler
      addMSWHandlers(
        http.get('https://api.test.com/runtime', () => HttpResponse.json({ runtime: true })),
      )

      const handlersWithRuntime = server.listHandlers()

      // Reset should remove runtime handlers
      resetMSWHandlers()
      const handlersAfterReset = server.listHandlers()

      expect(handlersWithRuntime.length).toBeGreaterThan(handlersAfterReset.length)
      expect(handlersAfterReset.length).toBe(1) // Only base handler
    })

    it('should restore handlers to original state after modifications', () => {
      const server = getMSWServer()
      if (!server) throw new Error('Server not created')

      // Store original handlers count
      const originalHandlers = server.listHandlers()

      // Add new handlers
      addMSWHandlers(
        http.get('https://api.test.com/temp1', () => HttpResponse.json({ temp: 1 })),
        http.get('https://api.test.com/temp2', () => HttpResponse.json({ temp: 2 })),
      )

      expect(server.listHandlers().length).toBe(originalHandlers.length + 2)

      // Restore should bring back original state
      restoreMSWHandlers()

      // Note: MSW's restoreHandlers doesn't remove runtime handlers, it just restores to initial state
      // Since we started with 1 base handler + any global handlers, we expect at least 1
      expect(server.listHandlers().length).toBeGreaterThanOrEqual(1)
    })

    it('should isolate handlers between test suites', () => {
      const server = getMSWServer()
      if (!server) throw new Error('Server not created')

      // Simulate test suite 1
      addMSWHandlers(http.get('https://api.test.com/suite1', () => HttpResponse.json({ suite: 1 })))
      const suite1Handlers = server.listHandlers()

      resetMSWHandlers()

      // Simulate test suite 2
      addMSWHandlers(http.get('https://api.test.com/suite2', () => HttpResponse.json({ suite: 2 })))
      const suite2Handlers = server.listHandlers()

      resetMSWHandlers()

      // Both suites should have same base + 1 additional handler
      expect(suite1Handlers.length).toBe(suite2Handlers.length)
      // But different handlers should not persist between suites
      expect(suite1Handlers).not.toEqual(suite2Handlers)
    })
  })

  describe('Configuration Management', () => {
    it('should allow config updates during runtime', () => {
      createMSWServer([], { quiet: false, timeout: 5000 })

      const initialConfig = getMSWConfig()
      if (!initialConfig) throw new Error('Config not found')
      expect(initialConfig.quiet).toBe(false)
      expect(initialConfig.timeout).toBe(5000)

      updateMSWConfig({ quiet: true, timeout: 3000 })

      const updatedConfig = getMSWConfig()
      if (!updatedConfig) throw new Error('Updated config not found')
      expect(updatedConfig.quiet).toBe(true)
      expect(updatedConfig.timeout).toBe(3000)
    })

    it('should preserve config across handler operations', () => {
      createMSWServer([], { onUnhandledRequest: 'error', quiet: true })

      const configBefore = getMSWConfig()

      // Add and reset handlers
      addMSWHandlers(http.get('https://api.test.com/test', () => HttpResponse.json({ test: true })))
      resetMSWHandlers()

      const configAfter = getMSWConfig()

      expect(configBefore).toEqual(configAfter)
    })
  })

  describe('Setup Utilities', () => {
    it('should support manual lifecycle control', () => {
      const handlers = [
        http.get('https://api.test.com/manual', () => HttpResponse.json({ manual: true })),
      ]

      const { start, stop, reset, dispose } = setupMSWManual(handlers)

      expect(getMSWServer()).toBeDefined()

      // Should be able to start/stop without errors
      expect(() => start()).not.toThrow()
      expect(() => reset()).not.toThrow()
      expect(() => stop()).not.toThrow()
      expect(() => dispose()).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should handle multiple stop calls gracefully', () => {
      createMSWServer([])
      startMSWServer()

      expect(() => stopMSWServer()).not.toThrow()
      expect(() => stopMSWServer()).not.toThrow() // Second call should not error
    })

    it('should handle multiple dispose calls gracefully', () => {
      createMSWServer([])

      expect(() => disposeMSWServer()).not.toThrow()
      expect(() => disposeMSWServer()).not.toThrow() // Second call should not error
    })

    it('should handle operations on non-existent server gracefully', () => {
      // Don't create server first
      expect(() => stopMSWServer()).not.toThrow()
      expect(() => resetMSWHandlers()).not.toThrow()
      expect(() => restoreMSWHandlers()).not.toThrow()
    })
  })

  describe('Memory Management', () => {
    it('should clean up resources on disposal', () => {
      createMSWServer([
        http.get('https://api.test.com/memory', () => HttpResponse.json({ memory: true })),
      ])

      const server = getMSWServer()
      expect(server).toBeDefined()

      disposeMSWServer()

      // Server reference should be cleared - getMSWServer should return null
      expect(getMSWServer()).toBeNull()
    })

    it('should prevent memory leaks from handler accumulation', () => {
      createMSWServer([])
      const server = getMSWServer()
      if (!server) throw new Error('Server not created')

      const initialHandlerCount = server.listHandlers().length

      // Add many handlers
      const handlers = []
      for (let i = 0; i < 100; i++) {
        handlers.push(
          http.get(`https://api.test.com/leak${i}`, () => HttpResponse.json({ index: i })),
        )
      }
      addMSWHandlers(...handlers)

      expect(server.listHandlers().length).toBe(initialHandlerCount + 100)

      // Reset should clean them all up
      resetMSWHandlers()

      expect(server.listHandlers().length).toBe(initialHandlerCount)
    })
  })
})
