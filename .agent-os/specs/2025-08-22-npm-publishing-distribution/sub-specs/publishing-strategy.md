# Publishing Strategy

This is the publishing strategy for the spec detailed in @.agent-os/specs/2025-08-22-npm-publishing-distribution/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Package Maturity Tiers

### Beta RC Packages (Production Ready)

**Packages:** `@orchestr8/schema`, `@orchestr8/logger`, `@orchestr8/resilience`
**Starting Version:** `1.0.0-beta.0`
**Rationale:** These packages are stable, well-tested, and ready for production use

**Characteristics:**

- Comprehensive test coverage (>80%)
- Stable APIs with minimal breaking changes expected
- Used extensively within the @orchestr8 ecosystem
- Ready for external adoption

### Alpha Packages (Development/Preview)

**Packages:** `@orchestr8/core`, `@orchestr8/cli`
**Starting Version:** `0.1.0-alpha.0`
**Rationale:** These packages are functional but still evolving rapidly

**Characteristics:**

- Core functionality complete but APIs may change
- Active development with feature additions
- Good test coverage but some edge cases remain
- Suitable for early adopters and testing

### Internal Packages (Not Published)

**Packages:** `@orchestr8/testing`
**Status:** Private (not published to NPM)
**Rationale:** Internal development tooling not intended for external consumption

## Version Progression Strategy

### Beta RC to Stable Path

```
1.0.0-beta.0 → 1.0.0-beta.1 → ... → 1.0.0-rc.0 → 1.0.0
```

**Graduation Criteria for Beta → RC:**

- No breaking changes for 2+ weeks
- Community feedback incorporated
- Documentation complete
- Performance benchmarks met

**Graduation Criteria for RC → Stable:**

- Zero known critical bugs
- Community validation in production use
- Comprehensive documentation
- Automated tests at 90%+ coverage

### Alpha to Beta Path

```
0.1.0-alpha.0 → 0.1.0-alpha.X → 0.1.0-beta.0 → 1.0.0-beta.0
```

**Graduation Criteria for Alpha → Beta:**

- API stabilization (no major breaking changes planned)
- Feature completeness for core use cases
- Test coverage >75%
- Internal dogfooding successful

## Release Cadence

### Development Releases

- **Alpha releases:** As needed, triggered by feature completion
- **Beta releases:** Weekly, with accumulated bug fixes and minor features
- **RC releases:** Bi-weekly, focusing on stability and bug fixes

### Stable Releases

- **Patch releases:** As needed for critical bugs (24-48 hour turnaround)
- **Minor releases:** Monthly, with new features and improvements
- **Major releases:** Quarterly at most, only for breaking changes

## Dependency Management

### Internal Dependencies

- Beta RC packages can depend on other Beta RC packages
- Alpha packages can depend on Beta RC packages
- Alpha packages should minimize dependencies on other Alpha packages
- Use `patchDependencies` for pinning specific versions during development

### Version Alignment

- Use Changesets `linked` configuration for packages that should share versions
- Schema package versions as foundation for compatibility matrices
- Logger and Resilience can version independently
- Core and CLI versions should align for major releases

## Pre-release Distribution

### NPM Dist Tags

```bash
# Beta RC packages
npm install @orchestr8/schema@beta     # Latest beta
npm install @orchestr8/schema@rc       # Latest release candidate
npm install @orchestr8/schema@latest   # Latest stable

# Alpha packages
npm install @orchestr8/core@alpha      # Latest alpha
npm install @orchestr8/core@next       # Development branch
```

### Communication Strategy

- GitHub releases with detailed changelog for all versions
- Discord/community announcements for major milestones
- Documentation site versioning aligned with package versions
- Migration guides for breaking changes

## Quality Assurance

### Pre-Release Testing

- Internal dogfooding for 48 hours minimum
- Community preview period for RC releases
- Automated compatibility testing across Node.js versions
- Performance regression testing

### Stability Commitments

- **Beta RC:** No breaking changes without major version bump
- **Alpha:** Breaking changes allowed with clear migration path
- **Stable:** Full semantic versioning compliance

### Support Policy

- **Latest stable:** Full support and bug fixes
- **Previous minor:** Security fixes only
- **Beta/RC:** Best effort support, upgrade path provided
- **Alpha:** No support commitments, breaking changes expected

## Release Communication

### Changelog Standards

- Follow Keep a Changelog format
- Include migration instructions for breaking changes
- Link to GitHub issues and pull requests
- Highlight security fixes and deprecations

### Release Notes Template

```markdown
## @orchestr8/package@1.0.0-beta.1

### ✨ New Features

- Feature description with usage example

### 🐛 Bug Fixes

- Bug fix description with issue link

### 💥 Breaking Changes

- Breaking change with migration guide

### 📖 Documentation

- Documentation improvements

### ⚡ Performance

- Performance improvements with benchmarks
```
