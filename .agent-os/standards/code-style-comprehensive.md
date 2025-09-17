# Code Style Guidelines

## JavaScript/TypeScript Formatting
### Indentation Rules
- Use 2 spaces for indentation
- No tabs allowed
- Indent switch cases

### Semicolons
- Always use semicolons
- ASI is not reliable

### Line Length
- Maximum 100 characters
- Break long expressions

## Naming Conventions
### Variables
- camelCase for variables
- UPPER_SNAKE_CASE for constants
- Descriptive names required

### Functions
- camelCase for functions
- Verb prefixes (get, set, handle)
- Single responsibility

### Classes
- PascalCase for classes
- Noun names
- Interface prefix with 'I'

## Import Organization
### Order Rules
1. Node built-ins
2. External packages
3. Internal modules
4. Relative imports

### Grouping
- Separate groups with blank lines
- Sort alphabetically within groups

## React Component Guidelines
### Functional Components
- Use arrow functions
- Props destructuring
- Hooks at top level

### Component Structure
1. Imports
2. Types/Interfaces
3. Component definition
4. Styled components
5. Export statement

### Props Naming
- Boolean props start with 'is' or 'has'
- Event handlers start with 'on'
- Children props explicitly typed

## API Response Formatting
### JSON Structure
- camelCase keys
- Consistent error format
- Pagination standards

### Status Codes
- 200 for success
- 201 for created
- 400 for bad request
- 401 for unauthorized

## Database Naming
### Tables
- Plural snake_case
- Descriptive names
- No abbreviations

### Columns
- snake_case format
- id for primary keys
- created_at, updated_at timestamps

## Error Handling Style
### Try-Catch Blocks
- Specific error types
- Meaningful error messages
- Always log errors

### Custom Errors
- Extend Error class
- Include error codes
- Stack trace preservation

## Comments and Documentation
### JSDoc Standards
- Document all public APIs
- Include examples
- Type annotations

### Inline Comments
- Explain why, not what
- Above the code line
- Keep concise

## Git Commit Style
### Message Format
- Type: description
- Max 72 characters
- Present tense

### Types
- feat: new feature
- fix: bug fix
- docs: documentation
- style: formatting
- refactor: code restructuring