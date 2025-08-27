import { describe, expect, test } from 'vitest'

describe('Vitest Migration Dependency Validation', () => {
  describe('Core Vitest packages', () => {
    test('should import vitest core functions', async () => {
      const {
        describe: vitestDescribe,
        it: vitestIt,
        expect: vitestExpect,
        vi,
      } = await import('vitest')

      expect(vitestDescribe).toBeDefined()
      expect(vitestIt).toBeDefined()
      expect(vitestExpect).toBeDefined()
      expect(vi).toBeDefined()
    })

    test('should import @vitest/ui package', async () => {
      // Note: This will only work if @vitest/ui is properly installed
      // We're testing the import resolution, not running the actual UI
      try {
        const vitestUI = await import('@vitest/ui')
        expect(vitestUI).toBeDefined()
      } catch (error) {
        throw new Error(`Failed to import @vitest/ui: ${String(error)}`)
      }
    })

    test('should import @vitest/coverage-v8 package', async () => {
      try {
        const coverageV8 = await import('@vitest/coverage-v8')
        expect(coverageV8).toBeDefined()
      } catch (error) {
        throw new Error(`Failed to import @vitest/coverage-v8: ${String(error)}`)
      }
    })
  })

  describe('Testing utilities', () => {
    test('should import happy-dom for DOM environment', async () => {
      try {
        const happyDOM = await import('happy-dom')
        expect(happyDOM).toBeDefined()
        expect(happyDOM.Window).toBeDefined()
      } catch (error) {
        throw new Error(`Failed to import happy-dom: ${String(error)}`)
      }
    })

    test('should import @testing-library/react', async () => {
      try {
        const rtl = await import('@testing-library/react')
        expect(rtl).toBeDefined()
        expect(rtl.render).toBeDefined()
        expect(rtl.screen).toBeDefined()
      } catch (error) {
        throw new Error(`Failed to import @testing-library/react: ${String(error)}`)
      }
    })

    test('should import @testing-library/jest-dom', async () => {
      try {
        // Import from the vitest entry point
        await import('@testing-library/jest-dom/vitest')
        // If import succeeds, the package is available
        expect(true).toBe(true)
      } catch (error) {
        throw new Error(`Failed to import @testing-library/jest-dom: ${String(error)}`)
      }
    })

    test('should import @testing-library/user-event', async () => {
      try {
        const userEvent = await import('@testing-library/user-event')
        expect(userEvent).toBeDefined()
        expect(userEvent.default).toBeDefined()
      } catch (error) {
        throw new Error(`Failed to import @testing-library/user-event: ${String(error)}`)
      }
    })
  })

  describe('MSW and fetch utilities', () => {
    test('should import MSW for API mocking', async () => {
      try {
        const msw = await import('msw')
        expect(msw).toBeDefined()
        expect(msw.http).toBeDefined()

        // Test that we can import the main MSW exports
        const { http } = msw
        expect(http).toBeDefined()

        // In MSW v2, setupServer is imported from msw/node
        const { setupServer } = await import('msw/node')
        expect(setupServer).toBeDefined()
      } catch (error) {
        throw new Error(`Failed to import msw: ${String(error)}`)
      }
    })
  })

  describe('Configuration packages', () => {
    test('should import vite-tsconfig-paths', async () => {
      try {
        const viteTsconfigPaths = await import('vite-tsconfig-paths')
        expect(viteTsconfigPaths).toBeDefined()
        expect(viteTsconfigPaths.default).toBeDefined()
      } catch (error) {
        throw new Error(`Failed to import vite-tsconfig-paths: ${String(error)}`)
      }
    })

    test('should import eslint-plugin-vitest', async () => {
      try {
        const eslintPluginVitest = await import('eslint-plugin-vitest')
        expect(eslintPluginVitest).toBeDefined()
        expect(eslintPluginVitest.default ?? eslintPluginVitest).toBeDefined()
      } catch (error) {
        throw new Error(`Failed to import eslint-plugin-vitest: ${String(error)}`)
      }
    })
  })

  describe('Package version compatibility', () => {
    test('should have compatible vitest version', async () => {
      const pkg = await import('../package.json', { assert: { type: 'json' } })
      const vitestVersion = pkg.default.devDependencies?.vitest

      expect(vitestVersion).toBeDefined()
      expect(vitestVersion).toMatch(/^\d+\.\d+\.\d+$|^\^\d+\.\d+\.\d+$/)
    })

    test('should verify MSW can create a basic handler', async () => {
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
  })
})
