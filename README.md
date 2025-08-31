# 🚀 Node.js + pnpm Changesets Template

ADHD-optimized Node.js + pnpm monorepo with Next.js, Turborepo orchestration,
and standardized package builds—production-ready from day one with sub-5s
feedback loops.

## 🎯 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20 LTS+
- [pnpm](https://pnpm.io/) 9+

### Development Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Start the server** (Terminal 1)

   ```bash
   cd apps/server
   pnpm dev
   ```

   Server starts on http://localhost:3333 (or PORT environment variable)

3. **Start Next.js app** (Terminal 2)

   ```bash
   cd apps/web
   pnpm dev
   ```

   Next.js app starts on http://localhost:3000

4. **Test the full-stack connection** Open http://localhost:3000 to see the
   working API connection and real-time metrics dashboard.

## 🏗️ Architecture

This is a **monorepo-first** template with three focused packages:

```
├── packages/
│   └── utils/          # Shared utilities (number, path, array operations)
├── apps/
│   ├── server/         # Node.js HTTP server with telemetry API
│   ├── web/            # Next.js application with App Router
│   └── app/            # React telemetry dashboard (Vite)
└── tooling/            # Shared configurations
```

### Package Dependencies

```
apps/server  ← packages/utils
apps/web     ← packages/utils
apps/app     ← packages/utils
```

## 📦 Packages Overview

### `packages/utils`

Shared utilities used across server and apps:

- Mathematical operations (average, median, percentiles)
- Path utilities and validation
- Array processing helpers
- **Test runner**: Vitest
- **Build target**: ESM + CJS with tsup

### `apps/server`

Node.js HTTP server with structured logging:

- REST API endpoints (`/api/health`, `/api/metrics`, `/api/logs`, etc.)
- Correlation ID tracking for requests
- Built-in metrics collection
- Real-time log storage and retrieval
- **Test runner**: Vitest
- **Runtime**: Node.js with Express/Fastify

### `apps/web`

Next.js application with App Router:

- Server-side rendering and React Server Components
- API route handlers for server endpoints
- Built-in caching and revalidation
- **Test runner**: Vitest
- **Build tool**: Next.js 15+

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
pnpm install

# Run all tests across packages
pnpm test

# Build all packages (Pure ESM with TypeScript)
pnpm build

# Type check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Validate everything (tests, types, lint)
pnpm validate

# Troubleshoot build issues
pnpm dx:status
```

### Build System Commands

```bash
# Validate module imports
node -e "import('@template/utils')"

# Check type declarations
test -f dist-types/index.d.ts

# Build performance profiling
time pnpm build

# Turborepo cache status
turbo run build --dry-run
```

### Server (`apps/server/`)

```bash
# Development server with hot reload
pnpm dev

# Run server tests
pnpm test

# Build for production
pnpm build

# Start production server
pnpm start
```

### Next.js App (`apps/web/`)

```bash
# Development server
pnpm dev

# Run app tests
pnpm test

# Build for production
pnpm build

# Start production server
pnpm start
```

### React App (`apps/app/`)

```bash
# Development server
pnpm dev

# Run app tests
pnpm test

# Build for production
pnpm build
```

### Utils (`packages/utils/`)

```bash
# Run tests
pnpm test

# Build package
pnpm build
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

### Unified Vitest Configuration

This template uses a **unified Vitest approach** across all packages:

- **Root-level config**: `vitest.config.ts` with multi-project support
- **Package-specific environments**: Node.js for server, jsdom for React apps
- **Coverage aggregation**: Combined coverage reports across all packages
- **Fast feedback**: <5s test runs with intelligent caching

### Running Tests

```bash
# All tests via root command
pnpm test

# Watch mode for development
pnpm test:watch

# Coverage reporting
pnpm test:coverage

# Individual packages
cd packages/utils && pnpm test
cd apps/server && pnpm test
cd apps/web && pnpm test
cd apps/app && pnpm test
```

## 🚀 Production Deployment

### Next.js App (`apps/web`)

Deploy to Vercel, Netlify, or any Next.js-compatible platform:

```bash
cd apps/web
pnpm build
pnpm start
```

### Server (`apps/server`)

Deploy to any Node.js hosting platform:

```bash
cd apps/server
pnpm build
pnpm start
```

### Environment Variables

- `PORT` - Server port (default: 3333)
- `NODE_ENV` - Environment (development/production)
- `VITE_API_URL` - API base URL for Vite app (default: http://localhost:3333)
- `NEXT_PUBLIC_API_URL` - API base URL for Next.js (default:
  http://localhost:3333)

## 🎨 Features Showcase

### ADHD-Optimized DX

- **Sub-5s feedback loops**: Instant test results with Vitest and Wallaby.js
  integration
- **Zero-config scaffolding**: `pnpm gen:package` creates new packages instantly
- **Status at a glance**: `pnpm dx:status` shows pending changesets, coverage,
  outdated deps
- **Flow accelerators**: Clear structure, working examples, minimal
  configuration

### Enterprise-Ready Foundation

- **Standardized builds**: Shared tsup configuration across all packages
- **Type safety**: Strict TypeScript with proper export maps
- **Security**: Dependency scanning, vulnerability alerts, SBOM generation
- **Performance**: Turborepo caching with >85% hit rates

### Modern Development Stack

- **Node.js ecosystem**: Mature, stable, battle-tested in production
- **pnpm workspaces**: Fast, efficient dependency management
- **Next.js 15**: App Router, React Server Components, built-in optimization
- **Vitest**: Fast, modern testing with native TypeScript support

## 📚 Additional Documentation

- **Next.js App**: See `apps/web/` for App Router examples
- **Server API**: See `apps/server/README.md`
- **Product roadmap**: See `.agent-os/product/roadmap.md`
- **Architecture decisions**: See `.agent-os/product/decisions.md`

## 🤝 Contributing

1. Follow existing patterns in each package
2. Maintain test coverage for new features
3. Use Vitest for all new tests
4. Update documentation for user-facing changes
5. Test locally across all packages with `pnpm validate`
6. Refer to `MIGRATION-NOTES.md` for build system details
7. Check `TROUBLESHOOTING.md` if you encounter build issues

### Build System

- Pure ESM build using TypeScript compiler
- <2s build times with Turborepo caching
- Type declarations generated separately
- Optimized for tree-shaking and modern tooling

### Recommended Workflow

```bash
# Validate everything before committing
pnpm validate

# Build all packages
pnpm build

# Troubleshoot build issues
pnpm dx:status
```

## 📜 License

MIT - See LICENSE file for details.

---

**Built with ❤️ for developers who need fast, focused, production-ready
solutions.**
