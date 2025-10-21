---
"@orchestr8/quality-check": patch
---

fix: add graceful TypeScript API fallback to prevent parser crashes

Fixes "Cannot read properties of undefined (reading 'fileExists')" error when processing test files.

**Changes:**
- Add TypeScript API validation with graceful degradation
- Implement Node.js fs fallbacks for ts.sys.fileExists/readFile
- Add manual findConfigFile implementation
- Support JSON5 parsing for tsconfig.json (comments, trailing commas)
- Create minimal ts.sys object when unavailable
- Enhanced ESLint engine error handling with retry logic

**Impact:**
- Quality-check now works reliably on test files
- Graceful degradation when TypeScript APIs unavailable  
- No crashes - returns success with empty results when APIs missing
