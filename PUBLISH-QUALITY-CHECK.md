# Publishing @template/quality-check to NPM

## After Local Testing is Complete

Once you've finished testing the quality-check package locally with the
pre-commit hooks, follow these steps to publish and transition to the production
setup.

## Pre-Publishing Checklist

### 1. Verify Package Configuration

- [ ] Check `packages/quality-check/package.json`:
  - `"name": "@template/quality-check"`
  - `"version": "1.0.0"` (or appropriate version)
  - `"bin": "./dist/index.js"` is set correctly
  - `"files": ["dist"]` includes built files
  - `"publishConfig": { "access": "public" }` for scoped package
  - `"engines": { "node": ">=18.0.0" }` is specified

### 2. Build and Test

```bash
cd packages/quality-check
pnpm build
pnpm test

# Test the CLI directly
node dist/index.js --help
node dist/index.js --file test.ts
```

### 3. Test Pre-commit Mode One More Time

```bash
# With local path (current setup)
git add some-file.ts
pnpm exec lint-staged
```

## Publishing Steps

### 1. Login to NPM

```bash
npm login
# Or if using a token:
npm config set //registry.npmjs.org/:_authToken=YOUR_TOKEN
```

### 2. Publish the Package

```bash
cd packages/quality-check

# Dry run first to see what will be published
npm publish --dry-run

# If everything looks good, publish
npm publish --access public
```

### 3. Verify Publication

```bash
# Check it's available
npm view @template/quality-check

# Test installation works
npx @template/quality-check --help
```

## Post-Publishing Updates

### 1. Update .lintstagedrc.json

Change from local path to npx:

**From:**

```json
{
  "!(packages/claude-hooks/**)*.{ts,tsx,js,jsx}": [
    "node packages/quality-check/dist/index.js --pre-commit"
  ]
}
```

**To:**

```json
{
  "!(packages/claude-hooks/**)*.{ts,tsx,js,jsx}": [
    "npx @template/quality-check --pre-commit"
  ]
}
```

### 2. Update Documentation

- [ ] Update README.md with installation instructions
- [ ] Add usage examples for npm users
- [ ] Document the pre-commit hook setup

### 3. Test Production Setup

```bash
# Remove any global links if you made them
npm unlink -g @template/quality-check

# Test with npx (will download from npm)
npx @template/quality-check --help

# Test pre-commit with new config
git add test-file.ts
pnpm exec lint-staged
```

## Version Management

### For Updates

```bash
cd packages/quality-check

# Bump version
npm version patch  # or minor/major

# Rebuild
pnpm build

# Publish update
npm publish
```

### Using Changesets (Recommended)

```bash
# Create a changeset
pnpm changeset

# Version packages
pnpm changeset version

# Publish
pnpm changeset publish
```

## Troubleshooting

### If npx doesn't work after publishing:

1. Clear npm cache: `npm cache clean --force`
2. Try with full registry URL:
   `npx --registry https://registry.npmjs.org @template/quality-check`
3. Check npm registry status: https://status.npmjs.org/

### If pre-commit hooks fail after switching to npx:

1. Ensure package is published: `npm view @template/quality-check`
2. Test manually: `npx @template/quality-check --pre-commit`
3. Check .lintstagedrc.json syntax is correct
4. Verify staged files: `git diff --cached --name-only`

## Alternative: GitHub Package Registry

If you prefer to keep it private or use GitHub Packages:

```bash
# Set registry in package.json
"publishConfig": {
  "registry": "https://npm.pkg.github.com"
}

# Login to GitHub registry
npm login --registry=https://npm.pkg.github.com

# Publish
npm publish
```

Then users need to configure npmrc:

```bash
echo "@YOUR_GITHUB_USERNAME:registry=https://npm.pkg.github.com" >> .npmrc
```

## Notes

- The package name `@template/quality-check` suggests a scoped package
- Make sure you own the `@template` scope on npm or change the name
- Consider adding a `prepublishOnly` script to ensure building before publish
- Add repository field to package.json for better npm page display
