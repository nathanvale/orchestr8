# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-22-npm-publishing-distribution/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Technical Requirements

### Dual Module Export Configuration

- Configure package.json `exports` field for conditional module loading
- Build both ESM (.mjs) and CommonJS (.cjs) outputs using TypeScript
- Maintain single source code with dual compilation targets
- Ensure proper TypeScript declaration file generation for both formats
- Support Node.js import/require resolution in all supported versions (18+)

### Changesets Integration

- Install and configure @changesets/cli for the monorepo
- Set up changeset config for public package publishing
- Configure GitHub changelog integration with proper repository linking
- Define internal dependency update strategy (patch level)
- Exclude @orchestr8/testing from automated publishing (internal tool)

### Build Pipeline Enhancement

- Extend existing TypeScript build to generate dual outputs
- Configure pnpm build scripts for ES and CJS compilation
- Add package.json manipulation for output directories
- Validate dual consumption in build process
- Ensure proper file extensions and module markers

### NPM Organization Setup

- Create @orchestr8 NPM organization/scope
- Configure publishing access and permissions
- Set up automation tokens for CI/CD
- Configure 2FA bypass for automated publishing
- Define package access levels (public for all MVP packages)

### Version Strategy Implementation

- Beta RC versions: @orchestr8/schema, @orchestr8/logger, @orchestr8/resilience (1.0.0-beta.0)
- Alpha versions: @orchestr8/core, @orchestr8/cli (0.1.0-alpha.0)
- @orchestr8/testing: internal only, marked as private
- Use changesets pre-release mode for coordinated pre-releases

## Approach Options

**Option A: Full Dual Build (Selected)**

- Pros: True dual module support, maximum compatibility, clear separation
- Cons: Increased build complexity, larger package sizes
- Rationale: Essential for library adoption across different module systems

**Option B: ES-Only with CJS Fallback**

- Pros: Simpler build, modern approach, smaller packages
- Cons: Limited compatibility with older tools, potential import issues
- Why not selected: Too restrictive for enterprise adoption

**Option C: Package-per-Format**

- Pros: Clear separation, simpler builds per package
- Cons: User confusion, dependency management complexity, maintenance overhead
- Why not selected: Poor developer experience

## External Dependencies

**Build Dependencies:**

- `@changesets/cli` - Version management and changelog generation
- `@changesets/changelog-github` - GitHub-integrated changelogs
- `typescript` - Dual compilation with different module targets
- No additional runtime dependencies required

**CI/CD Dependencies:**

- `changesets/action` GitHub Action - Automated PR creation and publishing
- NPM automation token - Bypass 2FA for CI publishing
- GitHub repository secrets - Secure token storage

## Implementation Architecture

### Package Structure (Post-Build)

```
packages/core/
├── dist/
│   ├── esm/           # ES modules (.mjs)
│   ├── cjs/           # CommonJS (.cjs)
│   └── types/         # TypeScript declarations
├── package.json       # Dual exports configuration
└── src/              # Source TypeScript files
```

### Export Configuration Pattern

```json
{
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/esm/index.mjs",
      "require": "./dist/cjs/index.cjs"
    }
  },
  "main": "./dist/cjs/index.cjs",
  "module": "./dist/esm/index.mjs",
  "types": "./dist/types/index.d.ts"
}
```

### Build Script Pattern

```json
{
  "scripts": {
    "build": "npm run build:clean && npm run build:esm && npm run build:cjs && npm run build:types",
    "build:esm": "tsc -p tsconfig.esm.json",
    "build:cjs": "tsc -p tsconfig.cjs.json && echo '{\"type\":\"commonjs\"}' > dist/cjs/package.json",
    "build:types": "tsc -p tsconfig.types.json"
  }
}
```

### Changeset Configuration

```json
{
  "changelog": [
    "@changesets/changelog-github",
    { "repo": "nathanvale/@orchestr8" }
  ],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@orchestr8/testing"]
}
```
