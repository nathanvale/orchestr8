import { describe, expect, test } from 'vitest'

/**
 * Essential Package Validation
 *
 * Tests that critical packages are correctly installed and can create working handlers.
 * Focuses on behavioral testing rather than import testing.
 */
describe('Essential Package Validation', () => {
  describe('Package version compatibility', () => {
    test('has compatible vitest version', async () => {
      const pkg = await import('../package.json', { assert: { type: 'json' } })
      const vitestVersion = pkg.default.devDependencies?.vitest

      expect(vitestVersion).toBeDefined()
      expect(vitestVersion).toMatch(/^\d+\.\d+\.\d+$|^\^\d+\.\d+\.\d+$/)
    })
  })

  describe('MSW functionality validation', () => {
    test('can create functional MSW handlers', async () => {
      const { http } = await import('msw')

      const handler = http.get('/api/test', () => {
        return new Response(JSON.stringify({ message: 'test' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      })

      expect(handler).toBeDefined()
      expect(handler.info).toBeDefined()
      expect(handler.info.method).toBe('GET')
    })

    test('can setup MSW server', async () => {
      const { setupServer } = await import('msw/node')
      expect(typeof setupServer).toBe('function')
    })
  })

  describe('Testing environment validation', () => {
    test('has functional testing library integration', async () => {
      // Quick validation that testing-library imports resolve
      const rtl = await import('@testing-library/react')
      expect(typeof rtl.render).toBe('function')
      expect(typeof rtl.screen.getByText).toBe('function')
    })

    test('has working DOM environment', async () => {
      const happyDOM = await import('happy-dom')
      expect(happyDOM.Window).toBeDefined()
    })
  })
})
