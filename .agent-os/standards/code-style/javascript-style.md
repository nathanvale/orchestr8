# Javascript Style Guide

<!-- ESLint & TypeScript Code Style Enforcement -->
<code-style-enforcement priority="CRITICAL">
  <mandate>
    <rule>ALL generated code MUST pass ESLint checks without errors</rule>
    <rule>TypeScript must compile without errors</rule>
    <note>Prettier will handle formatting - focus on logic and types</note>
  </mandate>
  
  <typescript-critical-rules>
    <rule name="unused-variables">
      <requirement>Prefix intentionally unused variables with underscore</requirement>
      <severity>warning</severity>
      <example>
        // ✅ CORRECT - underscore prefix for unused
        function handleEvent(_event: Event, data: Data) {
          return processData(data)
        }

        // ⚠️ WARNING - ESLint will complain
        function handleEvent(event: Event, data: Data) {
          return processData(data)  // 'event' is unused
        }
      </example>
    </rule>
    
    <rule name="any-type-usage">
      <requirement>Avoid 'any' type - use 'unknown' or specific types</requirement>
      <severity>warning in source, off in tests</severity>
      <example>
        // ✅ CORRECT - specific type or unknown
        function processData(data: unknown): ProcessedData {
          // Type guard or assertion
          if (isValidData(data)) {
            return data
          }
        }
        
        // ⚠️ WARNING in source files
        function processData(data: any): any {
          return data
        }
        
        // ✅ OK in test files
        // **/*.test.ts, **/*.spec.ts
        const mockData: any = { test: true }
      </example>
    </rule>
    
    <rule name="const-vs-let">
      <requirement>Use 'const' for values that don't change</requirement>
      <requirement>Use 'let' only when reassignment is needed</requirement>
      <prohibition>NEVER use 'var'</prohibition>
      <severity>error for var, warning for let misuse</severity>
      <example>
        // ✅ CORRECT
        const config = loadConfig()
        let counter = 0
        counter++
        
        // ❌ ERROR - never use var
        var oldStyle = true
        
        // ⚠️ WARNING - should be const
        let neverChanges = 42
      </example>
    </rule>
    
    <rule name="equality-checks">
      <requirement>Use === and !== for strict equality</requirement>
      <exception>Smart equality allowed: == null checks both null and undefined</exception>
      <example>
        // ✅ CORRECT
        if (value === 42) { }
        if (value !== 'test') { }
        if (value == null) { }  // Checks null OR undefined
        
        // ⚠️ WARNING - use strict equality
        if (value == 42) { }
      </example>
    </rule>
  </typescript-critical-rules>
  
  <function-length-limits>
    <default>
      <max-lines>150</max-lines>
      <skip-blank-lines>true</skip-blank-lines>
      <skip-comments>true</skip-comments>
    </default>

    <package-overrides>
      <package path="packages/claude-hooks/**">
        <max-lines>200</max-lines>
        <note>Relaxed during migration</note>
      </package>
      
      <package path="packages/quality-check/**">
        <max-lines>150</max-lines>
        <note>Stricter for core quality code</note>
      </package>
    </package-overrides>
    
    <test-overrides>
      <files>**/*.test.ts, **/*.spec.ts</files>
      <max-lines>500</max-lines>
      <allow-any>true</allow-any>
      <allow-non-null-assertion>true</allow-non-null-assertion>
      <note>Tests can be longer and use relaxed type checking</note>
    </test-overrides>
  </function-length-limits>
  
  <react-specific>
    <rule name="hooks-rules">
      <requirement>Hooks only at top level of functions</requirement>
      <requirement>Hooks only in React functions or custom hooks</requirement>
      <severity>error</severity>
    </rule>

    <rule name="exhaustive-deps">
      <requirement>Include all dependencies in useEffect/useMemo/useCallback</requirement>
      <severity>warning</severity>
      <note>Can disable with eslint-disable-next-line if intentional</note>
    </rule>
    
    <rule name="react-import">
      <requirement>No need to import React for JSX (React 17+)</requirement>
      <note>TypeScript/build tools handle this automatically</note>
    </rule>
  </react-specific>
  
  <console-usage>
    <allowed>true</allowed>
    <note>Console statements allowed for debugging (ADHD-friendly)</note>
    <recommendation>Use console.log freely during development</recommendation>
  </console-usage>
  
  <import-rules>
    <requirement>Group imports logically</requirement>
    <order>
      1. Node built-ins (e.g., 'node:fs')
      2. External packages
      3. Internal packages (@template/*)
      4. Relative imports
      5. Type imports last
    </order>
  </import-rules>
  
  <before-saving>
    <checklist>
      <check>No ESLint errors (warnings are OK)</check>
      <check>TypeScript compiles without errors</check>
      <check>Unused variables are prefixed with _</check>
      <check>No 'var' declarations</check>
      <check>Functions under line limit</check>
    </checklist>
  </before-saving>
  
  <common-mistakes-to-avoid>
    <mistake>
      <pattern>Using 'var' instead of 'const' or 'let'</pattern>
      <fix>Always use 'const' or 'let'</fix>
    </mistake>

    <mistake>
      <pattern>Not prefixing unused parameters with underscore</pattern>
      <fix>Add underscore prefix: _unusedParam</fix>
    </mistake>
    
    <mistake>
      <pattern>Using 'any' type in source code</pattern>
      <fix>Use 'unknown' or specific type</fix>
    </mistake>
    
    <mistake>
      <pattern>Functions exceeding line limits</pattern>
      <fix>Extract helper functions or split logic</fix>
    </mistake>
    
    <mistake>
      <pattern>Using == instead of ===</pattern>
      <fix>Use strict equality (except for == null)</fix>
    </mistake>
  </common-mistakes-to-avoid>
</code-style-enforcement>
