---
'@orchestr8/testkit': patch
---

fix: cleanup process listeners in afterAll and parent process to prevent hanging

Fixes issue where 98 file handles remain open after tests complete, preventing the Node.js process from exiting naturally. Process would hang indefinitely requiring timeout wrappers or manual termination.

**Root Cause:** register.ts called removeAllProcessListeners() in afterEach but NOT in afterAll. Additionally, with Vitest's fork pool architecture, the parent coordinator process never executes afterAll hooks, leaving its process listeners attached permanently.

**Solution:**
1. Added removeAllProcessListeners() to afterAll hook for fork workers
2. Added process.on('exit') cleanup handler for parent process (fork pool coordinator)

This ensures process listeners are cleaned up in both scenarios:
- Fork workers: afterAll hook executes after test files complete
- Parent process: exit handler executes when coordinator process terminates

**Impact:**
- Eliminates need for timeout wrappers in package.json
- Natural process exit after tests complete
- Better developer experience
- Resolves hanging process issue with Vitest fork pools
- Handles both single-worker and fork-pool scenarios
