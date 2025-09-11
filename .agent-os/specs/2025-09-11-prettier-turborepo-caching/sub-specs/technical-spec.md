# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-09-11-prettier-turborepo-caching/spec.md

> Created: 2025-09-11 Version: 1.0.0

## Technical Requirements

### Core Configuration Architecture

- Implement root-level Prettier configuration with centralized `.prettierrc`
  file
- Configure Turborepo dual-hash caching mechanism using HMAC-SHA256 signatures
- Set up composite cache keys combining file content hashes, environment
  variables, task dependencies, and configuration files
- Establish hierarchical cache organization in `.turbo/cache` by workspace and
  task name

### Turborepo Task Configuration

- Configure `format` task with comprehensive input patterns covering all source
  files
- Set up `format:check` task with `$TURBO_DEFAULT$` inputs for broad coverage
- Include configuration files (`.prettierrc*`, `.prettierignore`,
  `package.json`) in inputs array
- Configure output logs with `errors-only` for CI and `new-only` for development
- Implement task dependencies ensuring format runs before lint operations

### Cache Performance Optimization

- Target 80%+ cache hit rates for unchanged packages
- Configure LRU eviction policies for local cache management
- Implement content-aware hashing that ignores file metadata
- Set up parallel task execution across available CPU cores
- Enable incremental formatting with `--affected` flag support

### Remote Cache Integration

- Configure Vercel Remote Cache with zero-configuration setup for initial
  deployment
- Implement HMAC-SHA256 artifact signing using
  `TURBO_REMOTE_CACHE_SIGNATURE_KEY`
- Set up team-based authentication with JWT tokens
- Configure parallel uploads/downloads for optimal performance
- Support content-addressed storage to prevent duplicate artifacts

### Git Integration for Incremental Formatting

- Implement `--affected` flag support for Turborepo 2.1+
- Configure `TURBO_SCM_BASE` environment variable for CI environments
- Set up filter patterns for branch comparisons
- Enable workspace-level filtering for targeted operations
- Support fetch-depth: 2 in CI checkout for proper change detection

### CI/CD Pipeline Configuration

- Configure GitHub Actions with `TURBO_TOKEN` and `TURBO_TEAM` environment
  variables
- Implement cache warming strategies for commonly used packages
- Set up matrix strategies for parallel test execution
- Configure platform-specific concurrency tuning
- Support OIDC authentication for AWS S3 remote cache deployments

### Performance Monitoring

- Implement cache hit rate tracking and reporting
- Configure Turborepo analytics for performance insights
- Set up invalidation pattern monitoring
- Track time savings metrics for formatting operations
- Monitor remote cache upload/download performance

### Developer Experience

- Configure IDE formatting to work alongside Turborepo caching
- Implement format-on-save for immediate feedback
- Set up pre-commit hooks with direct Prettier execution
- Configure proper path resolution for monorepo structures
- Support VSCode workspace settings for consistent formatting

## Approach

The implementation follows a phased approach starting with local caching
optimization, followed by remote cache integration. The architecture leverages
Turborepo's native caching capabilities with minimal configuration overhead.

Key design principles:

- Zero-configuration setup where possible
- Incremental adoption with fallback to existing formatting
- Performance-first approach with monitoring capabilities
- Developer experience optimization through IDE integration

## External Dependencies

**Turborepo** - Version 2.1+ required for --affected flag support
**Justification:** Core requirement for caching infrastructure and incremental
build capabilities **Example CLI Usage:**

- `turbo run <tasks> --affected` - Run tasks only for changed packages
- `turbo ls --affected` - List affected packages based on git changes

**Prettier** - Version 3.6+ recommended (minimum 3.3+ if backward compatibility
needed) **Justification:** Version 3.6.2 (stable as of 2025-09-11) provides best
performance and compatibility with Turborepo caching

**Vercel Remote Cache** - Managed service (no npm package required)
**Configuration:** Use Turbo CLI (`turbo login` / `turbo link`) or enable in
Vercel dashboard **Required Environment Variables:**

- `TURBO_TOKEN` - Authentication token for remote cache access
- `TURBO_TEAM` - Team identifier for cache scoping **Optional Environment
  Variables:**
- `TURBO_REMOTE_CACHE_SIGNATURE_KEY` - For cache signature verification

Note: No new dependencies are required for basic implementation as the project
already uses pnpm, TypeScript, and has Prettier installed. Remote caching can be
configured incrementally through Vercel's managed service.
