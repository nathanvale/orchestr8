# Technical Specification

# Location: .agent-os/specs/2025-01-16-test-optimization/sub-specs/technical-spec.md

## API Endpoints

### POST /api/users/register

- Accepts: { email, password, name }
- Returns: { id, email, name, token }
- Validation: Email format, password strength

### POST /api/users/login

- Accepts: { email, password }
- Returns: { token, user }
- Security: Rate limiting, bcrypt

### GET /api/users/:id

- Headers: Authorization Bearer token
- Returns: User object
- Auth: JWT validation

## Database Schema

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

### Security Requirements

 - Passwords hashed with bcrypt (10 rounds)
 - JWTs expire after 24 hours
 - Rate limiting: 5 requests per minute per IP

 
