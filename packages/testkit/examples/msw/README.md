# MSW Examples

Runnable examples demonstrating the `@template/testkit/msw` utilities: lifecycle
helpers, handler factories, and configuration patterns.

## Example Files

### 1. [Basic Setup](./01-basic-setup.test.ts)

Fundamental server bootstrap

- Registers a simple health handler
- Verifies JSON success response
- Shows default per‑test handler reset

### 2. [Pagination](./02-pagination.test.ts)

Slice & metadata generation

- Uses `createPaginatedHandler`
- Asserts length, page, and navigation flags

### 3. [Auth Flow](./03-auth-flow.test.ts)

Session lifecycle

- Login + token issuance
- Protected `/auth/me` endpoint access
- Unauthorized path coverage

### 4. [CRUD Resource](./04-crud-resource.test.ts)

In‑memory data mutations

- List + create operations
- Demonstrates status codes and body shapes

### 5. [Unreliable & Network Issues](./05-unreliable-network.test.ts)

Failure simulation

- Randomized unreliable endpoint
- Forced network issue variants

## Common Patterns

- Prefer `setupMSW` for automatic lifecycle management
- Use `createTestScopedMSW` when you need isolated per‑suite state
- Keep tests deterministic: avoid asserting random outputs directly (assert
  shape)
- Set `MSW_ON_UNHANDLED_REQUEST=error` during development to catch gaps early

## Running Examples

Filter to the testkit package or run repo tests normally. These examples live in
source only (not published) but import from the public subpath for fidelity.

## References

- Guide: `docs/guides/msw-testkit.md`
- Conventions: `docs/guides/examples-conventions.md`
- Upstream: [mswjs.io](https://mswjs.io)
