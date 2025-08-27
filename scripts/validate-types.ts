#!/usr/bin/env bun
/**
 * Validates that type declarations are generated correctly for all exports.
 * Ensures every exported module has corresponding type definitions.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import packageJson from '../package.json';

const errors: string[] = [];

// Check main types file exists
const mainTypesPath = join(process.cwd(), packageJson.types);
if (!existsSync(mainTypesPath)) {
  errors.push(`Main types file missing: ${packageJson.types}`);
}

// Check exports types
if (packageJson.exports) {
  for (const [key, value] of Object.entries(packageJson.exports)) {
    if (typeof value === 'object' && value !== null && 'types' in value) {
      const typesPath = join(process.cwd(), value.types as string);
      if (!existsSync(typesPath)) {
        errors.push(`Export "${key}" types missing: ${value.types}`);
      }

      // Also check that the corresponding JS files exist
      if ('import' in value) {
        const importPath = join(process.cwd(), value.import as string);
        if (!existsSync(importPath)) {
          errors.push(`Export "${key}" import file missing: ${value.import}`);
        }
      }

      if ('bun' in value) {
        const bunPath = join(process.cwd(), value.bun as string);
        if (!existsSync(bunPath)) {
          errors.push(`Export "${key}" bun file missing: ${value.bun}`);
        }
      }
    }
  }
}

// Check that dist-types directory exists
const distTypesDir = join(process.cwd(), 'dist-types');
if (!existsSync(distTypesDir)) {
  errors.push('dist-types directory missing - run "bun run build:types" first');
}

// Report results
if (errors.length > 0) {
  console.error('❌ Type validation failed:');
  errors.forEach((error) => console.error(`   • ${error}`));
  process.exit(1);
} else {
  console.log('✅ Type validation passed: All type declarations present');
}
