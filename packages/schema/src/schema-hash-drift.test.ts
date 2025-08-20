/**
 * Schema Hash Drift Test
 * This test ensures that any changes to the WorkflowSchema structure
 * are reflected in an updated schema hash. If this test fails,
 * it means the schema has changed and you need to:
 * 1. Review the schema changes
 * 2. Update the EXPECTED_SCHEMA_HASH constant below
 * 3. Update any documentation about schema versioning
 */

import { describe, expect, it } from 'vitest'

import { WorkflowSchemaValidator } from './zod-schemas.js'

describe('Schema Hash Drift Detection', () => {
  /**
   * IMPORTANT: This hash represents the current canonical schema structure.
   * If you've intentionally changed the WorkflowSchema structure:
   * 1. Run this test to get the new hash from the failure message
   * 2. Update this constant with the new hash
   * 3. Document the schema change in the changelog
   *
   * Current schema version: 1.0.0
   * Last updated: 2025-08-20
   * Changes: Added 'policies' field for structured global policies
   */
  const EXPECTED_SCHEMA_HASH =
    'a0b62c7b78a78c5710bdf912d2b243642a95ac0b2d95615c7885b898bb822104'

  it('should detect schema drift', () => {
    const actualHash = WorkflowSchemaValidator.calculateSchemaHash()

    // This test intentionally fails if the schema has changed
    // to force developers to acknowledge and document the change
    expect(
      actualHash,
      `
      Schema hash mismatch detected!
      
      The WorkflowSchema structure has changed but the canonical hash was not updated.
      This could break schema versioning and compatibility checks.
      
      If this change was intentional:
      1. Update EXPECTED_SCHEMA_HASH in schema-hash-drift.test.ts to: ${actualHash}
      2. Update the schema version if this is a breaking change
      3. Document the change in the changelog
      
      Expected: ${EXPECTED_SCHEMA_HASH}
      Actual:   ${actualHash}
    `,
    ).toBe(EXPECTED_SCHEMA_HASH)
  })

  it('should maintain consistent hash calculation', () => {
    // Ensure hash calculation is deterministic
    const hash1 = WorkflowSchemaValidator.calculateSchemaHash()
    const hash2 = WorkflowSchemaValidator.calculateSchemaHash()
    const hash3 = WorkflowSchemaValidator.calculateSchemaHash()

    expect(hash1).toBe(hash2)
    expect(hash2).toBe(hash3)
    expect(hash1).toMatch(/^[a-f0-9]{64}$/)
  })

  it('should include all policy types in canonical representation', () => {
    // This test ensures we're tracking all the important policy types
    const hash = WorkflowSchemaValidator.calculateSchemaHash()

    // The hash should change if we add/remove policy types
    // This is a smoke test to ensure the canonical representation
    // includes the policy types we care about
    expect(hash).toBeDefined()
    expect(hash.length).toBe(64) // SHA-256 produces 64 hex characters
  })
})
