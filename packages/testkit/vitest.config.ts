import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { createBaseVitestConfig } from './src/config/vitest.base.js'

const cfg = createBaseVitestConfig({
  test: {
    name: 'testkit',
    root: __dirname,
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/register.ts'],
    // Keep discovery local to this package
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'examples/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
    ],
    // Force single fork for CLI tests to ensure shared global state for mocks
    pool: 'forks' as const,
    poolOptions: {
      forks: {
        singleFork: true,
        maxForks: 1,
        minForks: 1,
      },
    },
    // Provide a stable env seed while inheriting base env (NODE_ENV, VITEST)
    env: {
      TEST_SEED: process.env['TEST_SEED'] || '12345',
      DEBUG_TESTKIT: process.env['DEBUG_TESTKIT'] || 'true',
    },
    // Disable coverage locally to avoid threshold noise during focused debugging;
    // CI still enforces thresholds via base config env detection.
    coverage: process.env.CI
      ? undefined
      : {
          provider: 'v8',
          enabled: false,
          reporter: ['text'],
        },
  },
})

// Map published subpath imports back to local sources during package tests
cfg.resolve = cfg.resolve || {}
// Prefer 'vitest' and 'development' conditions for self-imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(cfg.resolve as any).conditions = ['vitest', 'development', 'module', 'default']
// Avoid duplicated instances of the package when self-importing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(cfg.resolve as any).dedupe = ['@orchestr8/testkit']
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(cfg.resolve as any).alias = [
  // e.g. import '@orchestr8/testkit/register' → packages/testkit/src/register.ts
  { find: /^@template\/testkit\/(.*)$/, replacement: resolve(__dirname, 'src/$1') },
  // Explicit mapping to avoid any ambiguity for the register entry
  { find: '@orchestr8/testkit/register', replacement: resolve(__dirname, 'src/register.ts') },
  // e.g. import '@orchestr8/testkit' → packages/testkit/src/index.ts
  { find: '@orchestr8/testkit', replacement: resolve(__dirname, 'src/index.ts') },
]

// Avoid pre-bundling self-imports which can bypass alias/conditions
cfg.optimizeDeps = cfg.optimizeDeps || {}
cfg.optimizeDeps.exclude = [
  ...(cfg.optimizeDeps.exclude || []),
  '@orchestr8/testkit',
  '@orchestr8/testkit/register',
]

// Important: testkit runs its own sources, not the published entry.
// Drop nested projects to avoid the default '@orchestr8/testkit/register' setupFiles in base.
if (cfg.test && 'projects' in cfg.test!) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (cfg.test as any).projects
}

// Hard-override setupFiles to local register to avoid any fallback paths
if (cfg.test) {
  cfg.test.setupFiles = [resolve(__dirname, './src/register.ts')]
}

export default defineConfig(cfg)
