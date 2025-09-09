# Spec Requirements Document

> Spec: Markdown Prettier Support Created: 2025-09-09

## Overview

Add Markdown (.md) file support to the quality-check package's Prettier
integration, enabling automatic formatting of Markdown files through all entry
points (CLI, git hooks, API, Claude hook). This enhancement will ensure
consistent Markdown formatting across documentation, specs, and README files
without manual intervention.

## User Stories

### Automatic Markdown Formatting

As a developer using Claude Code, I want Markdown files to be automatically
formatted when I edit them, so that my documentation maintains consistent
formatting without manual effort.

When I use Claude Code to edit any Markdown file (specs, documentation, README
files), the quality checker's Claude hook should detect the .md file extension,
run Prettier formatting checks, and automatically fix any formatting issues.
This should work seamlessly just like it currently does for JavaScript and
TypeScript files, providing the same "fix silently" behavior for formatting
issues while maintaining the ability to report more serious problems.

### Consistent Documentation Standards

As a project maintainer, I want all Markdown files to follow the same formatting
standards, so that our documentation remains professional and readable across
all contributors.

The quality checker should enforce Prettier's Markdown formatting rules
consistently across all .md files in the project, including proper line
wrapping, consistent list formatting, proper code block formatting, and
standardized heading styles. This should work through all existing entry
points - CLI for manual checks, git hooks for pre-commit validation, and the
Claude hook for AI-assisted editing.

## Spec Scope

1. **File Extension Support** - Extend file filtering to include .md files
   alongside existing .js/.jsx/.ts/.tsx support
2. **Prettier Engine Integration** - Configure Prettier engine to process
   Markdown files using appropriate parser
3. **Autopilot Decision Logic** - Update autopilot to treat Markdown formatting
   issues as auto-fixable
4. **Claude Hook Compatibility** - Ensure Claude hook processes .md files during
   Write/Edit operations
5. **Test Coverage** - Add comprehensive tests for Markdown file processing
   across all facades

## Out of Scope

- Custom Markdown linting rules beyond Prettier formatting
- Markdown content validation (broken links, spell checking)
- MDX file support (React components in Markdown)
- Custom Prettier configuration specific to Markdown
- Markdown preview or rendering functionality

## Expected Deliverable

1. Quality checker successfully formats Markdown files when edited through
   Claude Code
2. All existing entry points (CLI, git hook, API) support Markdown file checking
3. Prettier auto-fixes Markdown formatting issues silently through the Claude
   hook
