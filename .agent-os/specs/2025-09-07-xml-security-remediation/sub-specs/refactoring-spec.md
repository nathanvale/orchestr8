# Refactoring Specification

This is the refactoring specification for the spec detailed in @.agent-os/specs/2025-09-07-xml-security-remediation/spec.md

## Structural Refactoring Plan

### Phase 1: Extract Common Components

#### Create Shared Enforcement Rules
**File:** `.agent-os/instructions/components/common-enforcement.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<common_enforcement>
  <metadata version="1.0" encoding="UTF-8"/>
  
  <execution_rules>
    <rule id="exec_1">Execute with validation</rule>
    <rule id="exec_2">Require user confirmation for sensitive operations</rule>
    <rule id="exec_3">Use parameterized tools</rule>
    <rule id="exec_4">Log all operations</rule>
  </execution_rules>
  
  <validation_rules>
    <rule id="val_1">Validate all inputs before execution</rule>
    <rule id="val_2">Sanitize template variables</rule>
    <rule id="val_3">Check permissions before file access</rule>
  </validation_rules>
  
  <error_rules>
    <rule id="err_1">Log errors with context</rule>
    <rule id="err_2">Attempt recovery before failing</rule>
    <rule id="err_3">Clean up resources on failure</rule>
  </error_rules>
</common_enforcement>
```

**Savings:** ~850 tokens across 11 files

#### Create Variable Registry
**File:** `.agent-os/instructions/components/variable-registry.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<variable_registry>
  <metadata version="1.0" encoding="UTF-8"/>
  
  <variables>
    <variable name="SPEC_PATH" type="string" source="user_input" required="true">
      <validation pattern="^\.agent-os/specs/\d{4}-\d{2}-\d{2}-[a-z-]+$"/>
      <description>Path to specification folder</description>
    </variable>
    
    <variable name="BRANCH_NAME" type="string" source="derived" required="true">
      <validation pattern="^[a-zA-Z0-9_-]{1,50}$"/>
      <sanitize>shell_escape</sanitize>
      <description>Git branch name derived from spec folder</description>
    </variable>
    
    <variable name="TASK_COUNT" type="integer" source="computed" required="false">
      <validation min="0" max="100"/>
      <default>0</default>
      <description>Number of tasks to execute</description>
    </variable>
    
    <variable name="FILE_PATH" type="string" source="user_input" required="true">
      <validation pattern="^[a-zA-Z0-9/_.-]+$" max_length="255"/>
      <canonicalize>true</canonicalize>
      <description>Path to file for operations</description>
    </variable>
  </variables>
</variable_registry>
```

### Phase 2: Flatten Deep Nesting

#### Before (tool-mapping.xml):
```xml
<mappings>
  <mapping id="read_file">
    <patterns>
      <pattern>load file</pattern>
      <pattern>read file</pattern>
      <pattern>get content</pattern>
    </patterns>
    <tool>Read</tool>
    <params>
      <file_path>{{FILE_PATH}}</file_path>
    </params>
    <immediate>true</immediate>
  </mapping>
</mappings>
```

#### After (optimized):
```xml
<mappings>
  <mapping id="read_file" tool="Read" patterns="load file|read file|get content">
    <param name="file_path" value="{{FILE_PATH}}" validate="true"/>
  </mapping>
</mappings>
```

**Savings:** ~600 tokens through structure optimization

### Phase 3: Standardize Metadata

#### Current (verbose):
```xml
<metadata>
  <description>Some description</description>
  <version>1.0</version>
  <encoding>UTF-8</encoding>
  <mode>IMMEDIATE_EXECUTION</mode>
</metadata>
```

#### Optimized:
```xml
<metadata version="1.0" mode="execution" encoding="UTF-8"/>
```

**Savings:** ~400 tokens across all files

### Phase 4: Optimize Response Templates

#### Before:
```xml
<template id="task-confirmation">
  <![CDATA[
  Tasks identified for execution:
  {{#each tasks}}
  - Task {{this.number}}: {{this.description}}
  {{/each}}
  ]]>
</template>
```

#### After:
```xml
<template id="task-confirmation" type="list">
  <header>Tasks identified for execution:</header>
  <item>Task {{number}}: {{description}}</item>
</template>
```

**Savings:** ~300 tokens through template optimization

## Dependency Resolution

### Current Circular Dependencies:
```
execute-tasks.xml ↔ execution-engine.xml ↔ tool-mapping.xml
phase1-setup.xml → validation-gates.xml → state-machines.xml → response-templates.xml
```

### Resolved Linear Hierarchy:
```
Level 1: variable-registry.xml, common-enforcement.xml
Level 2: tool-mapping.xml, response-templates.xml
Level 3: state-machines.xml, validation-gates.xml
Level 4: execution-engine.xml
Level 5: phase1-setup.xml, phase2-execution.xml, phase3-finalization.xml
Level 6: execute-task.xml, execute-tasks.xml
```

## File Consolidation Plan

### Files to Merge:
1. Merge `validation-gates.xml` logic into `execution-engine.xml`
2. Combine all phase files into single `execution-phases.xml`
3. Merge `post-execution-tasks.xml` into `phase3-finalization.xml`

### Files to Create:
1. `common-enforcement.xml` - Shared rules
2. `variable-registry.xml` - Variable definitions
3. `security-controls.xml` - Security configurations
4. `error-handling.xml` - Error recovery procedures

### Files to Update:
All 11 existing files to:
- Remove redundant enforcement blocks
- Import shared components
- Use consistent attribute patterns
- Fix XML syntax errors
- Implement security controls

## Refactoring Metrics

### Before:
- Total XML lines: ~1,850
- Token count: ~8,500
- Files: 11
- Max nesting: 6 levels
- Redundancy: 35%

### After:
- Total XML lines: ~1,400 (24% reduction)
- Token count: ~6,350 (25% reduction)
- Files: 12 (better organized)
- Max nesting: 4 levels
- Redundancy: <10%

## Implementation Order

1. **Week 1, Day 1-2:**
   - Fix critical XML syntax error in phase2-execution.xml
   - Create common-enforcement.xml
   - Create variable-registry.xml
   - Update all files to import shared components

2. **Week 1, Day 3-4:**
   - Flatten deep nesting in all files
   - Standardize metadata format
   - Optimize response templates
   - Resolve circular dependencies

3. **Week 1, Day 5:**
   - Test XML parsing
   - Verify token reduction
   - Validate functionality preservation
   - Document changes

## Testing Requirements

- XML validation against W3C standards
- Token counting verification
- Dependency graph validation
- Functional equivalence testing
- Performance benchmarking