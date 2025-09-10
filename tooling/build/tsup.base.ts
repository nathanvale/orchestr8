import type { Options } from 'tsup'

/**
 * Shared tsup base configuration for all packages in the monorepo.
 *
 * ADHD-Optimized Features:
 * - ESM-only to eliminate module system confusion
 * - Consistent output structure across all packages
 * - Source maps enabled for debugging without complexity
 * - Tree-shaking optimized for performance
 * - No minification to maintain readability during development
 */
export const baseTsupConfig: Options = {
  // Output configuration
  format: ['esm'],
  outDir: 'dist',
  clean: true,

  // TypeScript configuration
  dts: true,
  target: 'es2022',
  platform: 'node',

  // Optimization configuration
  treeshake: true,
  splitting: true,
  bundle: false, // Preserve module structure for debugging
  minify: false, // Keep readable for ADHD-friendly debugging

  // Development configuration
  sourcemap: true,
}

/**
 * Helper function to create package-specific tsup configuration
 * by extending the shared base configuration.
 *
 * @param overrides - Package-specific configuration overrides
 * @returns Complete tsup configuration for the package
 */
export function createTsupConfig(overrides: Partial<Options> = {}): Options {
  return {
    ...baseTsupConfig,
    ...overrides,
  }
}
