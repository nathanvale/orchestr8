import { describe, expect, it } from 'vitest';

describe('Vitest Migration Dependency Validation', () => {
  describe('Core Vitest packages', () => {
    it('should import vitest core functions', async () => {
      const {
        describe: vitestDescribe,
        it: vitestIt,
        expect: vitestExpect,
        vi,
      } = await import('vitest');

      expect(vitestDescribe).toBeDefined();
      expect(vitestIt).toBeDefined();
      expect(vitestExpect).toBeDefined();
      expect(vi).toBeDefined();
    });

    it('should import @vitest/ui package', async () => {
      // Note: This will only work if @vitest/ui is properly installed
      // We're testing the import resolution, not running the actual UI
      try {
        const vitestUI = await import('@vitest/ui');
        expect(vitestUI).toBeDefined();
      } catch (error) {
        expect.fail(`Failed to import @vitest/ui: ${error}`);
      }
    });

    it('should import @vitest/coverage-v8 package', async () => {
      try {
        const coverageV8 = await import('@vitest/coverage-v8');
        expect(coverageV8).toBeDefined();
      } catch (error) {
        expect.fail(`Failed to import @vitest/coverage-v8: ${error}`);
      }
    });
  });

  describe('Testing utilities', () => {
    it('should import happy-dom for DOM environment', async () => {
      try {
        const happyDOM = await import('happy-dom');
        expect(happyDOM).toBeDefined();
        expect(happyDOM.Window).toBeDefined();
      } catch (error) {
        expect.fail(`Failed to import happy-dom: ${error}`);
      }
    });

    it('should import @testing-library/react', async () => {
      try {
        const rtl = await import('@testing-library/react');
        expect(rtl).toBeDefined();
        expect(rtl.render).toBeDefined();
        expect(rtl.screen).toBeDefined();
      } catch (error) {
        expect.fail(`Failed to import @testing-library/react: ${error}`);
      }
    });

    it('should import @testing-library/jest-dom', async () => {
      try {
        const jestDOM = await import('@testing-library/jest-dom');
        expect(jestDOM).toBeDefined();
      } catch (error) {
        expect.fail(`Failed to import @testing-library/jest-dom: ${error}`);
      }
    });

    it('should import @testing-library/user-event', async () => {
      try {
        const userEvent = await import('@testing-library/user-event');
        expect(userEvent).toBeDefined();
        expect(userEvent.default).toBeDefined();
      } catch (error) {
        expect.fail(`Failed to import @testing-library/user-event: ${error}`);
      }
    });
  });

  describe('MSW and fetch utilities', () => {
    it('should import MSW for API mocking', async () => {
      try {
        const msw = await import('msw');
        expect(msw).toBeDefined();
        expect(msw.http).toBeDefined();

        // Test that we can import the main MSW exports
        const { http } = msw;
        expect(http).toBeDefined();

        // In MSW v2, setupServer is imported from msw/node
        const { setupServer } = await import('msw/node');
        expect(setupServer).toBeDefined();
      } catch (error) {
        expect.fail(`Failed to import msw: ${error}`);
      }
    });
  });

  describe('Configuration packages', () => {
    it('should import vite-tsconfig-paths', async () => {
      try {
        const viteTsconfigPaths = await import('vite-tsconfig-paths');
        expect(viteTsconfigPaths).toBeDefined();
        expect(viteTsconfigPaths.default).toBeDefined();
      } catch (error) {
        expect.fail(`Failed to import vite-tsconfig-paths: ${error}`);
      }
    });

    it('should import eslint-plugin-vitest', async () => {
      try {
        const eslintPluginVitest = await import('eslint-plugin-vitest');
        expect(eslintPluginVitest).toBeDefined();
        expect(eslintPluginVitest.default || eslintPluginVitest).toBeDefined();
      } catch (error) {
        expect.fail(`Failed to import eslint-plugin-vitest: ${error}`);
      }
    });
  });

  describe('Package version compatibility', () => {
    it('should have compatible vitest version', async () => {
      const pkg = await import('../package.json', { assert: { type: 'json' } });
      const vitestVersion = pkg.default.devDependencies?.vitest;

      expect(vitestVersion).toBeDefined();
      expect(vitestVersion).toMatch(/^\d+\.\d+\.\d+$|^\^\d+\.\d+\.\d+$/);
    });

    it('should verify MSW can create a basic handler', async () => {
      const { http } = await import('msw');

      const handler = http.get('/api/test', () => {
        return new Response(JSON.stringify({ message: 'test' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      });

      expect(handler).toBeDefined();
      expect(handler.info).toBeDefined();
      expect(handler.info.method).toBe('GET');
    });
  });
});
