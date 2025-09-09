# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-09-09-markdown-prettier-support/spec.md

> Created: 2025-09-09 Version: 1.0.0

## Technical Requirements

### File Extension Support

- Modify file filtering regex patterns to include `.md` extension
- Update file matchers in core/file-matcher.ts to recognize Markdown files
- Ensure all facades (CLI, git-hook, API, claude) pass .md files to quality
  checker
- Maintain backward compatibility with existing JS/TS file filtering

### Prettier Engine Configuration

- Configure Prettier engine to use `markdown` parser for .md files
- Ensure Prettier's markdown formatting options are properly applied
- Handle Prettier's markdown-specific formatting rules (line wrapping at 80
  chars, list formatting, etc.)
- Integrate with existing Prettier engine in engines/prettier-engine.ts

### Autopilot Decision Logic Updates

- Update autopilot.ts to recognize Markdown formatting issues as auto-fixable
- Ensure FIX_SILENTLY action is applied to Prettier markdown formatting issues
- Maintain existing decision logic for other issue types
- Add Markdown-specific issue patterns to autopilot's decision matrix

### Claude Hook Integration

- Ensure claude.ts facade processes .md files during Write/Edit operations
- Verify file filtering allows .md files to pass through to quality checker
- Test hook behavior with various Markdown file operations
- Maintain existing performance requirements (<2s execution time)

### Performance Criteria

- Markdown file checking must complete within existing 2-second limit
- Prettier formatting for typical README files (<500 lines) should take <100ms
- Large spec files (1000+ lines) should process in under 500ms
- Cache Prettier's markdown parser to avoid repeated initialization

### Testing Requirements

- Unit tests for Markdown file filtering in all facades
- Integration tests for end-to-end Markdown formatting workflow
- Performance tests with various Markdown file sizes
- Edge case tests for malformed Markdown content
- Cross-facade compatibility tests ensuring consistent behavior

## Implementation Approach

### Phase 1: Core Support

1. Update file filtering patterns to include .md
2. Configure Prettier engine for Markdown parsing
3. Add basic unit tests for file filtering

### Phase 2: Facade Integration

1. Update each facade to handle .md files
2. Ensure autopilot treats Markdown issues as fixable
3. Add integration tests for each entry point

### Phase 3: Testing & Validation

1. Comprehensive test coverage across all components
2. Performance validation with real-world Markdown files
3. End-to-end testing through Claude hook

## Configuration Changes

### Prettier Configuration

- No custom Prettier config needed initially
- Use default Prettier markdown formatting rules
- Future enhancement: Allow .prettierrc markdown overrides

### File Patterns

```typescript
// Current pattern
/\.(js|jsx|ts|tsx)$/

// Updated pattern
/\.(js|jsx|ts|tsx|md)$/
```

## Affected Components

1. **Core Package**
   - core/file-matcher.ts
   - core/quality-checker.ts

2. **Engines**
   - engines/prettier-engine.ts

3. **Adapters**
   - adapters/autopilot.ts

4. **Facades**
   - facades/cli.ts
   - facades/git-hook.ts
   - facades/api.ts
   - facades/claude.ts

5. **Tests**
   - All component test files need updates
   - New test files for Markdown-specific scenarios
