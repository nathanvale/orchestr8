# Development Best Practices

## Context

Global development guidelines for Agent OS projects.

<conditional-block context-check="core-principles">
IF this Core Principles section already read in current context:
  SKIP: Re-reading this section
  NOTE: "Using Core Principles already in context"
ELSE:
  READ: The following principles

## Core Principles

### Keep It Simple

- Implement code in the fewest lines possible
- Avoid over-engineering solutions
- Choose straightforward approaches over clever ones

### Optimize for Readability

- Prioritize code clarity over micro-optimizations
- Write self-documenting code with clear variable names
- Add comments for "why" not "what"

### DRY (Don't Repeat Yourself)

- Extract repeated business logic to private methods
- Extract repeated UI markup to reusable components
- Create utility functions for common operations

### File Structure

- Keep files focused on a single responsibility
- Group related functionality together
- Use consistent naming conventions

## Testing Conventions

### Unit Testing Mandate

- **Rule**: Wallaby.js MUST be running before writing or debugging any unit tests
- **Exception**: CI/CD environments only
- **Enforcement**: This rule overrides ALL other testing preferences
- ❌ `pnpm test` - Use Wallaby instead
- ❌ `vitest watch` - Use Wallaby instead
- ❌ `npm test -- --watch` - Use Wallaby instead
- ❌ `vitest --ui` - Use Wallaby instead

### Test File Naming Rules

#### Unit Tests

- **Pattern**: `[ComponentName].unit.test.ts`
- **Location**: Colocated with source files
- **Examples**:
- ✅ `UserService.unit.test.ts`
- ✅ `parseConfig.unit.test.ts`
- ❌ `UserService.test.ts` (missing type suffix)
- ❌ `UserService.spec.ts` (wrong type suffix)

#### Integration Tests

- **Pattern**: `[FeatureName].integration.test.ts`
- **Location**: Root `tests/` directory
- **Examples**:
- ✅ `auth-flow.integration.test.ts`
- ✅ `api-endpoints.integration.test.ts`
- ❌ `src/auth.integration.test.ts` (wrong location)

#### E2E Tests

- **Pattern**: `[UserFlow].e2e.test.ts`
- **Location**: Root `tests/` directory
- **Examples**:
- ✅ `checkout-process.e2e.test.ts`
- ✅ `user-onboarding.e2e.test.ts`

#### Slow Tests

- **Pattern**: `[FeatureName].slow.test.ts`
- **Location**: Root `tests/` directory
- **Note**: For tests that exceed 500ms but are necessary

### Test Method Naming Rules

#### Pattern

`should_[expectedBehavior]_when_[condition]`

#### Examples

- `should_return_user_data_when_valid_id_provided`
- `should_throw_error_when_user_not_found`

#### Anti-patterns (Forbidden)

- ❌ `test user data` - No behavior description
- ❌ `it works` - Too vague
- ❌ `shouldReturnUser` - Uses camelCase
- ❌ `should_return_user` - Missing when clause

</conditional-block>

<conditional-block context-check="dependencies" task-condition="choosing-external-library">
IF current task involves choosing an external library:
  IF Dependencies section already read in current context:
    SKIP: Re-reading this section
    NOTE: "Using Dependencies guidelines already in context"
  ELSE:
    READ: The following guidelines
ELSE:
  SKIP: Dependencies section not relevant to current task

## Dependencies

### Choose Libraries Wisely

When adding third-party dependencies:

- Select the most popular and actively maintained option
- Check the library's GitHub repository for:
  - Recent commits (within last 6 months)
  - Active issue resolution
  - Number of stars/downloads
  - Clear documentation
</conditional-block>
