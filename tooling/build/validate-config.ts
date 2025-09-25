import { baseTsupConfig, createTsupConfig } from './tsup.base.js'
import type { Options } from 'tsup'

console.log('🔍 Validating shared tsup configuration...')

// Test 1: Basic configuration export
if (!baseTsupConfig) {
  throw new Error('❌ baseTsupConfig is not exported')
}
console.log('✅ baseTsupConfig exports successfully')

// Test 2: ESM-only format
if (!Array.isArray(baseTsupConfig.format) || !baseTsupConfig.format.includes('esm')) {
  throw new Error('❌ ESM format not configured correctly')
}
console.log('✅ ESM-only format configured')

// Test 3: TypeScript declarations
if (baseTsupConfig.dts !== true) {
  throw new Error('❌ TypeScript declarations not enabled')
}
console.log('✅ TypeScript declarations enabled')

// Test 4: Tree-shaking configuration
if (baseTsupConfig.treeshake !== true || baseTsupConfig.splitting !== true) {
  throw new Error('❌ Tree-shaking not properly configured')
}
console.log('✅ Tree-shaking optimizations enabled')

// Test 5: Source maps for debugging
if (baseTsupConfig.sourcemap !== true) {
  throw new Error('❌ Source maps not enabled')
}
console.log('✅ Source maps enabled for debugging')

// Test 6: Output directory consistency
if (baseTsupConfig.outDir !== 'dist') {
  throw new Error('❌ Output directory not set to dist')
}
console.log('✅ Consistent output directory (dist)')

// Test 7: Clean builds
if (baseTsupConfig.clean !== true) {
  throw new Error('❌ Clean builds not enabled')
}
console.log('✅ Clean builds enabled')

// Test 8: ADHD-friendly debugging (no minification)
if (baseTsupConfig.minify !== false) {
  throw new Error('❌ Minification should be disabled for debugging')
}
console.log('✅ Minification disabled for ADHD-friendly debugging')

// Test 9: Configuration extensibility
const testConfig: Options = createTsupConfig({
  entry: ['src/index.ts'],
  name: '@orchestr8/test',
})

if (testConfig.entry?.[0] !== 'src/index.ts' || testConfig.name !== '@orchestr8/test') {
  throw new Error('❌ Configuration extension not working')
}

if (testConfig.format?.[0] !== 'esm' || testConfig.dts !== true) {
  throw new Error('❌ Base configuration not inherited properly')
}
console.log('✅ Configuration can be extended by packages')

// Test 10: Target and platform settings
if (baseTsupConfig.target !== 'es2022' || baseTsupConfig.platform !== 'node') {
  throw new Error('❌ Target/platform not configured correctly')
}
console.log('✅ Proper TypeScript target and Node.js platform')

console.log('\n🎉 All validation tests passed! Shared tsup configuration is ready.')
console.log('📁 Configuration location: tooling/build/tsup.base.ts')
console.log(
  '🔧 Packages can import with: import { createTsupConfig } from "../../tooling/build/tsup.base.js"',
)
