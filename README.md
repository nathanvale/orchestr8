# 🚀 Bun Changesets Template

ADHD-optimized Bun + TypeScript monorepo with three focused packages—instant feedback, minimal complexity, production-ready from day one.

## 🎯 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) 1.1.38+
- Node.js 18+ (for some tooling compatibility)

### Development Setup

1. **Install dependencies**
   ```bash
   bun install
   ```

2. **Start the server** (Terminal 1)
   ```bash
   cd apps/server
   bun dev
   ```
   Server starts on http://localhost:3333 (or PORT environment variable)

3. **Test the full-stack connection**
   Open `demo.html` in your browser to see the working API connection and real-time metrics dashboard.

## 🏗️ Architecture

This is a **monorepo-first** template with three focused packages:

```
├── packages/
│   └── utils/          # Shared utilities (number, path, array operations)
├── apps/
│   ├── server/         # Bun HTTP server with telemetry API
│   └── app/            # React telemetry dashboard (Vite)
└── tooling/            # Shared configurations
```

### Package Dependencies
```
apps/server  ← packages/utils
apps/app     ← packages/utils
```

## 📦 Packages Overview

### `packages/utils`
Shared utilities used across server and app:
- Mathematical operations (average, median, percentiles)
- Path utilities and validation
- Array processing helpers
- **Test runner**: Vitest
- **Build target**: Both Bun and Node.js

### `apps/server`
Bun-powered HTTP server with structured logging:
- REST API endpoints (`/api/health`, `/api/metrics`, `/api/logs`, etc.)
- Correlation ID tracking for requests
- Built-in metrics collection
- Real-time log storage and retrieval
- **Test runner**: Bun native (for stability)
- **Runtime**: Bun.serve()

### `apps/app`
React telemetry dashboard:
- Real-time server metrics visualization
- Live log streaming from server
- Uses shared utils for statistical calculations
- **Test runner**: Vitest
- **Build tool**: Vite + React

## 🛠️ Development Commands

### Root Level
```bash
# Install dependencies
bun install

# Run all tests across packages
bunx turbo run test

# Build all packages
bunx turbo run build

# Type check all packages
bunx turbo run typecheck

# Lint all packages
bun run lint
```

### Server (`apps/server/`)
```bash
# Development server with hot reload
bun dev

# Run server tests
bun test

# Build for production
bun run build

# Start production server
bun start
```

### App (`apps/app/`)
```bash
# Development server
bun dev          # Note: May hit esbuild issues, see Known Issues

# Run app tests
bun test

# Build for production
bun run build
```

### Utils (`packages/utils/`)
```bash
# Run tests
bun test

# Build package
bun run build
```

## 🔌 API Endpoints

The server provides these endpoints:

- `GET /` - Server info and available endpoints
- `GET /api/health` - Health check with uptime
- `GET /api/metrics` - Server performance metrics
- `GET /api/logs` - Recent log entries (last 20)
- `POST /api/echo` - Echo request body
- `POST /api/calculate` - Perform calculations on number arrays

### Example Usage
```bash
# Health check
curl http://localhost:3333/api/health

# Get metrics
curl http://localhost:3333/api/metrics

# Calculate statistics
curl -X POST -H "Content-Type: application/json" \
  -d '{"numbers":[1,2,3,4,5,10,20,30]}' \
  http://localhost:3333/api/calculate
```

## 🧪 Testing Strategy

### Mixed Test Runners
This template uses a pragmatic **mixed test runner approach**:

- **`packages/utils`**: Vitest (fast, modern, good for utilities)
- **`apps/server`**: Bun native test runner (avoids esbuild conflicts)  
- **`apps/app`**: Vitest (standard for React apps)

### Why Mixed Runners?

We encountered persistent `esbuild EPIPE` errors when using Vitest with Bun runtime for certain packages. The mixed approach provides:

✅ **Stability**: No exit code 130 crashes  
✅ **Speed**: <50ms feedback loops maintained  
✅ **Pragmatism**: "Actually works" over theoretical purity  

### Running Tests
```bash
# All tests via Turborepo
bunx turbo run test

# Individual packages
cd packages/utils && bun test     # Vitest
cd apps/server && bun test        # Bun native
cd apps/app && bun test           # Vitest (when working)
```

## 🔧 Known Issues & Solutions

### 1. esbuild EPIPE Errors
**Issue**: `Error: The service was stopped: write EPIPE` when running Vitest or Vite with Bun.

**Current Status**: Affects Vite dev server and some Vitest runs.

**Workarounds**:
- Server tests use Bun's native test runner
- Use `demo.html` to test full-stack integration
- Monitor [Vitest + Bun compatibility](https://github.com/vitest-dev/vitest/issues) for improvements

**Diagnostic**: The template includes esbuild diagnostic tools in `vitest.setup.tsx` (enable with `BUN_TEMPLATE_ESBUILD_DIAG=1`).

### 2. Port Conflicts
**Issue**: Multiple services trying to use the same port.

**Solution**: 
- Server defaults to port 3333 (configurable via `PORT` env var)
- App dev server uses port 3000
- Tests use dynamic port allocation (port 0)

### 3. CORS During Development
**Issue**: Browser blocks API requests from different origins.

**Solution**: Server includes CORS headers for development (configure for production).

## 🚀 Production Deployment

### Server
```bash
cd apps/server
bun run build
bun start
```

### App
```bash
cd apps/app
bun run build
# Serve dist/ with your preferred static host
```

### Environment Variables
- `PORT` - Server port (default: 3333)
- `NODE_ENV` - Environment (development/production)
- `VITE_API_URL` - API base URL for app (default: http://localhost:3333)

## 🎨 Features Showcase

### ADHD-Optimized DX
- **<50ms feedback loops**: Bun's speed + optimized test runners
- **Instant startup**: No complex configuration, works immediately
- **Clear structure**: Obvious where code belongs
- **Working examples**: See patterns in action, not just documentation

### Enterprise-Ready Security
- npm provenance with OIDC signing
- Trivy security scanning in CI
- Dependency vulnerability monitoring
- SBOM generation for compliance

### Performance Monitoring
- Built-in telemetry with correlation IDs
- Response time tracking and percentiles
- Memory-efficient log storage
- Real-time metrics dashboard

## 📚 Additional Documentation

- **Server API**: See `apps/server/README.md`
- **Package decisions**: See `.agent-os/product/decisions.md`
- **Architecture diagrams**: See `.agent-os/product/mission.md`

## 🤝 Contributing

1. Follow existing patterns in each package
2. Maintain test coverage for new features  
3. Use the established test runners (mixed approach)
4. Update documentation for user-facing changes
5. Test locally with `demo.html` for full-stack verification

## 📜 License

MIT - See LICENSE file for details.

---

**Built with ❤️ for developers who need fast, working solutions.**