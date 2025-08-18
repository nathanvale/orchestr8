# API Specification - Index

This API specification has been split for clarity:

- **MVP APIs** → @.agent-os/specs/2025-01-17-orchestr8-system/sub-specs/api-spec-mvp.md
- **Future APIs** → @.agent-os/specs/2025-01-17-orchestr8-system/sub-specs/api-spec-future.md

> Created: 2025-01-17
> Version: 1.0.0
> Updated: Split into MVP and Future specifications for 4-week delivery

## Quick Reference

### MVP Scope (4 weeks)

- 4 REST endpoints only
- Basic TypeScript APIs
- JSON prompts only
- Simple resilience (retry, timeout, circuit breaker)
- No authentication
- Max 10 concurrent agents

### Post-MVP (Future Phases)

- GraphQL API
- WebSocket support
- Visual workflow builder
- Time travel debugger
- Authentication & authorization
- Multi-provider LLM support
- Distributed execution

---

**Note**: The content below is preserved for reference but has been reorganized into the MVP and Future specification files above.

## Core APIs

### Orchestrator API

```typescript
/**
 * Main orchestration engine for managing agent execution
 */
export class Orchestrator {
  constructor(config?: OrchestratorConfig)

  /**
   * Register an agent with the orchestrator
   */
  registerAgent(agent: Agent): void

  /**
   * Execute a workflow with resilience policies
   */
  async execute(
    workflow: Workflow,
    context?: ExecutionContext,
  ): Promise<ExecutionResult>

  /**
   * Execute agents in parallel
   */
  async parallel<T>(...agents: Agent[]): Promise<T[]>

  /**
   * Execute agents sequentially
   */
  async sequential<T>(...agents: Agent[]): Promise<T[]>

  /**
   * Subscribe to orchestration events
   */
  on(event: OrchestratorEvent, handler: EventHandler): void

  /**
   * Get current orchestrator status
   */
  getStatus(): OrchestratorStatus
}

interface OrchestratorConfig {
  resilience?: ResilienceConfig
  telemetry?: TelemetryConfig
  maxConcurrency?: number
  timeout?: number
}

interface Workflow {
  id: string
  name: string
  version: string
  steps: WorkflowStep[]
  inputs?: Record<string, any>
  outputs?: OutputMapping[]
}

interface ExecutionResult {
  success: boolean
  outputs: Record<string, any>
  errors?: Error[]
  duration: number
  retries: number
  trace?: TraceInfo
}
```

### Agent API

```typescript
/**
 * Base class for all agents
 */
export abstract class BaseAgent {
  abstract readonly id: string
  abstract readonly version: string
  abstract readonly manifest: AgentManifest

  /**
   * Core execution method - agents only need to implement this
   */
  abstract execute(context: AgentContext): Promise<AgentResult>

  /**
   * Framework-managed execution with telemetry
   */
  async run(context: AgentContext): Promise<AgentResult>

  /**
   * Validate inputs before execution
   */
  protected validate(input: unknown): ValidationResult

  /**
   * Transform outputs after execution
   */
  protected transform(output: unknown): unknown
}

interface AgentContext {
  input: any
  metadata?: Record<string, any>
  correlationId?: string
  parentSpan?: Span
  logger?: Logger
  config?: AgentConfig
}

interface AgentResult {
  output: any
  metadata?: Record<string, any>
  status: 'success' | 'failure' | 'partial'
  errors?: Error[]
}

interface AgentManifest {
  id: string
  version: string
  displayName: string
  description: string
  author?: string
  license?: string

  contributes: {
    commands?: Command[]
    capabilities?: Capability[]
    prompts?: PromptTemplate[]
    providers?: Provider[]
  }

  requires: {
    capabilities?: string[]
    permissions?: Permission[]
    environment?: EnvironmentRequirement[]
  }

  activationEvents?: string[]
}
```

### Resilience API

```typescript
/**
 * Retry policy for handling transient failures
 */
export class RetryPolicy {
  constructor(options?: RetryOptions)

  async execute<T>(fn: () => Promise<T>): Promise<T>

  onRetry(handler: RetryHandler): void
}

interface RetryOptions {
  maxAttempts?: number
  backoff?: 'exponential' | 'linear' | 'constant'
  initialDelay?: number
  maxDelay?: number
  jitter?: boolean
  retryOn?: (error: Error) => boolean
}

/**
 * Circuit breaker for preventing cascading failures
 */
export class CircuitBreaker {
  constructor(options?: CircuitBreakerOptions)

  async execute<T>(fn: () => Promise<T>): Promise<T>

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN'

  reset(): void

  onStateChange(handler: StateChangeHandler): void
}

interface CircuitBreakerOptions {
  threshold?: number
  timeout?: number
  halfOpenAttempts?: number
  resetTimeout?: number
  failureRate?: number
}

/**
 * Timeout policy for limiting execution time
 */
export class TimeoutPolicy {
  constructor(timeout: number)

  async execute<T>(fn: () => Promise<T>): Promise<T>
}
```

### Workflow Builder API

```typescript
/**
 * Visual workflow builder interface
 */
export interface WorkflowBuilder {
  /**
   * Add a node to the workflow
   */
  addNode(node: WorkflowNode): void

  /**
   * Connect two nodes
   */
  connect(from: string, to: string, options?: ConnectionOptions): void

  /**
   * Remove a node
   */
  removeNode(nodeId: string): void

  /**
   * Get workflow as code
   */
  exportToCode(): string

  /**
   * Export as YAML
   */
  exportToYAML(): string

  /**
   * Export as XML prompt
   */
  exportToXML(): string

  /**
   * Import from various formats
   */
  import(data: string, format: 'yaml' | 'json' | 'xml'): void

  /**
   * Simulate workflow execution
   */
  simulate(inputs: any): Promise<SimulationResult>

  /**
   * Validate workflow
   */
  validate(): ValidationResult

  /**
   * Get optimization suggestions
   */
  getSuggestions(): WorkflowSuggestion[]
}

interface WorkflowNode {
  id: string
  type: 'agent' | 'parallel' | 'sequence' | 'conditional' | 'loop' | 'try-catch'
  position: { x: number; y: number }
  data: {
    agentId?: string
    label: string
    config?: any
    inputs?: PortDefinition[]
    outputs?: PortDefinition[]
  }
}

interface ConnectionOptions {
  condition?: string
  transformer?: string
  label?: string
}
```

### Time Travel Debugger API

```typescript
/**
 * Time travel debugger for execution replay
 */
export class TimeTravelDebugger {
  /**
   * Start recording an execution
   */
  startRecording(executionId: string): void

  /**
   * Stop recording
   */
  stopRecording(): ExecutionRecording

  /**
   * Load a recording for replay
   */
  loadRecording(recording: ExecutionRecording): void

  /**
   * Travel to specific point in execution
   */
  travelTo(point: number | string): ExecutionState

  /**
   * Step forward one operation
   */
  stepForward(): ExecutionState

  /**
   * Step backward one operation
   */
  stepBackward(): ExecutionState

  /**
   * Modify state and continue execution
   */
  modifyAndContinue(modifications: StateModifications): ExecutionResult

  /**
   * Set a breakpoint
   */
  setBreakpoint(location: BreakpointLocation): void

  /**
   * Export replay file
   */
  exportReplay(): ReplayFile

  /**
   * Import replay file
   */
  importReplay(file: ReplayFile): void

  /**
   * Get execution timeline
   */
  getTimeline(): ExecutionTimeline
}

interface ExecutionRecording {
  id: string
  startTime: number
  endTime: number
  snapshots: ExecutionSnapshot[]
  metadata: RecordingMetadata
}

interface ExecutionSnapshot {
  timestamp: number
  executionId: string
  agentId: string
  state: any
  inputs: any
  outputs: any
  logs: LogEntry[]
  metrics: Metrics
}
```

### CLI API

```typescript
/**
 * Command-line interface for agent development
 */
export interface CLI {
  /**
   * Create a new agent from template
   */
  createAgent(name: string, options?: CreateAgentOptions): Promise<void>

  /**
   * Test an agent
   */
  testAgent(agentPath: string, options?: TestOptions): Promise<TestResult>

  /**
   * Debug an execution
   */
  debug(executionId: string, options?: DebugOptions): Promise<void>

  /**
   * Publish agent to registry
   */
  publish(agentPath: string, options?: PublishOptions): Promise<void>

  /**
   * Search for agents
   */
  search(query: string): Promise<AgentSearchResult[]>

  /**
   * Install an agent
   */
  install(agentId: string, version?: string): Promise<void>
}

interface CreateAgentOptions {
  template?: string
  language?: 'typescript' | 'javascript'
  packageManager?: 'npm' | 'pnpm' | 'yarn'
}
```

## Event System

### Event Types

```typescript
type OrchestratorEvent =
  | 'agent:start'
  | 'agent:complete'
  | 'agent:error'
  | 'agent:retry'
  | 'workflow:start'
  | 'workflow:complete'
  | 'workflow:error'
  | 'circuitbreaker:open'
  | 'circuitbreaker:close'
  | 'circuitbreaker:halfopen'

interface EventPayload {
  timestamp: number
  eventType: OrchestratorEvent
  agentId?: string
  workflowId?: string
  data: any
  correlationId: string
}

/**
 * Event emitter for orchestration events
 */
export class OrchestratorEventEmitter {
  on(event: OrchestratorEvent, handler: EventHandler): void
  once(event: OrchestratorEvent, handler: EventHandler): void
  off(event: OrchestratorEvent, handler: EventHandler): void
  emit(event: OrchestratorEvent, payload: EventPayload): void
}
```

## REST API Endpoints

### Agent Management

```http
GET    /api/agents                 # List all registered agents
GET    /api/agents/:id             # Get agent details
POST   /api/agents                 # Register new agent
DELETE /api/agents/:id             # Unregister agent
GET    /api/agents/:id/manifest    # Get agent manifest
```

### Workflow Execution

```http
POST   /api/workflows/execute      # Execute a workflow
GET    /api/executions             # List executions
GET    /api/executions/:id         # Get execution details
DELETE /api/executions/:id         # Cancel execution
GET    /api/executions/:id/replay  # Get replay data
```

### Debugging

```http
GET    /api/debug/:executionId     # Get debug information
POST   /api/debug/:executionId/breakpoint  # Set breakpoint
POST   /api/debug/:executionId/step        # Step through execution
POST   /api/debug/:executionId/modify      # Modify and continue
```

## GraphQL API

```graphql
type Query {
  # Agent queries
  agent(id: ID!): Agent
  agents(filter: AgentFilter): [Agent!]!

  # Workflow queries
  workflow(id: ID!): Workflow
  workflows(filter: WorkflowFilter): [Workflow!]!

  # Execution queries
  execution(id: ID!): Execution
  executions(filter: ExecutionFilter): [Execution!]!

  # Debug queries
  debugSession(executionId: ID!): DebugSession
  timeline(executionId: ID!): ExecutionTimeline
}

type Mutation {
  # Agent operations
  registerAgent(input: RegisterAgentInput!): Agent!
  unregisterAgent(id: ID!): Boolean!

  # Workflow operations
  executeWorkflow(input: ExecuteWorkflowInput!): Execution!
  cancelExecution(id: ID!): Boolean!

  # Debug operations
  setBreakpoint(input: BreakpointInput!): Breakpoint!
  stepForward(executionId: ID!): ExecutionState!
  stepBackward(executionId: ID!): ExecutionState!
  modifyState(input: ModifyStateInput!): ExecutionState!
}

type Subscription {
  # Real-time monitoring
  onAgentStatusChange(agentId: ID!): AgentStatus!
  onWorkflowProgress(workflowId: ID!): WorkflowProgress!
  onExecutionUpdate(executionId: ID!): ExecutionUpdate!
  onCircuitBreakerStateChange: CircuitBreakerState!
}
```

## WebSocket API

### Real-time Debugging

```typescript
// WebSocket connection for live debugging
interface DebugWebSocket {
  // Connect to debug session
  connect(executionId: string): void

  // Send debug commands
  send(command: DebugCommand): void

  // Receive state updates
  onStateUpdate(handler: (state: ExecutionState) => void): void

  // Receive log streams
  onLog(handler: (log: LogEntry) => void): void

  // Receive metric updates
  onMetric(handler: (metric: Metric) => void): void
}
```

### Live Workflow Monitoring

```typescript
// WebSocket for workflow monitoring
interface MonitoringWebSocket {
  // Subscribe to workflow
  subscribe(workflowId: string): void

  // Receive progress updates
  onProgress(handler: (progress: WorkflowProgress) => void): void

  // Receive agent status changes
  onAgentStatus(handler: (status: AgentStatus) => void): void

  // Receive performance metrics
  onPerformance(handler: (metrics: PerformanceMetrics) => void): void
}
```
