---
"@orchestr8/testing": patch
---

fix(testing): relax CI/CD test to allow error handling in release script

Changed test from exact match to toContain() to allow helpful error messages
