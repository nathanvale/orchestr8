---
created: 2025-09-18T07:32:12Z
last_updated: 2025-09-18T07:32:12Z
version: 1.0
author: Claude Code PM System
---

# Project Style Guide

## Code Style Philosophy

Write code that is immediately understandable, requires minimal cognitive load
to parse, and maintains consistency across the entire codebase. Optimize for
readability over cleverness.

## TypeScript Conventions

### General Rules

- Use TypeScript strict mode always
- Prefer explicit types over inference for public APIs
- Avoid `any` - use `unknown` when type is truly unknown
- Enable all strict flags in tsconfig

### Naming Conventions

#### Files

- Components: `PascalCase.tsx` (e.g., `UserProfile.tsx`)
- Utilities: `kebab-case.ts` (e.g., `format-date.ts`)
- Types: `*.types.ts` (e.g., `user.types.ts`)
- Constants: `*.constants.ts` (e.g., `api.constants.ts`)
- Tests: `*.test.ts` or `*.spec.ts`
- Integration tests: `*.integration.test.ts`

#### Variables & Functions

```typescript
// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3
const API_BASE_URL = 'https://api.example.com'

// Variables: camelCase
const userData = fetchUser()
const isLoading = true

// Functions: camelCase, verb-first
function calculateTotal(items: Item[]): number
async function fetchUserData(id: string): Promise<User>

// Boolean naming: is/has/should prefix
const isActive = true
const hasPermission = false
const shouldUpdate = true
```

#### Types & Interfaces

```typescript
// Interfaces: PascalCase, prefer Interface suffix for clarity
interface UserInterface {
  id: string
  name: string
}

// Types: PascalCase
type UserRole = 'admin' | 'user' | 'guest'

// Enums: PascalCase (members: UPPER_SNAKE_CASE)
enum Status {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
```

### Import Organization

```typescript
// Order: External → Internal → Types → Styles
// 1. Node built-ins
import { readFile } from 'node:fs/promises'
import path from 'node:path'

// 2. External packages
import React from 'react'
import { render } from '@testing-library/react'

// 3. Internal packages (monorepo)
import { formatNumber } from '@template/utils'

// 4. Relative imports
import { UserCard } from './components/UserCard'
import { api } from './services/api'

// 5. Types
import type { User, UserRole } from './types'

// 6. Styles/assets (if applicable)
import styles from './styles.module.css'
```

## Function Patterns

### Pure Functions Preferred

```typescript
// Good: Pure, predictable, testable
function addTax(price: number, taxRate: number): number {
  return price * (1 + taxRate)
}

// Avoid: Side effects in computational functions
function addTaxAndLog(price: number, taxRate: number): number {
  const total = price * (1 + taxRate)
  console.log(`Calculated: ${total}`) // Side effect
  return total
}
```

### Async/Await Over Promises

```typescript
// Good: Clear, linear flow
async function fetchUserWithPosts(userId: string) {
  const user = await fetchUser(userId)
  const posts = await fetchPosts(user.id)
  return { user, posts }
}

// Avoid: Promise chains
function fetchUserWithPosts(userId: string) {
  return fetchUser(userId).then((user) =>
    fetchPosts(user.id).then((posts) => ({ user, posts })),
  )
}
```

### Error Handling

```typescript
// Good: Explicit error handling
async function safeApiCall<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`API error: ${response.status}`)
      return null
    }
    return await response.json()
  } catch (error) {
    console.error('Network error:', error)
    return null
  }
}

// Use Result pattern for complex errors
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }
```

## Testing Conventions

### Test Structure

```typescript
// Describe blocks for logical grouping
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a user with valid data', async () => {
      // Arrange
      const userData = { name: 'John', email: 'john@example.com' }

      // Act
      const user = await createUser(userData)

      // Assert
      expect(user).toHaveProperty('id')
      expect(user.name).toBe('John')
    })

    it('should throw error for invalid email', async () => {
      // Test error cases explicitly
      await expect(createUser({ email: 'invalid' })).rejects.toThrow(
        'Invalid email',
      )
    })
  })
})
```

### Test Naming

- Use descriptive test names that explain the scenario
- Start with "should" for behavior descriptions
- Include the condition being tested
- Specify the expected outcome

## Comments & Documentation

### When to Comment

```typescript
// Good: Explain WHY, not WHAT
// Use 4GB heap to prevent OOM during large builds
NODE_OPTIONS = '--max-old-space-size=4096'

// Good: Complex business logic
// Calculate compound interest using daily compounding
// to match bank's methodology (see: SPEC-123)
function calculateInterest(principal: number, rate: number, days: number) {
  return principal * Math.pow(1 + rate / 365, days) - principal
}

// Avoid: Obvious comments
// Set user name
user.name = 'John' // Unnecessary
```

### JSDoc for Public APIs

```typescript
/**
 * Formats a number as currency with proper locale support
 *
 * @param amount - The numeric amount to format
 * @param currency - ISO 4217 currency code (default: 'USD')
 * @param locale - BCP 47 locale identifier (default: 'en-US')
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1234.56) // "$1,234.56"
 * formatCurrency(1234.56, 'EUR', 'de-DE') // "1.234,56 €"
 */
export function formatCurrency(
  amount: number,
  currency = 'USD',
  locale = 'en-US',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}
```

## Git Conventions

### Commit Messages

Follow Conventional Commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

Examples:

```bash
feat(auth): add OAuth2 login support
fix(build): resolve TypeScript compilation error in utils
docs: update README with new setup instructions
test(user): add integration tests for user service
```

### Branch Naming

```
feature/description-of-feature
fix/description-of-bug
chore/description-of-task
release/version-number
```

## File Structure

### Component Structure

```typescript
// UserCard.tsx
import React from 'react'
import type { User } from '../types'

interface UserCardProps {
  user: User
  onClick?: (user: User) => void
}

export function UserCard({ user, onClick }: UserCardProps) {
  return (
    <div onClick={() => onClick?.(user)}>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  )
}
```

### Barrel Exports

```typescript
// packages/utils/src/index.ts
export * from './number'
export * from './string'
export * from './date'
export { formatCurrency as default } from './currency'
```

## Performance Patterns

### Lazy Loading

```typescript
// Dynamic imports for code splitting
const HeavyComponent = lazy(() => import('./HeavyComponent'))

// Conditional module loading
if (process.env.NODE_ENV === 'development') {
  const { setupDevTools } = await import('./dev-tools')
  setupDevTools()
}
```

### Memoization

```typescript
// Use when appropriate, not by default
const expensiveValue = useMemo(
  () => calculateExpensiveValue(props.data),
  [props.data],
)

const memoizedCallback = useCallback(() => doSomething(value), [value])
```

## ADHD-Optimized Patterns

### Reduce Visual Noise

- Keep files under 200 lines
- Use consistent spacing (2 spaces)
- Group related code together
- Avoid deep nesting (max 3 levels)

### Clear Code Organization

- One concept per file
- Explicit naming over brevity
- Consistent patterns throughout
- Early returns to reduce complexity

### Minimal Configuration

- Use defaults where possible
- Document any deviations clearly
- Keep config files small
- Inherit from shared configs

## Forbidden Patterns

### Never Do This

```typescript
// ❌ No console.log in production code
console.log('Debug:', data) // Use proper logging

// ❌ No any type
let data: any = fetchData() // Use unknown or specific type

// ❌ No magic numbers
if (retries > 3) {
} // Use named constant

// ❌ No implicit any
function process(data) {} // Add types

// ❌ No var keyword
var oldStyle = true // Use const/let

// ❌ No == comparison
if (value == null) {
} // Use ===
```

## Enforcement

These conventions are enforced through:

- TypeScript compiler settings
- ESLint rules
- Prettier formatting
- Pre-commit hooks
- Code review guidelines

Follow the existing patterns in the codebase. When in doubt, optimize for
readability and maintainability over cleverness or brevity.
