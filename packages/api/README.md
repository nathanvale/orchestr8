# API Package

Express.js API server with TypeScript following the test optimization
specification.

## Project Structure

```
packages/api/
├── src/
│   ├── config/         # Configuration files (server.ts)
│   ├── controllers/    # Route handlers (userController.ts)
│   ├── errors/         # Custom error classes (ApiError.ts)
│   ├── middleware/     # Express middleware (errorHandler.ts, rateLimiter.ts)
│   ├── models/         # Data models (User.ts)
│   ├── routes/         # Route definitions (userRoutes.ts)
│   ├── types/          # TypeScript type definitions (user.ts)
│   ├── utils/          # Utility functions (jwt.ts, validation.ts)
│   └── index.ts        # Application entry point
├── tests/              # Test files
│   └── integration/    # Integration tests
└── package.json        # Package configuration
```

## Technology Stack

- **Runtime**: Bun
- **Framework**: Express.js with TypeScript
- **Authentication**: JWT
- **Testing**: Vitest + Supertest
- **Validation**: Zod
- **Security**: Helmet, CORS, Rate limiting

## API Endpoints

- `POST /api/users/register` - User registration
- `POST /api/users/login` - User authentication
- `GET /api/users/:id` - Get user profile (protected)
- `GET /health` - Health check

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Run tests
bun test

# Build for production
bun run build
```
