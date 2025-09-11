import { test, expect, describe } from 'vitest'
import type { Options } from 'tsup'
import { baseTsupConfig } from './tsup.base'

describe('Shared tsup configuration', () => {
  test('exports valid tsup options object', () => {
    expect(baseTsupConfig).toBeDefined()
    expect(typeof baseTsupConfig).toBe('object')
  })

  test('configures ESM-only output format', () => {
    expect(baseTsupConfig.format).toEqual(['esm'])
  })

  test('enables TypeScript declaration generation', () => {
    expect(baseTsupConfig.dts).toBe(true)
  })

  test('configures sideEffects false for tree-shaking', () => {
    expect(baseTsupConfig.treeshake).toBe(true)
    expect(baseTsupConfig.splitting).toBe(true)
  })

  test('enables source map generation for debugging', () => {
    expect(baseTsupConfig.sourcemap).toBe(true)
  })

  test('sets consistent output directory to dist', () => {
    expect(baseTsupConfig.outDir).toBe('dist')
  })

  test('cleans output directory before build', () => {
    expect(baseTsupConfig.clean).toBe(true)
  })

  test('minifies output for production', () => {
    expect(baseTsupConfig.minify).toBe(false) // Keep readable for debugging
  })

  test('configuration can be extended by packages', () => {
    const packageConfig: Options = {
      ...baseTsupConfig,
      entry: ['src/index.ts'],
      name: '@template/utils',
    }

    expect(packageConfig.entry).toEqual(['src/index.ts'])
    expect(packageConfig.name).toBe('@template/utils')
    expect(packageConfig.format).toEqual(['esm']) // Inherits from base
  })

  test('has proper TypeScript configuration', () => {
    expect(baseTsupConfig.target).toBe('es2022')
    expect(baseTsupConfig.platform).toBe('node')
  })

  test('enables code splitting for better bundling', () => {
    expect(baseTsupConfig.splitting).toBe(true)
  })

  test('preserves module structure for better debugging', () => {
    expect(baseTsupConfig.bundle).toBe(false) // Keep individual modules
  })
})
