#!/usr/bin/env bun
/**
 * Type declaration validator.
 * Ensures each export exposes runtime + matching type artefacts and maps.
 * Lint‑friendly: shallow nesting, no implicit any, explicit return types.
 */

import { existsSync } from 'node:fs';
import { join, normalize } from 'node:path';
import packageJson from '../package.json';

interface PackageJsonExportsEntry {
  readonly bun?: string;
  readonly import?: string;
  readonly types?: string;
  readonly default?: string;
}

type PackageJsonExports = Record<string, PackageJsonExportsEntry | string>;

interface ValidationResult {
  readonly errors: string[];
  readonly warnings: string[];
}

const cwd = process.cwd();

/** Basic path sanitiser to reduce security rule noise & guard traversal */
function resolveProjectPath(relativePath: string): string {
  // Reject attempts to traverse outside project root
  if (relativePath.includes('..')) {
    throw new Error(`Refusing path containing traversal: ${relativePath}`);
  }
  return join(cwd, normalize(relativePath));
}

function checkBuildDirs(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const required = [
    { path: 'dist-types', err: 'dist-types directory missing - run "bun run build:types" first' },
    { path: 'dist-node', err: 'dist-node directory missing - run "bun run build:node" first' },
  ] as const;
  for (const item of required) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(resolveProjectPath(item.path))) errors.push(item.err);
  }
  // Optional Bun target
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(resolveProjectPath('dist'))) {
    warnings.push('dist directory missing - run "bun run build" for Bun target');
  }
  return { errors, warnings };
}

function checkMainTypes(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mainTypes = packageJson.types;
  const mainTypesPath = resolveProjectPath(mainTypes);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(mainTypesPath)) {
    errors.push(`Main types file missing: ${mainTypes}`);
    return { errors, warnings };
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(`${mainTypesPath}.map`)) {
    warnings.push(`Type declaration map missing: ${mainTypes}.map`);
  }
  const exportsRoot = (packageJson.exports as PackageJsonExports | undefined)?.['.'];
  if (
    exportsRoot !== undefined &&
    typeof exportsRoot === 'object' &&
    exportsRoot.types !== undefined &&
    exportsRoot.types !== mainTypes
  ) {
    errors.push(
      `Mismatch: package.json "types" (${mainTypes}) != exports['.'].types (${exportsRoot.types})`,
    );
  }
  return { errors, warnings };
}

function validateExportTypes(
  key: string,
  entry: PackageJsonExportsEntry,
  errors: string[],
  warnings: string[],
): void {
  if (entry.types === undefined || entry.types === '') {
    warnings.push(`Export "${key}" missing "types" field`);
    return;
  }
  const typesPath = resolveProjectPath(entry.types);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(typesPath)) {
    errors.push(`Export "${key}" types missing: ${entry.types}`);
    return;
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(`${typesPath}.map`)) {
    warnings.push(`Export "${key}" types map missing: ${entry.types}.map`);
  }
}

function validateExportRuntime(
  key: string,
  entry: PackageJsonExportsEntry,
  errors: string[],
  warnings: string[],
): void {
  if (entry.import !== undefined && entry.import !== '') {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(resolveProjectPath(entry.import))) {
      errors.push(`Export "${key}" import file missing: ${entry.import}`);
    }
  }
  if (entry.bun !== undefined && entry.bun !== '') {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(resolveProjectPath(entry.bun))) {
      warnings.push(`Export "${key}" bun file missing: ${entry.bun}`);
    }
  }
}

function checkExports(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const exportsField = packageJson.exports as PackageJsonExports | undefined;
  if (exportsField === undefined) return { errors, warnings };
  for (const [key, raw] of Object.entries(exportsField)) {
    if (typeof raw === 'string') continue;
    validateExportTypes(key, raw, errors, warnings);
    validateExportRuntime(key, raw, errors, warnings);
  }
  return { errors, warnings };
}

function mergeResults(...parts: ValidationResult[]): ValidationResult {
  return parts.reduce<ValidationResult>(
    (acc, cur) => ({
      errors: acc.errors.concat(cur.errors),
      warnings: acc.warnings.concat(cur.warnings),
    }),
    { errors: [], warnings: [] },
  );
}

function report(result: ValidationResult): void {
  const { errors, warnings } = result;
  if (errors.length > 0) {
    console.error('❌ Type validation failed:');
    for (const msg of errors) console.error(`  • ${msg}`);
  }
  if (warnings.length > 0) {
    console.warn('\n⚠️  Type validation warnings:');
    for (const msg of warnings) console.warn(`  • ${msg}`);
  }
  if (errors.length > 0) {
    console.error('\n💡 Tip: Run "bun run build:all" to generate all build artefacts');
    process.exit(1);
  }
  if (warnings.length > 0) {
    console.info('\n✅ Passed with warnings (see above)');
  } else {
    console.info('✅ Type validation passed – all artefacts present');
  }
}

const result = mergeResults(checkBuildDirs(), checkMainTypes(), checkExports());
report(result);
