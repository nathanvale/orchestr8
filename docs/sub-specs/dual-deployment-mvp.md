# Dual Deployment (MVP-Scoped)

> Status: Accepted for MVP (scoped)
> Date: 2025-01-17

This document defines the minimal dual deployment feature required in the MVP: one TypeScript research agent that can run as a standalone microservice and as a Claude sub‑agent, sharing a single implementation and prompt templates.

## Goals

- Single agent runs in two modes without code duplication
- Shared prompt engine; allow XML templates for this agent only
- Keep workflows and orchestration policies as JSON
- No distributed infra, no auth, local dev only

## Non‑Goals (MVP)

- No agent registry or discovery
- No GraphQL/WebSockets
- No Kafka/NATS/Event sourcing
- No multi‑tenant or cloud deploy scaffolding

## Simplified Design (Behavior Drift Prevention)

Based on architectural review feedback, the dual deployment pattern has been simplified to minimize behavior drift between the two modes while maintaining the single-agent requirement.

### Single Source of Truth Pattern

```typescript
// Core agent with single execution path
export class ResearchAgent {
  // Single execution method - no branching by deployment mode
  async execute(
    input: AgentInput,
    context: AgentContext,
  ): Promise<AgentOutput> {
    // Unified input validation
    const validatedInput = this.validateInput(input)

    // Single prompt generation path
    const prompt = this.generatePrompt(validatedInput, context)

    // Single execution logic
    const result = await this.processRequest(prompt, context)

    // Unified output formatting
    return this.formatOutput(result, context)
  }

  // Shared validation - no mode-specific logic
  private validateInput(input: AgentInput): ValidatedInput {
    return AgentInputSchema.parse(input)
  }

  // Shared prompt generation - single XML template engine
  private generatePrompt(input: ValidatedInput, context: AgentContext): string {
    return this.promptEngine.render('research-agent', input, context)
  }

  // Shared processing logic - no adapter-specific behavior
  private async processRequest(
    prompt: string,
    context: AgentContext,
  ): Promise<RawResult> {
    // Single execution path regardless of deployment mode
    return await this.llmProvider.process(prompt, context)
  }

  // Shared output formatting - consistent across modes
  private formatOutput(result: RawResult, context: AgentContext): AgentOutput {
    return AgentOutputSchema.parse({
      result: result.content,
      metadata: {
        executionId: context.executionId,
        timestamp: new Date().toISOString(),
        correlationId: context.correlationId,
      },
    })
  }
}
```

### Thin Adapter Layer (Minimal Surface Area)

```typescript
// Microservice adapter - ONLY handles HTTP concerns
export class MicroserviceAdapter {
  constructor(private agent: ResearchAgent) {}

  // Minimal HTTP mapping - no business logic
  async handleRequest(
    req: express.Request,
    res: express.Response,
  ): Promise<void> {
    try {
      const input = req.body
      const context = this.createContextFromRequest(req)

      // Direct delegation to core agent
      const output = await this.agent.execute(input, context)

      res.json({ success: true, data: output })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  private createContextFromRequest(req: express.Request): AgentContext {
    return {
      executionId: (req.headers['x-execution-id'] as string) || generateId(),
      correlationId:
        (req.headers['x-correlation-id'] as string) || generateId(),
      mode: 'microservice',
    }
  }
}

// Claude sub-agent adapter - ONLY handles Claude integration
export class ClaudeSubAgentAdapter {
  constructor(private agent: ResearchAgent) {}

  // Minimal Claude mapping - no business logic
  async handleRequest(input: any, claudeContext: any): Promise<any> {
    const context = this.createContextFromClaude(claudeContext)

    // Direct delegation to core agent
    const output = await this.agent.execute(input, context)

    return output
  }

  private createContextFromClaude(claudeContext: any): AgentContext {
    return {
      executionId: claudeContext.executionId || generateId(),
      correlationId: claudeContext.correlationId || generateId(),
      mode: 'claude-subagent',
    }
  }
}
```

### Behavior Drift Prevention Measures

**1. Single Code Path Enforcement:**

- No conditional logic based on deployment mode
- Shared validation, processing, and output formatting
- Same error handling across both modes

**2. Identical Input/Output Contracts:**

```typescript
// Shared schemas - no mode-specific variations
export const AgentInputSchema = z.object({
  query: z.string().min(1).max(1000),
  context: z.record(z.any()).optional(),
  options: z
    .object({
      maxResults: z.number().int().min(1).max(20).default(5),
      timeout: z.number().int().min(1000).max(30000).default(10000),
    })
    .optional(),
})

export const AgentOutputSchema = z.object({
  result: z.string(),
  metadata: z.object({
    executionId: z.string(),
    timestamp: z.string(),
    correlationId: z.string(),
  }),
})
```

**3. Prompt Template Consistency:**

- Single XML template for both modes
- No mode-specific prompt variations
- Template rendering isolated in shared engine

**4. Configuration Unification:**

```typescript
// Single configuration object - no mode-specific settings
export interface AgentConfig {
  llmProvider: {
    type: 'openai' | 'anthropic'
    apiKey: string
    model: string
    timeout: number
  }
  promptTemplate: string
  validation: {
    maxInputLength: number
    maxOutputLength: number
  }
  // NO mode-specific configuration
}
```

### Simplified Microservice Adapter

- **Framework**: Express (minimal)
- **Port Configuration**: Port 3001 (separate from main REST API on port 3000)
- **Endpoints** (prefixed to avoid path collisions):
  - `POST /agent/process` → Direct delegation to `agent.execute()`
  - `GET /agent/health` → Simple status check
- **Responsibilities**: Only HTTP protocol concerns
- **Forbidden**: Business logic, input transformation, output modification
- **Deployment Note**: Runs as separate process on different port to avoid conflicts

### Simplified Claude Sub-Agent Adapter

- **Export**: Single function `handleRequest(input, context)`
- **Responsibilities**: Only Claude integration concerns
- **Implementation**: Direct delegation to `agent.execute()`
- **Forbidden**: Input interpretation, output transformation, mode-specific logic

### Prompts and Templates

- **Single XML template** for the research agent
- **No mode-specific variations** in prompt generation
- **Shared template engine** with identical rendering logic
- **Template validation** ensures consistency across modes

## Testing (Behavior Drift Prevention)

### Core Equivalence Testing

```typescript
describe('Dual Deployment Behavior Equivalence', () => {
  const testCases = [
    { input: { query: 'test query' }, expected: 'mocked response' },
    {
      input: { query: 'complex query', context: { key: 'value' } },
      expected: 'mocked complex response',
    },
  ]

  describe.each(testCases)('Input: $input', ({ input, expected }) => {
    test('Both adapters produce identical output', async () => {
      // Setup identical mocks for both modes
      const mockLLMResponse = { content: expected }
      mockLLMProvider.process.mockResolvedValue(mockLLMResponse)

      // Execute via microservice adapter
      const microserviceContext = {
        executionId: 'test-1',
        correlationId: 'corr-1',
        mode: 'microservice',
      }
      const microserviceOutput = await agent.execute(input, microserviceContext)

      // Execute via Claude sub-agent adapter
      const claudeContext = {
        executionId: 'test-1',
        correlationId: 'corr-1',
        mode: 'claude-subagent',
      }
      const claudeOutput = await agent.execute(input, claudeContext)

      // Verify identical outputs (excluding mode-specific metadata)
      expect(normalizeOutput(microserviceOutput)).toEqual(
        normalizeOutput(claudeOutput),
      )
    })

    test('Both adapters generate identical prompts', async () => {
      const microserviceContext = {
        executionId: 'test-1',
        correlationId: 'corr-1',
        mode: 'microservice',
      }
      const claudeContext = {
        executionId: 'test-1',
        correlationId: 'corr-1',
        mode: 'claude-subagent',
      }

      const microservicePrompt = agent.generatePrompt(
        input,
        microserviceContext,
      )
      const claudePrompt = agent.generatePrompt(input, claudeContext)

      expect(microservicePrompt).toEqual(claudePrompt)
    })
  })
})

function normalizeOutput(output: AgentOutput): Omit<AgentOutput, 'metadata'> {
  // Remove metadata that may differ between modes for equivalence testing
  const { metadata, ...normalizedOutput } = output
  return normalizedOutput
}
```

### Adapter Isolation Testing

```typescript
describe('Adapter Isolation', () => {
  test('Microservice adapter only handles HTTP concerns', async () => {
    const agentSpy = jest.spyOn(agent, 'execute')
    const req = mockRequest({ body: { query: 'test' } })
    const res = mockResponse()

    await microserviceAdapter.handleRequest(req, res)

    // Verify adapter only does protocol conversion
    expect(agentSpy).toHaveBeenCalledWith(
      { query: 'test' },
      expect.objectContaining({ mode: 'microservice' }),
    )
    expect(agentSpy).toHaveBeenCalledTimes(1)
  })

  test('Claude adapter only handles Claude integration', async () => {
    const agentSpy = jest.spyOn(agent, 'execute')
    const input = { query: 'test' }
    const claudeContext = { executionId: 'claude-1' }

    await claudeAdapter.handleRequest(input, claudeContext)

    // Verify adapter only does protocol conversion
    expect(agentSpy).toHaveBeenCalledWith(
      input,
      expect.objectContaining({ mode: 'claude-subagent' }),
    )
    expect(agentSpy).toHaveBeenCalledTimes(1)
  })
})
```

### Behavior Drift Detection

```typescript
describe('Behavior Drift Detection', () => {
  test('No conditional logic based on deployment mode', () => {
    // Static analysis test - verify no mode-specific branching in core agent
    const agentSource = fs.readFileSync('./src/research-agent.ts', 'utf-8')

    // Should not contain mode-specific conditional logic
    expect(agentSource).not.toMatch(/if.*mode.*===.*['"]microservice['"]/)
    expect(agentSource).not.toMatch(/if.*mode.*===.*['"]claude-subagent['"]/)
    expect(agentSource).not.toMatch(/switch.*mode/)
  })

  test('Configuration contains no mode-specific settings', () => {
    const config = loadAgentConfig()

    // Verify no mode-specific configuration branches
    expect(config).not.toHaveProperty('microservice')
    expect(config).not.toHaveProperty('claude')
    expect(config).not.toHaveProperty('adapters')
  })

  test('Input/Output schemas are mode-agnostic', () => {
    // Verify schemas don't reference deployment modes
    const inputSchemaStr = AgentInputSchema.toString()
    const outputSchemaStr = AgentOutputSchema.toString()

    expect(inputSchemaStr).not.toMatch(/microservice|claude|adapter|mode/)
    expect(outputSchemaStr).not.toMatch(/microservice|claude|adapter|mode/)
  })
})
```

### Error Handling Equivalence

```typescript
describe('Error Handling Equivalence', () => {
  const errorScenarios = [
    { name: 'Validation Error', error: new ValidationError('Invalid input') },
    { name: 'LLM Provider Error', error: new LLMProviderError('API timeout') },
    { name: 'Network Error', error: new NetworkError('Connection failed') },
  ]

  describe.each(errorScenarios)('$name', ({ error }) => {
    test('Both adapters handle errors identically', async () => {
      mockLLMProvider.process.mockRejectedValue(error)

      const input = { query: 'test' }

      // Test microservice adapter error handling
      const microserviceContext = {
        executionId: 'test-1',
        mode: 'microservice',
      }
      const microservicePromise = agent.execute(input, microserviceContext)

      // Test Claude adapter error handling
      const claudeContext = { executionId: 'test-1', mode: 'claude-subagent' }
      const claudePromise = agent.execute(input, claudeContext)

      // Both should throw the same error type and message
      await expect(microservicePromise).rejects.toThrow(error.constructor)
      await expect(claudePromise).rejects.toThrow(error.constructor)

      await expect(microservicePromise).rejects.toHaveProperty(
        'message',
        error.message,
      )
      await expect(claudePromise).rejects.toHaveProperty(
        'message',
        error.message,
      )
    })
  })
})
```

### Testing Strategy

- **Vitest + MSW** for HTTP mocking and test execution
- **Equivalence testing** verifies identical behavior across adapters
- **Isolation testing** ensures adapters only handle protocol concerns
- **Static analysis** detects mode-specific conditional logic
- **Error scenario coverage** validates consistent error handling
- **Configuration validation** prevents mode-specific settings

## Observability

- Minimal OpenTelemetry spans around adapters and `runAgent`
- Correlation ID passed via headers and injected into context

## Deliverables (Simplified Architecture)

### Core Implementation

- **ResearchAgent class** with single execution path
- **Shared Zod schemas** for input/output validation
- **Single XML prompt template** with unified rendering engine
- **Unified configuration** with no mode-specific settings

### Thin Adapter Layer

- **MicroserviceAdapter** - minimal HTTP protocol handling only (port 3001)
- **ClaudeSubAgentAdapter** - minimal Claude integration only
- **Express endpoints** - `/agent/process` and `/agent/health` with direct delegation
- **Protocol conversion utilities** - request/response mapping only
- **Port separation** - Agent microservice on 3001, main REST API on 3000

### Behavior Drift Prevention

- **Equivalence test suite** - verifies identical behavior across modes
- **Static analysis tests** - prevents mode-specific conditional logic
- **Configuration validation** - ensures unified settings
- **Error handling tests** - validates consistent error behavior

### Documentation

- **README with dual mode instructions** - clear setup for both deployments
- **Architecture decision record** - documenting simplified approach
- **Testing guide** - behavior drift prevention methodology
- **Troubleshooting guide** - common issues and resolution patterns

### Quality Assurance

- **Test coverage**: 95%+ for core agent, 90%+ for adapters
- **Behavior equivalence**: 100% output consistency across modes
- **Static analysis**: Zero mode-specific conditionals detected
- **Error handling**: Complete coverage of error scenarios
