---
task: 019
name: Deny-all network guard
status: open
priority: medium
created: 2025-09-23T15:00:00Z
updated: 2025-09-23T15:00:00Z
---

# Task 019: Deny-all network guard

## Status: ❌ NOT STARTED

## Requirements (from Review)

Implement network blocking for unit test safety.

### Planned Implementation
```typescript
// src/network/deny-all.ts
export function installNetworkDenyGuard(): void {
  // Block all network requests except MSW
}

export function uninstallNetworkDenyGuard(): void {
  // Restore network access
}
```

### Features
- Block all outbound network requests
- Exception for MSW mocked requests
- Environment variable control: `TESTKIT_DENY_NET=1`
- Integration with register.ts
- Clear error messages for blocked requests

### Integration Points
1. Add to register.ts beforeAll hooks
2. Check TESTKIT_DENY_NET environment variable
3. Provide opt-out mechanism
4. Document in mocking policy

### Implementation Approach
- Override fetch, http, https modules
- Throw descriptive errors
- Allow MSW passthrough
- Track blocked attempts for reporting

## Use Cases
- Prevent accidental external API calls
- Enforce mocking policy
- Catch missing mocks early
- CI safety net

## Testing
- Verify network blocking works
- Confirm MSW requests pass through
- Test environment variable control
- Validate error messages