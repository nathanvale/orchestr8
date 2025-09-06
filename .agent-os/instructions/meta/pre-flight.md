---
description: Common Pre-Flight Steps for Agent OS Instructions
globs:
alwaysApply: false
version: 1.0
encoding: UTF-8
---

# Pre-Flight Rules

## Execution Protocol

<mandatory_rules>

### Rule 1: Subagent Usage
IF step.has_attribute("subagent"):
  MANDATORY: Use the EXACT subagent specified
  FORBIDDEN: Execute step without subagent
  FORBIDDEN: Use different subagent
ELSE:
  EXECUTE: Directly without subagent

### Rule 2: Sequential Processing
<algorithm>
  1. SET: current_step = 1
  2. WHILE current_step <= total_steps:
     a. EXECUTE: Step[current_step] completely
     b. VERIFY: Evidence checkpoint passed
     c. IF checkpoint_failed:
        ERROR: "Cannot proceed - Step [current_step] incomplete"
        RETRY: Step[current_step]
     d. ELSE:
        INCREMENT: current_step += 1
</algorithm>

### Rule 3: Evidence Checkpoint Enforcement
<checkpoint_protocol>
  FOR each step N:
    1. EXECUTE: All instructions in Step N
    2. CHECK: Does Step N have evidence_checkpoint?
    3. IF has_checkpoint:
       a. PRODUCE: Required evidence output
       b. VERIFY: Output matches checkpoint requirements
       c. IF verification_failed:
          ERROR: "Step [N] checkpoint not satisfied"
          ACTION: HALT progression
          FORBIDDEN: Proceed to Step N+1
       d. ELSE:
          STATUS: "Step [N] verified"
          ALLOWED: Proceed to Step N+1
    4. ELSE:
       ALLOWED: Proceed to Step N+1
</checkpoint_protocol>

### Rule 4: Clarification Protocol
<clarification_trigger>
  IF any_of([
    missing_required_parameter,
    ambiguous_instruction,
    conflicting_requirements,
    undefined_variable
  ]):
    1. STOP: Current execution
    2. FORMULATE: Numbered questions list
    3. ASK: User for specific clarifications
    4. WAIT: For user response
    5. RESUME: Only after all questions answered
</clarification_trigger>

### Rule 5: Template Compliance
<template_usage>
  WHEN template provided:
    USE: EXACT template format
    SUBSTITUTE: Only bracketed placeholders
    PRESERVE: All other text verbatim
  FORBIDDEN: Paraphrase template text
  FORBIDDEN: Omit template components
</template_usage>

</mandatory_rules>

## Pre-Flight Checklist

<checklist>
  □ Subagent assignments identified
  □ Step sequence understood
  □ Evidence checkpoints noted
  □ Templates available
  □ Ready to execute sequentially
</checklist>
