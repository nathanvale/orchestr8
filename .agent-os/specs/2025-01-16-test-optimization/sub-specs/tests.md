## Unit Test Requirements

### Authentication Tests

- Password hashing works correctly
- JWT generation includes required claims
- Token validation rejects expired tokens
- Email validation catches invalid formats

## Integration Test Requirements

### API Endpoint Tests

- User registration creates database record
- Login returns valid JWT
- Protected routes require valid token
- Rate limiting blocks excessive requests

## Test Coverage Targets

- Unit tests: 90% coverage minimum
- Integration tests: All happy paths + main error cases
- E2E tests: Critical user journeys

## Test Data Fixtures

```javascript
const testUsers = [
  { email: 'test@example.com', password: 'Test123!', name: 'Test User' },
  { email: 'admin@example.com', password: 'Admin123!', name: 'Admin User' }
];
