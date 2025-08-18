# JSON Prompt Schema Specification

This defines the canonical JSON prompt configuration format for @orchestr8 agents.

> Created: 2025-01-17
> Version: 1.0.0 (MVP)
> Scope: JSON prompts only (no XML in MVP)

## Overview

The JSON Prompt Schema provides a structured format for agent prompts that ensures consistency, validation, and safety across all agents in the @orchestr8 system.

## Canonical Fields

Every agent prompt must include these standard fields:

```typescript
interface AgentPrompt {
  // Schema versioning (per ADR-002)
  schemaVersion: string // Schema version (semver)
  schemaHash: string // SHA-256 hash of schema structure

  // Identity
  role: string // Agent's role/persona
  version: string // Prompt version (semver)

  // Objectives
  goals: string[] // Primary objectives
  constraints: string[] // Limitations and boundaries

  // Capabilities
  tools: ToolDefinition[] // Available tools/functions

  // Execution
  steps: ExecutionStep[] // Sequential instructions

  // Data
  inputSchema: JsonSchema // Expected input format
  outputSchema: JsonSchema // Required output format

  // Safety
  guardrails: SafetyGuardrail[] // Safety constraints

  // Examples (optional)
  examples?: PromptExample[] // Input/output examples
}
```

## Zod Validation Schema

```typescript
import { z } from 'zod'

// Tool definition schema
const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.any()),
  required: z.boolean().default(false),
})

// Execution step schema
const ExecutionStepSchema = z.object({
  number: z.number(),
  description: z.string(),
  action: z.string(),
  validation: z.string().optional(),
  onError: z.enum(['fail', 'continue', 'retry']).default('fail'),
})

// Safety guardrail schema
const SafetyGuardrailSchema = z.object({
  type: z.enum(['content', 'behavior', 'output']),
  rule: z.string(),
  enforcement: z.enum(['block', 'warn', 'log']).default('block'),
})

// Example schema
const PromptExampleSchema = z.object({
  input: z.any(),
  output: z.any(),
  description: z.string().optional(),
})

// Main prompt schema with versioning (per ADR-002)
export const AgentPromptSchema = z.object({
  // Schema versioning
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  schemaHash: z.string().regex(/^[a-f0-9]{64}$/), // SHA-256 hash

  // Identity
  role: z.string().min(1).max(500),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),

  // Objectives
  goals: z.array(z.string()).min(1).max(10),
  constraints: z.array(z.string()).max(20),

  // Capabilities
  tools: z.array(ToolDefinitionSchema).default([]),

  // Execution
  steps: z.array(ExecutionStepSchema).min(1),

  // Data
  inputSchema: z.record(z.any()), // JSON Schema object
  outputSchema: z.record(z.any()), // JSON Schema object

  // Safety
  guardrails: z.array(SafetyGuardrailSchema).default([]),

  // Examples
  examples: z.array(PromptExampleSchema).optional(),
})

export type AgentPrompt = z.infer<typeof AgentPromptSchema>

// Schema versioning utilities (per ADR-002)
export class PromptSchemaValidator {
  private static readonly CURRENT_SCHEMA_VERSION = '1.0.0'

  static calculateSchemaHash(schema: any): string {
    // IMPORTANT: Generate canonical representation for stable hashing
    // This avoids brittleness from Zod internals changing across versions
    const canonicalSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      version: this.CURRENT_SCHEMA_VERSION,
      type: 'object',
      // Extract field names and types, NOT Zod internals
      fields: Object.keys(schema).sort(),
      // Use a stable type representation
      fieldTypes: this.extractStableTypes(schema),
    }

    // Deterministic JSON serialization with sorted keys
    const sortedJson = JSON.stringify(
      canonicalSchema,
      Object.keys(canonicalSchema).sort(),
    )

    return crypto.createHash('sha256').update(sortedJson).digest('hex')
  }

  private static extractStableTypes(schema: any): Record<string, string> {
    // Extract type information in a stable way that doesn't depend on Zod internals
    const types: Record<string, string> = {}
    for (const [key, value] of Object.entries(schema)) {
      // Get the type name from Zod schema in a stable way
      types[key] = this.getStableTypeName(value)
    }
    return types
  }

  static validateSchemaHash(prompt: any): boolean {
    const expectedHash = this.calculateSchemaHash(AgentPromptSchema.shape)
    return prompt.schemaHash === expectedHash
  }

  static validatePromptWithVersioning(data: unknown): AgentPrompt {
    const parsed = AgentPromptSchema.parse(data)

    // Validate schema version compatibility
    if (!this.isVersionCompatible(parsed.schemaVersion)) {
      throw new Error(`Unsupported schema version: ${parsed.schemaVersion}`)
    }

    // Validate schema hash
    if (!this.validateSchemaHash(parsed)) {
      throw new Error(
        `Schema hash mismatch. Expected current schema structure.`,
      )
    }

    return parsed
  }

  private static isVersionCompatible(version: string): boolean {
    const [major] = version.split('.').map(Number)
    const [currentMajor] = this.CURRENT_SCHEMA_VERSION.split('.').map(Number)

    // Major version must match for compatibility
    return major === currentMajor
  }

  private static extractTypes(schema: any): Record<string, string> {
    const types: Record<string, string> = {}

    for (const [key, value] of Object.entries(schema)) {
      if (value && typeof value === 'object' && '_def' in value) {
        types[key] = (value as any)._def.typeName || 'unknown'
      }
    }

    return types
  }
}
```

## Example JSON Prompt

```json
{
  "schemaVersion": "1.0.0",
  "schemaHash": "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890",

  "role": "GitHub Repository Research Specialist",
  "version": "1.0.0",

  "goals": [
    "Analyze GitHub repositories for quality metrics",
    "Extract contributor patterns and activity",
    "Assess project health and maintenance status"
  ],

  "constraints": [
    "Only access public repositories",
    "Respect GitHub API rate limits",
    "Do not make any modifications",
    "Maximum 100 API calls per execution"
  ],

  "tools": [
    {
      "name": "github_api",
      "description": "Access GitHub API for repository data",
      "parameters": {
        "endpoint": "string",
        "method": "GET|POST",
        "body": "object"
      },
      "required": true
    },
    {
      "name": "web_search",
      "description": "Search for additional context",
      "parameters": {
        "query": "string",
        "limit": "number"
      },
      "required": false
    }
  ],

  "steps": [
    {
      "number": 1,
      "description": "Fetch repository metadata",
      "action": "Use github_api to get repository info",
      "validation": "Ensure repository exists and is public",
      "onError": "fail"
    },
    {
      "number": 2,
      "description": "Analyze contributors",
      "action": "Get contributor statistics",
      "validation": "At least one contributor found",
      "onError": "continue"
    },
    {
      "number": 3,
      "description": "Calculate health metrics",
      "action": "Process activity data",
      "validation": "All metrics calculated",
      "onError": "retry"
    }
  ],

  "inputSchema": {
    "type": "object",
    "properties": {
      "owner": { "type": "string" },
      "repo": { "type": "string" },
      "depth": { "type": "number", "default": 30 }
    },
    "required": ["owner", "repo"]
  },

  "outputSchema": {
    "type": "object",
    "properties": {
      "metadata": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "stars": { "type": "number" },
          "forks": { "type": "number" }
        }
      },
      "health": {
        "type": "object",
        "properties": {
          "score": { "type": "number" },
          "status": { "enum": ["active", "maintained", "deprecated"] }
        }
      }
    },
    "required": ["metadata", "health"]
  },

  "guardrails": [
    {
      "type": "behavior",
      "rule": "Never access private repositories",
      "enforcement": "block"
    },
    {
      "type": "output",
      "rule": "Redact any PII found in data",
      "enforcement": "block"
    },
    {
      "type": "content",
      "rule": "No profanity in generated summaries",
      "enforcement": "warn"
    }
  ],

  "examples": [
    {
      "input": {
        "owner": "facebook",
        "repo": "react"
      },
      "output": {
        "metadata": {
          "name": "react",
          "stars": 218000,
          "forks": 45000
        },
        "health": {
          "score": 95,
          "status": "active"
        }
      },
      "description": "Analyze a highly active repository"
    }
  ]
}
```

## Provider Abstraction

The prompt system works with a minimal LLM provider interface:

```typescript
interface LLMProvider {
  name: string

  // Execute prompt with agent configuration
  execute(
    prompt: AgentPrompt,
    input: unknown,
    options?: LLMOptions,
  ): Promise<unknown>
}

interface LLMOptions {
  temperature?: number // 0.0 - 1.0
  maxTokens?: number // Maximum response tokens
  timeout?: number // Execution timeout (ms)

  // MVP: Claude-only for now
  model?: 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku'
}

// MVP Implementation (Claude only)
export class ClaudeProvider implements LLMProvider {
  name = 'claude'

  async execute(
    prompt: AgentPrompt,
    input: unknown,
    options: LLMOptions = {},
  ): Promise<unknown> {
    // Validate input against schema
    const validatedInput = this.validateInput(prompt.inputSchema, input)

    // Format prompt for Claude
    const formattedPrompt = this.formatPrompt(prompt, validatedInput)

    // Call Claude API with retry logic
    const response = await this.callClaude(formattedPrompt, {
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 4096,
      model: options.model ?? 'claude-3-sonnet',
    })

    // Validate output against schema
    const validatedOutput = this.validateOutput(prompt.outputSchema, response)

    // Apply guardrails
    return this.applyGuardrails(prompt.guardrails, validatedOutput)
  }

  private formatPrompt(prompt: AgentPrompt, input: unknown): string {
    return `
Role: ${prompt.role}

Goals:
${prompt.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

Constraints:
${prompt.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Available Tools:
${prompt.tools.map((t) => `- ${t.name}: ${t.description}`).join('\n')}

Instructions:
${prompt.steps.map((s) => `${s.number}. ${s.description}\n   Action: ${s.action}`).join('\n')}

Input:
${JSON.stringify(input, null, 2)}

Please provide output matching this schema:
${JSON.stringify(prompt.outputSchema, null, 2)}
    `.trim()
  }
}
```

## Enhanced Prompt Injection Safety

### Safe Variable Mapping

```typescript
// Restricted mapping grammar - no dynamic execution
type SafeMappingPattern =
  | `\${steps.${string}.output.${string}}` // Step outputs
  | `\${variables.${string}}` // Variables
  | `\${env.${string}}` // Environment vars
  | `\${context.${string}}` // Context data

class SafeMappingResolver {
  private readonly allowedRoots = ['steps', 'variables', 'env', 'context']

  validatePath(path: string): boolean {
    // Strict pattern matching
    const pattern = /^\$\{([a-zA-Z]+)\.([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)\}$/
    const match = path.match(pattern)

    if (!match) return false

    const [_, root] = match
    return this.allowedRoots.includes(root)
  }

  resolve(data: any, path: string): any {
    if (!this.validatePath(path)) {
      throw new Error(`Invalid mapping path: ${path}`)
    }

    // Safe property access - no eval()
    const cleanPath = path.slice(2, -1) // Remove ${ and }
    const parts = cleanPath.split('.')

    return parts.reduce((curr, part) => {
      if (curr === null || curr === undefined) return undefined
      if (typeof curr !== 'object') return undefined
      return curr[part]
    }, data)
  }
}
```

### Context Isolation

```typescript
interface IsolatedPromptContext {
  system: string // System instructions - no user data
  user: string // User input - isolated channel
  assistant?: string // Assistant role/context
}

class PromptSafetyManager {
  // Never mix user input with system instructions
  composeIsolatedPrompt(
    config: AgentPrompt,
    userInput: unknown,
  ): IsolatedPromptContext {
    // Validate and sanitize user input
    const validated = this.validateUserInput(userInput, config.inputSchema)

    return {
      // System channel - configuration only
      system: this.buildSystemPrompt(config),

      // User channel - isolated input
      user: JSON.stringify(validated),

      // Assistant context
      assistant: config.role,
    }
  }

  private buildSystemPrompt(config: AgentPrompt): string {
    // Only use configuration data - no user input
    return `
Role: ${config.role}
Version: ${config.version}

Goals:
${config.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

Constraints:
${config.constraints.map((c, i) => `- ${c}`).join('\n')}

Available Tools:
${config.tools.map((t) => `- ${t.name}: ${t.description}`).join('\n')}

Output must conform to the specified JSON schema.
    `.trim()
  }

  private validateUserInput(input: unknown, schema: object): unknown {
    // Use AJV for strict JSON Schema validation
    const ajv = new Ajv({ strict: true, allErrors: true })
    const validate = ajv.compile(schema)

    if (!validate(input)) {
      throw new ValidationError('Input validation failed', validate.errors)
    }

    return input
  }
}
```

### JMESPath Safety

```typescript
import jmespath from 'jmespath'

class SafeJMESPath {
  // Allowed JMESPath functions (safe subset)
  private readonly allowedFunctions = new Set([
    'length',
    'keys',
    'values',
    'type',
    'contains',
    'starts_with',
    'ends_with',
    'max',
    'min',
    'sum',
    'avg',
    'sort',
  ])

  // Dangerous patterns to block
  private readonly dangerousPatterns = [
    /\beval\b/i,
    /\bexec\b/i,
    /\bFunction\b/,
    /\bconstructor\b/,
    /\b__proto__\b/,
    /\bprototype\b/,
  ]

  // Cache compiled expressions
  private cache = new Map<string, any>()

  validate(expression: string): boolean {
    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(expression)) {
        return false
      }
    }

    // Validate function usage
    const functionCalls = expression.match(/\b(\w+)\s*\(/g) || []
    for (const call of functionCalls) {
      const funcName = call.replace(/\s*\($/, '')
      if (!this.allowedFunctions.has(funcName)) {
        return false
      }
    }

    return true
  }

  async evaluate(data: any, expression: string): Promise<any> {
    if (!this.validate(expression)) {
      throw new Error(`Unsafe JMESPath expression: ${expression}`)
    }

    // Use cached compiled expression
    let compiled = this.cache.get(expression)
    if (!compiled) {
      compiled = jmespath.compile(expression)
      this.cache.set(expression, compiled)
    }

    // Execute with timeout to prevent DoS
    return await this.withTimeout(
      () => compiled.search(data),
      100, // 100ms timeout
    )
  }

  private async withTimeout<T>(fn: () => T, ms: number): Promise<T> {
    return Promise.race([
      Promise.resolve(fn()),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('JMESPath timeout')), ms),
      ),
    ])
  }
}
```

### Secret Handling

```typescript
class SecretHandler {
  // Never include secrets in prompt text
  preparePrompt(
    prompt: AgentPrompt,
    secrets: Map<string, string>,
  ): AgentPrompt {
    // Replace secret references with placeholders
    const sanitized = JSON.parse(JSON.stringify(prompt))

    // Never put actual secret values in the prompt
    for (const [key, _] of secrets) {
      // Use placeholder instead
      sanitized.secretPlaceholders = sanitized.secretPlaceholders || {}
      sanitized.secretPlaceholders[key] = `<SECRET:${key}>`
    }

    return sanitized
  }

  // Secure tool resolution
  resolveToolWithSecrets(
    toolName: string,
    params: any,
    secrets: Map<string, string>,
  ): any {
    const resolved = { ...params }

    // Only resolve secrets at execution time
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('<SECRET:')) {
        const secretKey = value.slice(8, -1)
        resolved[key] = secrets.get(secretKey)
      }
    }

    return resolved
  }
}
```

## Validation and Testing

```typescript
// Validate a prompt configuration
export function validatePrompt(data: unknown): AgentPrompt {
  try {
    return AgentPromptSchema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new PromptValidationError(
        'Invalid prompt configuration',
        error.errors,
      )
    }
    throw error
  }
}

// Test prompt with mock provider
export async function testPrompt(
  prompt: AgentPrompt,
  testCases: Array<{ input: any; expectedOutput: any }>,
): Promise<TestResults> {
  const results: TestResults = {
    passed: 0,
    failed: 0,
    errors: [],
  }

  const mockProvider = new MockLLMProvider()

  for (const testCase of testCases) {
    try {
      const output = await mockProvider.execute(prompt, testCase.input)

      if (deepEqual(output, testCase.expectedOutput)) {
        results.passed++
      } else {
        results.failed++
        results.errors.push({
          input: testCase.input,
          expected: testCase.expectedOutput,
          actual: output,
        })
      }
    } catch (error) {
      results.failed++
      results.errors.push({
        input: testCase.input,
        error: error.message,
      })
    }
  }

  return results
}
```

## MVP Constraints

- **JSON only**: No XML prompt support in MVP
- **Claude provider only**: Multi-provider support deferred
- **Basic guardrails**: Advanced safety features post-MVP
- **Simple tool resolution**: No complex tool chaining
- **Local secrets**: No external secret management

## Anthropic Best Practices Integration

### Enhanced JSON Prompt Structure with Anthropic Patterns

Based on Anthropic's proven prompt engineering research, the JSON prompt schema now supports enterprise-grade patterns for 95%+ instruction adherence:

```typescript
// Enhanced Agent Prompt with Anthropic Best Practices
interface EnhancedAgentPrompt extends AgentPrompt {
  // Anthropic Best Practice Fields
  roleDefinition: RoleDefinition // Clear identity and capabilities
  contextInjection: ContextInjection // Structured context management
  chainOfThought: ChainOfThoughtConfig // Structured reasoning patterns
  multiShotExamples: MultiShotExample[] // Task-specific examples
  qualityMeasurement: QualityConfig // Adherence and quality metrics
}

interface RoleDefinition {
  identity: string // Clear role statement
  expertise_level: string // Domain expertise description
  capabilities: string[] // What the agent can do
  constraints: string[] // What the agent MUST NOT do
  communication_style: 'formal' | 'conversational' | 'technical'
}

interface ContextInjection {
  execution_context: Record<string, any> // Workflow/execution metadata
  user_context: Record<string, any> // User preferences and constraints
  agent_context: Record<string, any> // Agent configuration and state
  domain_context?: Record<string, any> // Domain-specific information
}

interface ChainOfThoughtConfig {
  enabled: boolean // Enable structured reasoning
  complexity_threshold: 'simple' | 'moderate' | 'complex'
  reasoning_steps: string[] // Required reasoning phases
  confidence_assessment: boolean // Require confidence scoring
  alternative_consideration: boolean // Consider alternative approaches
}

interface MultiShotExample {
  scenario: string // Example scenario description
  input: any // Example input data
  thinking?: string // Chain of thought reasoning
  output: any // Expected output
  success_criteria: string[] // What makes this a good example
}

interface QualityConfig {
  adherence_threshold: number // Minimum adherence score (0-100)
  consistency_requirements: string[] // Consistency criteria
  validation_rules: string[] // Quality validation rules
  measurement_enabled: boolean // Enable quality measurement
}
```

### Clear and Direct Communication Patterns

Following Anthropic's research on clear communication:

```typescript
// Clear instruction templates for JSON prompts
const CLEAR_INSTRUCTION_PATTERNS = {
  // Direct action words
  action_verbs: [
    'Analyze',
    'Extract',
    'Generate',
    'Validate',
    'Transform',
    'Summarize',
    'Compare',
    'Classify',
    'Evaluate',
    'Synthesize',
  ],

  // Specific constraint language
  constraint_patterns: [
    'You MUST NOT {action}',
    'You MUST {action}',
    'NEVER {action}',
    'ALWAYS {action}',
    'ONLY {action} when {condition}',
  ],

  // Output format specifications
  output_specifications: [
    'Respond with valid JSON matching the schema exactly',
    'Include all required fields without exception',
    'Ensure numerical values are within specified ranges',
    'Use only the provided enumeration values',
  ],
}

// Example clear instruction formatting
function formatClearInstructions(prompt: AgentPrompt): string {
  return `
## Primary Objective
${prompt.goals[0]} // Single, clear primary goal

## Specific Tasks
${prompt.steps
  .map((step, i) => `${i + 1}. ${step.action} - ${step.description}`)
  .join('\n')}

## Strict Requirements
${prompt.constraints.map((constraint) => `• ${constraint}`).join('\n')}

## Output Format
Respond with JSON matching this exact schema:
${JSON.stringify(prompt.outputSchema, null, 2)}

## Quality Standards
- Accuracy: 95% minimum
- Completeness: All required fields
- Consistency: Maintain terminology throughout
`
}
```

### XML Tag Simulation in JSON

While MVP uses JSON, we can simulate XML's structured benefits:

```typescript
// JSON structure that mimics XML tag benefits
interface XMLStyleJSONPrompt {
  ai_meta: {
    parsing_rules: string[] // How to process the prompt
    quality_requirements: string[] // Expected quality standards
    failure_conditions: string[] // What constitutes failure
  }

  role_definition: {
    identity: string
    capabilities: string[]
    constraints: string[]
    expertise_level: string
  }

  task_specification: {
    primary_objective: string
    processing_steps: ProcessingStep[]
    validation_requirements: string[]
    output_requirements: string[]
  }

  examples_and_patterns: {
    successful_examples: MultiShotExample[]
    error_examples: ErrorExample[]
    edge_case_examples: EdgeCaseExample[]
  }

  quality_framework: {
    validation_checklist: string[]
    success_criteria: string[]
    quality_thresholds: Record<string, number>
  }
}

interface ProcessingStep {
  step_number: number
  description: string
  reasoning_required: boolean
  validation_checkpoint: string
  error_handling: 'fail' | 'continue' | 'retry'
}

interface ErrorExample {
  scenario: string
  problematic_input: any
  error_type: string
  correct_response: string
  lesson: string
}

interface EdgeCaseExample {
  scenario: string
  challenging_input: any
  approach: string
  expected_output: any
  rationale: string
}
```

### Multishot Learning Implementation

Enhanced example system based on Anthropic's multishot research:

```typescript
// Multishot example system for consistent behavior
class MultiShotExampleManager {
  // Generate contextually relevant examples
  generateContextualExamples(
    prompt: AgentPrompt,
    input: any,
    contextSimilarity: number = 0.8,
  ): MultiShotExample[] {
    const baseExamples = prompt.examples || []

    // Select examples based on input similarity and complexity
    const relevant = baseExamples.filter(
      (example) =>
        this.calculateSimilarity(example.input, input) >= contextSimilarity,
    )

    // Ensure we have examples for different complexity levels
    const complexityLevels = ['simple', 'moderate', 'complex']
    const balancedExamples: MultiShotExample[] = []

    for (const level of complexityLevels) {
      const levelExamples = relevant.filter(
        (ex) => this.assessComplexity(ex.input) === level,
      )

      if (levelExamples.length > 0) {
        balancedExamples.push(levelExamples[0])
      }
    }

    return balancedExamples.slice(0, 3) // Maximum 3 examples for token efficiency
  }

  // Format examples for optimal learning
  formatExamplesForPrompt(examples: MultiShotExample[]): string {
    return examples
      .map(
        (example, index) => `
## Example ${index + 1}: ${example.scenario}

**Input:**
\`\`\`json
${JSON.stringify(example.input, null, 2)}
\`\`\`

${
  example.thinking
    ? `**Reasoning:**
${example.thinking}`
    : ''
}

**Output:**
\`\`\`json
${JSON.stringify(example.output, null, 2)}
\`\`\`

**Key Success Factors:**
${example.success_criteria.map((criteria) => `• ${criteria}`).join('\n')}
`,
      )
      .join('\n')
  }

  private calculateSimilarity(input1: any, input2: any): number {
    // Simple similarity calculation based on shared properties
    const keys1 = new Set(Object.keys(input1))
    const keys2 = new Set(Object.keys(input2))
    const intersection = new Set([...keys1].filter((k) => keys2.has(k)))
    const union = new Set([...keys1, ...keys2])

    return intersection.size / union.size
  }

  private assessComplexity(input: any): 'simple' | 'moderate' | 'complex' {
    const keyCount = Object.keys(input).length
    const hasNestedObjects = Object.values(input).some(
      (v) => typeof v === 'object' && v !== null,
    )
    const hasArrays = Object.values(input).some(Array.isArray)

    if (keyCount <= 3 && !hasNestedObjects) return 'simple'
    if (keyCount <= 6 && (!hasNestedObjects || !hasArrays)) return 'moderate'
    return 'complex'
  }
}
```

### Quality Measurement Integration

Anthropic-inspired quality measurement for JSON prompts:

```typescript
// Quality measurement framework for prompt adherence
interface PromptQualityMetrics {
  instruction_adherence: number // 0-100: Did agent follow instructions?
  output_format_compliance: number // 0-100: Correct JSON schema?
  completeness_score: number // 0-100: All required fields present?
  consistency_score: number // 0-100: Consistent terminology/style?
  reasoning_quality: number // 0-100: Quality of thinking process?
  overall_quality: number // Weighted average of above
}

class PromptQualityMeasurement {
  async measureQuality(
    prompt: AgentPrompt,
    input: any,
    output: any,
    reasoning?: string,
  ): Promise<PromptQualityMetrics> {
    const metrics: PromptQualityMetrics = {
      instruction_adherence: await this.measureInstructionAdherence(
        prompt,
        output,
      ),
      output_format_compliance: this.measureFormatCompliance(
        prompt.outputSchema,
        output,
      ),
      completeness_score: this.measureCompleteness(prompt.outputSchema, output),
      consistency_score: this.measureConsistency(output),
      reasoning_quality: reasoning
        ? this.measureReasoningQuality(reasoning)
        : 100,
      overall_quality: 0,
    }

    // Calculate weighted overall quality
    metrics.overall_quality =
      metrics.instruction_adherence * 0.3 +
      metrics.output_format_compliance * 0.25 +
      metrics.completeness_score * 0.2 +
      metrics.consistency_score * 0.15 +
      metrics.reasoning_quality * 0.1

    return metrics
  }

  private async measureInstructionAdherence(
    prompt: AgentPrompt,
    output: any,
  ): Promise<number> {
    // Check if output addresses all goals
    let adherenceScore = 0

    // Verify primary objectives are met
    for (const goal of prompt.goals) {
      const isAddressed = await this.checkGoalAddressed(goal, output)
      adherenceScore += isAddressed ? 100 / prompt.goals.length : 0
    }

    // Verify constraints are respected
    for (const constraint of prompt.constraints) {
      const isViolated = await this.checkConstraintViolated(constraint, output)
      if (isViolated) {
        adherenceScore = Math.max(0, adherenceScore - 20) // Penalty for violations
      }
    }

    return Math.min(100, adherenceScore)
  }

  private measureFormatCompliance(schema: any, output: any): number {
    try {
      // Use JSON Schema validation
      const ajv = new Ajv({ strict: true })
      const validate = ajv.compile(schema)

      if (validate(output)) {
        return 100
      } else {
        // Calculate partial compliance based on error severity
        const errors = validate.errors || []
        const criticalErrors = errors.filter(
          (e) => e.keyword === 'required' || e.keyword === 'type',
        )

        if (criticalErrors.length > 0) {
          return 0 // Critical format violations
        }

        // Non-critical violations (e.g., additional properties)
        return Math.max(0, 100 - errors.length * 10)
      }
    } catch (error) {
      return 0 // Invalid JSON or schema
    }
  }

  private measureCompleteness(schema: any, output: any): number {
    const requiredFields = schema.required || []
    const outputFields = Object.keys(output)

    const presentRequired = requiredFields.filter(
      (field) =>
        outputFields.includes(field) &&
        output[field] !== null &&
        output[field] !== undefined,
    )

    return requiredFields.length > 0
      ? (presentRequired.length / requiredFields.length) * 100
      : 100
  }

  private measureConsistency(output: any): number {
    // Check for consistent terminology, formatting, and style
    const text = JSON.stringify(output)

    let consistencyScore = 100

    // Check for mixed capitalization styles
    const hasInconsistentCasing = this.checkInconsistentCasing(text)
    if (hasInconsistentCasing) consistencyScore -= 15

    // Check for mixed number formats
    const hasInconsistentNumbers = this.checkInconsistentNumbers(output)
    if (hasInconsistentNumbers) consistencyScore -= 10

    // Check for consistent boolean representation
    const hasInconsistentBooleans = this.checkInconsistentBooleans(text)
    if (hasInconsistentBooleans) consistencyScore -= 10

    return Math.max(0, consistencyScore)
  }

  private measureReasoningQuality(reasoning: string): number {
    let qualityScore = 50 // Base score

    // Check for structured thinking
    if (reasoning.includes('Analysis:') || reasoning.includes('1.'))
      qualityScore += 20

    // Check for consideration of alternatives
    if (reasoning.includes('alternative') || reasoning.includes('option'))
      qualityScore += 15

    // Check for confidence assessment
    if (reasoning.includes('confidence') || reasoning.includes('uncertain'))
      qualityScore += 10

    // Check for reasoning depth
    const sentences = reasoning.split(/[.!?]+/).length
    if (sentences >= 5) qualityScore += 5

    return Math.min(100, qualityScore)
  }

  private async checkGoalAddressed(
    goal: string,
    output: any,
  ): Promise<boolean> {
    // Simplified semantic check - in production, use NLP similarity
    const goalKeywords = goal
      .toLowerCase()
      .split(' ')
      .filter((w) => w.length > 3)
    const outputText = JSON.stringify(output).toLowerCase()

    return goalKeywords.some((keyword) => outputText.includes(keyword))
  }

  private async checkConstraintViolated(
    constraint: string,
    output: any,
  ): Promise<boolean> {
    // Check for constraint violations
    const constraintText = constraint.toLowerCase()
    const outputText = JSON.stringify(output).toLowerCase()

    if (
      constraintText.includes('never') ||
      constraintText.includes('must not')
    ) {
      // Extract prohibited terms and check if they appear
      const prohibitedTerms = this.extractProhibitedTerms(constraint)
      return prohibitedTerms.some((term) =>
        outputText.includes(term.toLowerCase()),
      )
    }

    return false
  }

  private extractProhibitedTerms(constraint: string): string[] {
    // Simple extraction - in production, use more sophisticated NLP
    const words = constraint.split(' ')
    const prohibitedIndex = words.findIndex(
      (w) =>
        w.toLowerCase().includes('never') || w.toLowerCase().includes('not'),
    )

    if (prohibitedIndex >= 0 && prohibitedIndex < words.length - 1) {
      return words.slice(prohibitedIndex + 1, prohibitedIndex + 3)
    }

    return []
  }

  private checkInconsistentCasing(text: string): boolean {
    const camelCaseMatches = text.match(/[a-z][A-Z]/g) || []
    const snake_caseMatches = text.match(/[a-z]_[a-z]/g) || []
    const kebabCaseMatches = text.match(/[a-z]-[a-z]/g) || []

    const styles = [
      camelCaseMatches.length > 0,
      snake_caseMatches.length > 0,
      kebabCaseMatches.length > 0,
    ]
    return styles.filter(Boolean).length > 1
  }

  private checkInconsistentNumbers(output: any): boolean {
    // Check for mixed number formats (strings vs numbers for same type of data)
    const numberLikeStrings = JSON.stringify(output).match(/"\d+"/g) || []
    const actualNumbers = JSON.stringify(output).match(/:\s*\d+[^"]/g) || []

    return numberLikeStrings.length > 0 && actualNumbers.length > 0
  }

  private checkInconsistentBooleans(text: string): boolean {
    const hasBooleanValues = /:\s*(true|false)/.test(text)
    const hasStringBooleans = /"(true|false|yes|no)"/.test(text)

    return hasBooleanValues && hasStringBooleans
  }
}
```

### Enhanced Provider Implementation

Updated Claude provider with Anthropic best practices:

```typescript
// Enhanced Claude provider with best practices
export class EnhancedClaudeProvider implements LLMProvider {
  name = 'claude-enhanced'
  private qualityMeasurement = new PromptQualityMeasurement()
  private exampleManager = new MultiShotExampleManager()

  async execute(
    prompt: EnhancedAgentPrompt,
    input: unknown,
    options: LLMOptions = {},
  ): Promise<EnhancedAgentResult> {
    // Validate input
    const validatedInput = this.validateInput(prompt.inputSchema, input)

    // Select contextual examples
    const examples = this.exampleManager.generateContextualExamples(
      prompt,
      validatedInput,
    )

    // Format enhanced prompt with Anthropic patterns
    const formattedPrompt = this.formatEnhancedPrompt(
      prompt,
      validatedInput,
      examples,
    )

    // Execute with quality measurement
    const startTime = Date.now()
    const response = await this.callClaude(formattedPrompt, options)
    const executionTime = Date.now() - startTime

    // Validate output
    const validatedOutput = this.validateOutput(
      prompt.outputSchema,
      response.content,
    )

    // Measure quality
    const qualityMetrics = await this.qualityMeasurement.measureQuality(
      prompt,
      validatedInput,
      validatedOutput,
      response.reasoning,
    )

    return {
      output: validatedOutput,
      reasoning: response.reasoning,
      quality_metrics: qualityMetrics,
      metadata: {
        execution_time: executionTime,
        examples_used: examples.length,
        prompt_version: prompt.version,
        adherence_score: qualityMetrics.instruction_adherence,
      },
    }
  }

  private formatEnhancedPrompt(
    prompt: EnhancedAgentPrompt,
    input: unknown,
    examples: MultiShotExample[],
  ): string {
    return `# ${prompt.roleDefinition.identity}

## Role and Expertise
${prompt.roleDefinition.identity} with ${prompt.roleDefinition.expertise_level} expertise.

## Core Capabilities
${prompt.roleDefinition.capabilities.map((cap) => `• ${cap}`).join('\n')}

## Critical Constraints
${prompt.roleDefinition.constraints.map((cons) => `• ${cons}`).join('\n')}

## Task Instructions
${prompt.steps.map((step, i) => `${i + 1}. ${step.description}\n   Action: ${step.action}`).join('\n')}

${
  examples.length > 0
    ? `## Examples for Reference
${this.exampleManager.formatExamplesForPrompt(examples)}`
    : ''
}

## Input to Process
\`\`\`json
${JSON.stringify(input, null, 2)}
\`\`\`

## Required Output Format
Respond with JSON matching this exact schema:
\`\`\`json
${JSON.stringify(prompt.outputSchema, null, 2)}
\`\`\`

${
  prompt.chainOfThought.enabled
    ? `## Reasoning Process
Think through this step-by-step:
${prompt.chainOfThought.reasoning_steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

${prompt.chainOfThought.confidence_assessment ? 'Include your confidence level (0-100) in your reasoning.' : ''}
${prompt.chainOfThought.alternative_consideration ? 'Consider alternative approaches and explain your choice.' : ''}`
    : ''
}

## Quality Requirements
- Instruction adherence: ${prompt.qualityMeasurement.adherence_threshold}% minimum
- All required fields must be present
- Follow the exact JSON schema format
- ${prompt.qualityMeasurement.consistency_requirements.join('\n- ')}

Begin your response:`
  }
}

interface EnhancedAgentResult {
  output: unknown
  reasoning?: string
  quality_metrics: PromptQualityMetrics
  metadata: {
    execution_time: number
    examples_used: number
    prompt_version: string
    adherence_score: number
  }
}
```

## Best Practices

### Core Principles (Anthropic-Validated)

1. **Clear and Direct Instructions**: Use specific action verbs and unambiguous language
2. **Structured Context**: Separate role, capabilities, constraints, and tasks clearly
3. **Multishot Learning**: Provide 2-3 relevant examples for consistent behavior
4. **Quality Measurement**: Implement adherence scoring and continuous improvement
5. **Chain of Thought**: Enable structured reasoning for complex tasks
6. **Constraint Enforcement**: Use strong, clear language for boundaries (MUST/NEVER)

### JSON-Specific Best Practices

1. **Schema-First Design**: Define clear input/output schemas before prompt text
2. **Example Validation**: Ensure all examples match the defined schemas exactly
3. **Contextual Examples**: Select examples based on input similarity and complexity
4. **Quality Thresholds**: Set minimum adherence scores (95%+ for production)
5. **Consistency Checks**: Validate terminology, formatting, and style consistency
6. **Safety Isolation**: Keep user input separate from system instructions

### Performance Optimization

1. **Token Efficiency**: Limit examples to 3 maximum, prioritize relevance
2. **Caching**: Cache compiled schemas and validated prompts
3. **Measurement**: Track quality metrics for continuous improvement
4. **Feedback Loops**: Use quality scores to refine prompts iteratively

## Next Steps (Post-MVP)

- XML prompt template support
- Multi-provider abstraction (OpenAI, Anthropic, Google, Local)
- Advanced guardrails and safety features
- Prompt composition and inheritance
- Dynamic prompt generation
- Prompt optimization and compression
