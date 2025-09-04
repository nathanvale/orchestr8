---
"@orchestr8/logger": minor
---

feat(logger): add prettyJson option for beautifully formatted JSON objects

- Add prettyJson boolean option to LoggerOptions interface
- Implement pretty JSON formatting in ConsoleLogger with 2-space indentation
- Add LOG_PRETTY_JSON environment variable support
- Maintain colored log levels and structured output for development debugging
- Add comprehensive test coverage for all pretty JSON scenarios
- Backward compatible - existing behavior unchanged, new feature is opt-in

Examples:
// Enable pretty JSON formatting
const logger = createConsoleLogger({
  pretty: true,
  prettyJson: true
})

// Or via environment variable
// LOG_PRETTY_JSON=true
