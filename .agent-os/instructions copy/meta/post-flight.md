---
description: Common Post-Flight Steps for Agent OS Instructions
globs:
alwaysApply: false
version: 1.0
encoding: UTF-8
---

# Post-Flight Rules

## Mandatory Verification Protocol

<verification_algorithm>

### Phase 1: Step Completion Audit

FOR each step N in process_flow:

1. CHECK: Was Step N executed? □ YES: Continue to 2 □ NO: LOG violation: "Step
   [N] not executed"

2. CHECK: Was Step N completed fully? □ YES: Continue to 3 □ PARTIAL: LOG
   violation: "Step [N] partially executed: [missing parts]" □ NO: LOG
   violation: "Step [N] skipped entirely"

3. CHECK: Did Step N follow exact instructions? □ YES: Mark step as COMPLIANT □
   NO: LOG violation: "Step [N] deviated: [specific deviation]"

### Phase 2: Evidence Checkpoint Verification

<critical_verification> IF process includes Steps 2-4 with evidence checkpoints:

FOR step in [2, 3, 4]: 1. VERIFY: evidence_output[step] exists 2. VERIFY:
evidence_output[step] produced BEFORE Step 5 started 3. IF verification_failed:
STATUS: "CRITICAL PROCESS VIOLATION" ACTION: MUST report to user immediately
DETAIL: "Step [step] evidence missing/late" </critical_verification>

### Phase 3: Subagent Delegation Audit

<subagent_verification> FOR each step with subagent attribute:

1. CHECK: Was specified subagent invoked? IF NO: INVESTIGATE: Why subagent not
   used REPORT: "Step [N] subagent violation: Expected: [subagent_name] Actual:
   [what_was_done_instead] Reason: [why_subagent_skipped]"

2. CHECK: Was correct subagent used? IF wrong_subagent: REPORT: "Step [N] wrong
   subagent: Expected: [correct_subagent] Used: [incorrect_subagent]"
   </subagent_verification>

### Phase 4: Deviation Analysis

<deviation_protocol> IF any_violations_found:

1. COMPILE: Violation report with:
   - Step number
   - Instruction that was violated
   - What was done instead
   - Why deviation occurred
   - Impact on overall process

2. CLASSIFY violations: CRITICAL: Evidence checkpoints missed MAJOR: Subagent
   not used when required MINOR: Instruction variations that didn't affect
   outcome

3. REPORT to user: "POST-FLIGHT VIOLATIONS DETECTED: Critical: [count] - [list]
   Major: [count] - [list] Minor: [count] - [list]"

ELSE: REPORT: "POST-FLIGHT CHECK: All steps executed correctly ✓"
</deviation_protocol>

</verification_algorithm>

## Post-Flight Checklist

<final_checklist> □ All steps executed in sequence □ All evidence checkpoints
satisfied □ All subagents used as specified □ No critical violations detected □
Deviation report generated (if applicable) □ Process integrity verified
</final_checklist>

## Compliance Report Template

<report_template> POST-FLIGHT VERIFICATION COMPLETE
================================= Total Steps Executed: [N] Steps Compliant: [X]
Steps With Issues: [Y]

Evidence Checkpoints: [PASS/FAIL] Subagent Usage: [PASS/FAIL] Process Integrity:
[PASS/FAIL]

[If issues exist:] VIOLATIONS REQUIRING ATTENTION: [Detailed violation list]
</report_template>
