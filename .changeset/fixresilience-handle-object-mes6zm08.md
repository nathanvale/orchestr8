---
"@orchestr8/resilience": patch
---

fix(resilience): handle object timeout policies correctly

Fixes TimeoutError displaying '[object Object]ms' when timeout policy
is an object with global/perStep properties. Now properly extracts
the numeric duration value from the object with defensive type handling.

The fix adds proper type guards to safely handle both number and object
formats for timeout policies, preventing confusing error messages.

Resolves first reported support ticket about error message clarity.
