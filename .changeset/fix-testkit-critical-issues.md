---
"@orchestr8/testkit": patch
---

Fix critical issues in @orchestr8/testkit after lean core refactor

- Fixed MSW module imports by adding missing .js extensions to prevent build errors
- Enhanced createMockFn to return proper vitest mocks when available with fallback implementation
- Fixed retry function to implement true exponential backoff (delay doubles each attempt)
- Corrected withTimeout error message to use lowercase "timeout" for consistency
- All core utilities, MSW features, and config exports now working correctly
- Package fully functional with 781 tests passing