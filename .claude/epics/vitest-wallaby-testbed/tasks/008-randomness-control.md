---
task: 008
name: Create randomness control utilities
status: closed
created: 2025-09-20T03:22:42Z
updated: 2025-09-23T15:00:00Z
---

# Task 008: Create randomness control utilities

## Status: ✅ COMPLETED

## Implementation Summary

Full randomness control suite with deterministic generators and factories.

### Core Implementation

- ✅ `src/env/random.ts` - Math.random control
- ✅ `src/env/crypto-mock.ts` - Crypto API mocking
- ✅ `src/env/generators.ts` - Deterministic data generators
- ✅ `src/env/factories.ts` - Test data factories
- ✅ `src/env/seed.ts` - Seed management

### Features Implemented

#### Math.random Control

- Seeded random number generation
- Sequence control and repeatability
- Global and localized mocking
- Restore without affecting other mocks

#### Crypto API Mocking

- `crypto.randomUUID()` mocking (sequential, seeded, fixed)
- `crypto.getRandomValues()` deterministic implementation
- Support for all typed array types
- Browser and Node.js compatibility

#### Data Generators (30+ methods)

- Names (first, last, full, usernames)
- Emails and addresses
- Phone numbers and dates
- Lorem ipsum text
- Credit cards with Luhn validation
- Colors, URLs, file paths
- JSON data and collections

#### Test Data Factories

- Factory pattern with build/buildMany
- Builder pattern for complex objects
- Trait system for variations
- Associations between factories
- Registry for factory management

### P0 Bug Fix (Completed)

- ✅ Fixed overreaching restore that affected all mocks
- ✅ Made restore localized to randomness only
- ✅ Idempotent restore operations

### Environment Support

- `TEST_SEED` environment variable
- Seed logging for reproducibility
- CI-friendly deterministic mode

## Verification

- All 30 tests passing
- Deterministic sequences verified
- Crypto mocking working
- Factory system operational
- No mock leakage between tests
