# Product Mission

> Last Updated: 2025-09-03 Version: 1.0.0

## Pitch

AEPLS is a pragmatic quality enforcement system that ships in one week, not months, by using a simple facade pattern that provides 80%+ automation through a thin Claude hook wrapper (~50 lines) calling into a refactored quality-check package (~440 lines), following YAGNI principles to add complexity only when proven necessary.

## Users

### Primary Customers

- **Development Teams**: Teams of 5-50 developers working on JavaScript/TypeScript projects who need consistent code quality
- **Individual Developers**: Solo developers and contractors who want to maintain professional standards without manual effort  
- **AI-Assisted Development Users**: Developers using Claude, Copilot, or other AI coding assistants who need quality enforcement

### User Personas

**Senior Developer Sarah** (28-40 years old)
- **Role:** Lead Developer / Tech Lead
- **Context:** Manages code quality for team of 5-15 developers on multiple projects
- **Pain Points:** Reviewing same errors repeatedly, teaching juniors the same concepts, maintaining standards at scale
- **Goals:** 50% less time in code reviews, zero critical errors in production

**Junior Developer James** (22-28 years old)
- **Role:** Junior Developer
- **Context:** Less than 2 years experience, learning TypeScript and best practices
- **Pain Points:** Unclear error messages, not understanding why errors matter, making same mistakes
- **Goals:** Learn from errors first time, build deep understanding of TypeScript/ESLint

**AI Assistant Claude** (Ageless)
- **Role:** AI Coding Assistant
- **Context:** Generating code for developers across multiple projects and languages
- **Pain Points:** Generating code with errors, not learning from corrections, lacking project context
- **Goals:** 95% error-free code generation, proactive error prevention

## The Problem

### Reactive Error Handling Wastes Developer Time

Current development workflows treat errors as isolated incidents, with 73% of teams experiencing the same errors recurring across files and developers. Teams spend 15-30% of development time fixing preventable errors.

**Our Solution:** Create a continuous learning loop that enforces critical stops and learns from patterns.

### Lost Learning Opportunities

Errors are fixed but knowledge isn't captured, leading to repeated mistakes and inconsistent understanding across the team. Junior developers make the same mistakes for months.

**Our Solution:** Contextual education system that teaches developers through in-the-moment explanations and progressive learning paths.

### AI Assistants Generate Problematic Code

AI coding assistants lack project context and don't learn from corrections, repeatedly generating code with the same issues that humans have to fix.

**Our Solution:** Update AI behavior through pattern-based prevention rules and clear enforcement feedback.

## Differentiators

### Simple Facade Pattern - Flexibility Without Complexity

Unlike over-engineered solutions with routers and dependency injection, we use a simple facade pattern where each entry point (CLI, hook, pre-commit, API) is ~50 lines. This results in maintainable code that ships in a week.

### Working Software Over Perfect Architecture

Unlike projects that spend months on architecture, we follow YAGNI principles and ship working code in one week. This results in immediate value delivery with a natural growth path for future needs.

### Thin Integration Layer

Unlike complex integrations, our Claude hook is just ~50 lines calling into the existing quality-check package. This results in easy debugging, testing, and modification without affecting other consumers.

## Key Features

### Core Features

- **Simple Hook Handler:** Clean interface between Claude and quality checking with conditional logic
- **Autopilot Engine:** Intelligent classification and silent fixing of 80%+ of issues
- **Pattern Tracker:** Learning system that detects recurring issues and generates rules
- **Fix Verifier:** Multi-level verification ensuring all auto-fixes are safe
- **Smart Decision Logic:** Simple file type checking without over-engineering

### Developer Experience Features

- **Silent Success Mode:** No output for successfully handled issues
- **Contextual Education:** In-the-moment explanations for unfixable issues
- **Progressive Learning:** Graduated complexity based on developer experience
- **Graceful Degradation:** Never crashes or blocks on system errors

### Integration Features

- **Tool-Agnostic Design:** Works with Write, Edit, MultiEdit, Create operations
- **Configuration System:** Flexible JSON-based configuration for team preferences
- **Metrics Dashboard:** Track automation rate, time saved, patterns detected
- **CI/CD Ready:** Can be integrated into build pipelines and pre-commit hooks