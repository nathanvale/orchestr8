---
'@orchestr8/testkit': patch
---

fix: clear setTimeout in createExitHandler to prevent file handle leaks

**Critical Bug Fix:** Resolves issue where hundreds of uncanceled setTimeout calls in `createExitHandler` prevented natural process exit, causing tests to hang for 20+ seconds even with guards enabled.

**Root Cause:**
The `createExitHandler` function created a setTimeout for timeout detection but never cleared it when cleanup completed successfully. These orphaned timeouts accumulated as file handles (248 in affected test suites), preventing the Node.js process from exiting naturally.

**Solution:**
Added a `finally` block to clear the timeout handle after `Promise.race` completes, ensuring proper cleanup regardless of the success/failure path.

**Impact:**
- ✅ Eliminates hundreds of file handle leaks
- ✅ Enables natural process exit in <5 seconds (previously 120+ seconds)
- ✅ No timeout wrappers needed for fork pool configurations
- ✅ Fixes all "unknown stack trace" FILEHANDLE leaks pointing to process-listeners.js

**Breaking:** None - this is a pure bug fix with no API changes.
