# Technical Stack

> Last Updated: 2025-09-03 Version: 1.0.0

## Core Technologies

### Application Framework

- **Framework:** Node.js
- **Version:** 20 LTS
- **Language:** TypeScript 5.6+

### Database

- **Primary:** SQLite
- **Version:** 3.40+
- **ORM:** Better-sqlite3

## Frontend Stack

### JavaScript Framework

- **Framework:** React (for dashboard/UI components)
- **Version:** 18+
- **Build Tool:** Vite

### Import Strategy

- **Strategy:** Node.js modules
- **Package Manager:** pnpm
- **Node Version:** 20 LTS

### CSS Framework

- **Framework:** TailwindCSS
- **Version:** 3.4+
- **PostCSS:** Yes

### UI Components

- **Library:** Custom AEPLS Components
- **Version:** Internal
- **Installation:** Via workspace packages

## Quality & Testing

### Quality Tools

- **ESLint:** 8.57+
- **Prettier:** 3.3+
- **TypeScript:** 5.6+
- **Vitest:** 2.1+

### Testing Framework

- **Unit Tests:** Vitest
- **Integration Tests:** Vitest
- **Coverage:** Vitest Coverage

## Architecture Components @architecture.md

### Package Structure

- **Core Package:** @template/quality-check (~440 lines)
- **Architecture:** Facade pattern (core + facades + adapters)
- **Entry Points:** CLI, Hook, Pre-commit, API facades (~50 lines each)

### Hook Integration

- **Location:** ~/.claude/hooks/claude-hook.js (~50 lines)
- **Type:** Thin wrapper calling package facades
- **Format:** PostToolUse hook for Claude Code

### Pattern Detection (Future)

- **When:** Only if patterns consistently emerge
- **Storage:** SQLite (if needed)
- **Complexity:** Added only with evidence

## Assets & Media

### Fonts

- **Provider:** System fonts
- **Loading Strategy:** Native

### Icons

- **Library:** Lucide React
- **Implementation:** React components

## Infrastructure

### Application Hosting

- **Platform:** npm registry
- **Service:** Published packages
- **Region:** Global CDN

### Database Hosting

- **Provider:** Local SQLite
- **Service:** File-based
- **Backups:** User-managed

### Asset Storage

- **Provider:** npm registry
- **CDN:** unpkg/jsdelivr
- **Access:** Public

## Deployment

### Week 1 Deployment

- **Day 1-2:** Refactor package to facades
- **Day 3:** Add autopilot adapter
- **Day 4:** Deploy hook to ~/.claude/hooks
- **Day 5:** Test and monitor

### Package Management

- **Existing Package:** @template/quality-check
- **Refactor Approach:** In-place simplification
- **New Code:** ~150 lines (autopilot + hook)

### Development Approach

- **Phase 1:** Refactor existing package (~440 lines)
- **Phase 2:** Add thin hook wrapper (~50 lines)
- **Phase 3:** Monitor and iterate based on usage

## Code Repository

- **URL:** https://github.com/[org]/aepls
- **Type:** Monorepo with workspace packages
- **Structure:** packages/\* for modular components
