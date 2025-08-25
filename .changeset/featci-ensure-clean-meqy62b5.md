---
"@orchestr8/core": minor
"@orchestr8/logger": minor
"@orchestr8/schema": minor
---

feat(ci): ensure clean package exports without development fields

Trigger patch bump for all packages to republish with clean exports.
The prepublishOnly scripts will automatically remove development export
conditions during npm publishing, ensuring consumers get production-ready
package.json files without development-specific export mappings.
