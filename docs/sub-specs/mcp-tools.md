# MCP Tools Specification

This document defines the official Model Context Protocol (MCP) tool patterns for @orchestr8, based on Anthropic's Claude Code documentation.

> Created: 2025-01-18  
> Version: 1.0.0  
> Status: Official MCP Implementation

## Overview

MCP (Model Context Protocol) enables Claude to interact with external tools and resources through a standardized interface. This specification provides the exact patterns from Claude Code documentation for implementing MCP tools in @orchestr8.

## Core MCP Patterns

### Slash Commands for Tool Execution

MCP tools are exposed as slash commands in the format `/mcp__servername__promptname`:

```bash
# Execute without arguments
> /mcp__github__list_prs

# Execute with arguments (space-separated)
> /mcp__github__pr_review 456

# Multiple arguments
> /mcp__jira__create_issue "Bug in login flow" high
```

### Resource References with @ Mentions

Reference MCP resources using the `@` syntax followed by server, protocol, and path:

```bash
# GitHub issue reference
> Can you analyze @github:issue://123 and suggest a fix?

# Documentation reference
> Please review the API documentation at @docs:file://api/authentication

# Multiple resources in one prompt
> Compare @postgres:schema://users with @docs:file://database/user-model
```

## MCP Server Configuration

### Basic Configuration Structure

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_TOKEN": "${SLACK_TOKEN}"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DB_CONNECTION_STRING": "${DATABASE_URL}"
      }
    }
  }
}
```

### @orchestr8 MCP Server Configuration

```json
{
  "mcpServers": {
    "orchestr8": {
      "command": "node",
      "args": ["./packages/mcp-server/dist/index.js"],
      "env": {
        "ORCHESTR8_API_KEY": "${ORCHESTR8_API_KEY}",
        "ORCHESTR8_BASE_URL": "http://localhost:8088"
      }
    },
    "orchestr8_workflows": {
      "command": "npx",
      "args": ["-y", "@orchestr8/mcp-workflows"],
      "env": {
        "WORKFLOW_PATH": "./workflows"
      }
    }
  }
}
```

## Tool Definition Schema

### Standard Tool Structure

```typescript
interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}
```

### @orchestr8 Tool Definitions

```typescript
const orchestr8Tools: MCPTool[] = [
  {
    name: 'run_workflow',
    description: 'Execute an @orchestr8 workflow',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'ID of the workflow to execute',
        },
        inputs: {
          type: 'object',
          description: 'Input parameters for the workflow',
        },
        options: {
          type: 'object',
          properties: {
            timeoutMs: { type: 'integer' },
            concurrency: { type: 'integer' },
            resilience: { type: 'object' },
          },
        },
        correlationId: {
          type: 'string',
          description: 'Correlation ID for tracking',
        },
      },
      required: ['workflowId', 'inputs'],
    },
  },
  {
    name: 'get_status',
    description: 'Get workflow execution status',
    inputSchema: {
      type: 'object',
      properties: {
        executionId: {
          type: 'string',
          description: 'Execution ID to check',
        },
        correlationId: {
          type: 'string',
          description: 'Correlation ID for tracking',
        },
      },
      required: ['executionId'],
    },
  },
  {
    name: 'cancel_workflow',
    description: 'Cancel a running workflow',
    inputSchema: {
      type: 'object',
      properties: {
        executionId: {
          type: 'string',
          description: 'Execution ID to cancel',
        },
        reason: {
          type: 'string',
          description: 'Cancellation reason',
        },
      },
      required: ['executionId'],
    },
  },
]
```

## MCP Server Implementation

### TypeScript MCP Server

```typescript
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

const server = new McpServer({
  name: '@orchestr8 MCP Server',
  version: '1.0.0',
})

// Define tools
server.tool(
  'run_workflow',
  'Execute an @orchestr8 workflow',
  {
    workflowId: z.string().describe('Workflow ID'),
    inputs: z.record(z.any()).describe('Workflow inputs'),
    correlationId: z.string().optional(),
  },
  async ({ workflowId, inputs, correlationId }) => {
    // Execute workflow
    const execution = await orchestr8.startExecution(workflowId, inputs, {
      correlationId,
    })

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'running',
            executionId: execution.id,
            workflowId: workflowId,
            correlationId: correlationId || `o8-${crypto.randomUUID()}`,
          }),
        },
      ],
    }
  },
)

// Define resources
server.resource(
  'workflow',
  'Access workflow definitions',
  async (uri: string) => {
    const workflowId = uri.replace('workflow://', '')
    const workflow = await orchestr8.getWorkflow(workflowId)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(workflow, null, 2),
        },
      ],
    }
  },
)

// Define prompts (slash commands)
server.prompt(
  'create_workflow',
  'Create a new workflow from template',
  [
    { name: 'type', description: 'Workflow type', required: true },
    { name: 'name', description: 'Workflow name', required: true },
  ],
  async ({ type, name }) => {
    const template = await getTemplate(type)
    const workflow = await createWorkflow(name, template)

    return {
      messages: [
        {
          role: 'assistant',
          content: `Created workflow '${name}' with ID: ${workflow.id}`,
        },
      ],
    }
  },
)
```

### Python MCP Server

```python
from mcp import McpServer
import json
import asyncio

server = McpServer(
    name="@orchestr8 MCP Server",
    version="1.0.0"
)

@server.tool(
    "run_workflow",
    "Execute an @orchestr8 workflow",
    parameters={
        "workflowId": {"type": "string"},
        "inputs": {"type": "object"},
        "correlationId": {"type": "string", "required": False}
    }
)
async def run_workflow(workflowId: str, inputs: dict, correlationId: str = None):
    """Execute a workflow and return status"""
    execution = await orchestr8.start_execution(
        workflowId,
        inputs,
        correlation_id=correlationId
    )

    return {
        "content": [{
            "type": "text",
            "text": json.dumps({
                "status": "running",
                "executionId": execution.id,
                "workflowId": workflowId,
                "correlationId": correlationId or f"o8-{uuid.uuid4()}"
            })
        }]
    }

@server.resource("workflow")
async def get_workflow(uri: str):
    """Access workflow definition"""
    workflow_id = uri.replace("workflow://", "")
    workflow = await orchestr8.get_workflow(workflow_id)

    return {
        "content": [{
            "type": "text",
            "text": json.dumps(workflow, indent=2)
        }]
    }
```

## Using MCP Tools in Claude Code

### Command Line Usage

```bash
# Configure MCP servers
claude --mcp-config orchestr8-mcp.json

# Use with allowed tools
claude -p "Execute the data pipeline workflow" \
  --allowedTools "mcp__orchestr8" \
  --append-system-prompt "Use orchestr8 tools to execute workflows"

# Multiple MCP servers
claude -p "Deploy and monitor the service" \
  --mcp-config multi-server.json \
  --allowedTools "mcp__orchestr8,mcp__kubernetes,mcp__datadog"
```

### SDK Usage

```typescript
import { query } from '@anthropic-ai/claude-code'

// TypeScript SDK with MCP
for await (const message of query({
  prompt: 'Run the data processing workflow',
  options: {
    mcpConfig: 'orchestr8-mcp.json',
    allowedTools: ['mcp__orchestr8'],
    systemPrompt: 'You are an orchestration specialist',
  },
})) {
  if (message.type === 'tool_use' && message.name.startsWith('mcp__')) {
    console.log(`MCP Tool: ${message.name}`)
  }
}
```

```python
from claude_code_sdk import ClaudeSDKClient, ClaudeCodeOptions

# Python SDK with MCP
async with ClaudeSDKClient(
    options=ClaudeCodeOptions(
        mcp_servers={
            "orchestr8": {
                "command": "node",
                "args": ["./mcp-server/index.js"],
                "env": {"API_KEY": api_key}
            }
        },
        allowed_tools=["mcp__orchestr8"],
        system_prompt="You are an orchestration specialist"
    )
) as client:
    await client.query("Run the data processing workflow")
```

## MCP Prompts (Slash Commands)

### Defining Prompts

Prompts appear as slash commands and can accept arguments:

```typescript
// Server-side prompt definition
server.prompt(
  'analyze_workflow',
  'Analyze workflow for issues and optimizations',
  [
    { name: 'workflow_id', description: 'Workflow to analyze', required: true },
    { name: 'focus', description: 'Analysis focus area', required: false },
  ],
  async ({ workflow_id, focus }) => {
    const analysis = await analyzeWorkflow(workflow_id, focus)

    return {
      messages: [
        {
          role: 'assistant',
          content: formatAnalysis(analysis),
        },
      ],
    }
  },
)
```

### Using Prompts in Claude Code

```bash
# Without arguments
> /mcp__io.orchestr8__list_workflows

# With required argument
> /mcp__io.orchestr8__analyze_workflow data-pipeline

# With multiple arguments
> /mcp__io.orchestr8__analyze_workflow data-pipeline performance
```

## MCP Resources

### Defining Resources

Resources are exposed through URI patterns:

```typescript
// Workflow resource
server.resource(
  'workflow',
  'Access workflow definitions',
  async (uri: string) => {
    // URI format: workflow://workflow-id
    const id = uri.replace('workflow://', '')
    return await getWorkflowContent(id)
  },
)

// Execution resource
server.resource(
  'execution',
  'Access execution details',
  async (uri: string) => {
    // URI format: execution://execution-id
    const id = uri.replace('execution://', '')
    return await getExecutionDetails(id)
  },
)
```

### Referencing Resources

```bash
# Reference a workflow
> Analyze @orchestr8:workflow://data-pipeline

# Reference an execution
> What went wrong with @orchestr8:execution://exec_abc123

# Multiple resources
> Compare @orchestr8:workflow://v1 with @orchestr8:workflow://v2
```

## Permission and Security

### Permission Prompt Tool

```typescript
server.tool(
  'approval_prompt',
  'Request permission for sensitive operations',
  {
    tool_name: z.string(),
    input: z.object({}).passthrough(),
    tool_use_id: z.string().optional(),
  },
  async ({ tool_name, input, tool_use_id }) => {
    // Check if operation requires approval
    if (requiresApproval(tool_name, input)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              behavior: 'deny',
              message: 'Permission required for this operation',
            }),
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            behavior: 'allow',
            updatedInput: input,
          }),
        },
      ],
    }
  },
)
```

### Using Permission Prompts

```typescript
// Configure permission prompt
const options = {
  permissionPromptTool: 'mcp__io.orchestr8__approval_prompt',
  allowedTools: ['mcp__orchestr8'],
  disallowedTools: ['Bash(rm*)', 'Write'],
}
```

## Managing MCP Connections

### CLI Commands

```bash
# List all configured servers
claude mcp list

# Get details for a specific server
claude mcp get orchestr8

# View available tools and prompts
claude mcp tools orchestr8

# Check connection status
claude mcp status orchestr8
```

### Programmatic Management

```typescript
import { MCPManager } from '@orchestr8/mcp'

const manager = new MCPManager()

// List servers
const servers = await manager.listServers()

// Connect to server
await manager.connect('orchestr8', {
  command: 'node',
  args: ['./mcp-server/index.js'],
})

// Get available tools
const tools = await manager.getTools('orchestr8')

// Execute tool
const result = await manager.executeTool('orchestr8', 'run_workflow', {
  workflowId: 'test',
  inputs: {},
})
```

## Structured Logging Integration

### Logger Configuration

MCP servers use @orchestr8/logger for consistent, structured logging across all operations:

```typescript
import { createLogger } from '@orchestr8/logger'

const logger = await createLogger({
  name: 'mcp-server',
  level: process.env.LOG_LEVEL || 'info',
  pretty: process.env.LOG_PRETTY === 'true',
  redactKeys: ['authorization', 'apiKey', 'token', 'password'],
  maxFieldSize: 10000,
})
```

### MCP Event Taxonomy

Consistent event naming for MCP operations:

```typescript
// Tool execution events
logger.info('mcp.tool.start', { tool, correlationId, input })
logger.info('mcp.tool.success', { tool, correlationId, durationMs })
logger.error('mcp.tool.error', { tool, code, retryable })

// Resource events
logger.debug('mcp.resource.fetch', { uri, cached })
logger.warn('mcp.resource.truncated', { uri, originalSize, retainedSize })

// Notification events
logger.info('mcp.notification.sent', { method, executionId, progress })

// Connection events
logger.info('mcp.connection.established', { transport, client })
logger.warn('mcp.connection.lost', { reason, willRetry })
```

### Correlation ID Propagation

```typescript
import { CorrelationContext } from '@orchestr8/logger'

server.tool('run_workflow', ..., async (params) => {
  const correlationId = params.correlationId || generateCorrelationId()

  return CorrelationContext.run(correlationId, async () => {
    const childLogger = logger.child({ correlationId, tool: 'run_workflow' })
    childLogger.info('mcp.tool.start', { workflowId: params.workflowId })

    // Correlation ID automatically propagated
    const result = await orchestr8.execute(params)

    childLogger.info('mcp.tool.success', { executionId: result.id })
    return result
  })
})
```

## Output Schemas and Structured Results

### Dual Response Format

Every MCP tool MUST return both structured content and text fallback:

```typescript
interface MCPToolResponse {
  structuredContent: NormalizedEnvelope // For smart clients
  content: [
    {
      // Text fallback for compatibility
      type: 'text'
      text: string // JSON stringified envelope
    },
  ]
}
```

### Tool Output Schema Definition

```typescript
const runWorkflowTool = {
  name: 'run_workflow',
  description: 'Execute an @orchestr8 workflow',
  inputSchema: {
    /* ... */
  },
  outputSchema: {
    $ref: '#/definitions/NormalizedEnvelope',
    definitions: {
      NormalizedEnvelope: {
        type: 'object',
        required: ['status', 'correlationId'],
        properties: {
          status: { enum: ['running', 'ok', 'error'] },
          executionId: { type: 'string' },
          workflowId: { type: 'string' },
          data: { type: 'object' },
          error: {
            /* ... */
          },
          correlationId: { type: 'string' },
          meta: {
            /* ... */
          },
        },
      },
    },
  },
}
```

### Implementation Example

```typescript
server.tool(
  'run_workflow',
  'Execute an @orchestr8 workflow',
  runWorkflowInputSchema,
  runWorkflowOutputSchema, // Add output schema
  async (params) => {
    const envelope: NormalizedEnvelope = {
      status: 'running',
      executionId: execution.id,
      workflowId: params.workflowId,
      correlationId: params.correlationId || generateCorrelationId(),
      meta: {
        startedAt: new Date().toISOString(),
      },
    }

    return {
      structuredContent: envelope,
      content: [
        {
          type: 'text',
          text: JSON.stringify(envelope, null, 2),
        },
      ],
    }
  },
)
```

## Progress and Streaming Semantics

### Progress Notification Pattern

```typescript
interface ProgressNotification {
  method: 'notifications/message'
  params: {
    level: 'info' | 'warn' | 'error'
    correlationId: string
    message: {
      phase: string // e.g., "step-2-of-5"
      progress: number // 0-100 percentage
      eta?: string // ISO timestamp
      currentStep?: string // Human-readable current action
      totalSteps?: number
      completedSteps?: number
    }
  }
}
```

### Emitting Progress Updates

```typescript
class ExecutionMonitor {
  constructor(
    private server: MCPServer,
    private logger: Logger,
    private execution: Execution,
  ) {}

  async emitProgress(): Promise<void> {
    const progress = this.execution.getProgress()

    this.logger.info('mcp.notification.sent', {
      method: 'notifications/message',
      executionId: this.execution.id,
      progress: progress.percentage,
    })

    await this.server.notify('notifications/message', {
      level: 'info',
      correlationId: this.execution.correlationId,
      message: {
        phase: `step-${progress.currentStep}-of-${progress.totalSteps}`,
        progress: progress.percentage,
        eta: progress.estimatedCompletion,
        currentStep: progress.currentStepName,
      },
    })
  }
}
```

### Subscription Pattern for Updates

```typescript
// Client subscribes to execution updates
server.resource(
  'execution',
  'Subscribe to execution updates',
  async (uri: string) => {
    const executionId = uri.replace('execution://', '')

    // Register subscription
    subscriptions.add(executionId, async (update) => {
      await server.notify('notifications/resources/updated', {
        uri: `execution://${executionId}`,
        data: update,
      })
    })

    return getExecutionResource(executionId)
  },
)
```

## Resilience Configuration

### Environment Variables

Configure resilience patterns through environment:

```bash
# Retry configuration
ORCHESTR8_MAX_RETRIES=3              # Maximum retry attempts
ORCHESTR8_INITIAL_DELAY_MS=1000      # Initial retry delay
ORCHESTR8_MAX_DELAY_MS=30000         # Maximum retry delay
ORCHESTR8_BACKOFF_FACTOR=2           # Exponential backoff multiplier

# Circuit breaker
ORCHESTR8_CIRCUIT_THRESHOLD=5        # Failures before opening
ORCHESTR8_CIRCUIT_TIMEOUT_MS=60000   # Time before half-open

# Timeouts
ORCHESTR8_DEFAULT_TIMEOUT_MS=30000   # Default operation timeout
ORCHESTR8_MAX_TIMEOUT_MS=300000      # Maximum allowed timeout

# Rate limiting
ORCHESTR8_RATE_LIMIT=100             # Requests per window
ORCHESTR8_RATE_WINDOW_MS=60000       # Rate limit window
```

### Integration with @orchestr8/resilience

```typescript
import { createResilience } from '@orchestr8/resilience'

const resilience = createResilience({
  maxRetries: parseInt(process.env.ORCHESTR8_MAX_RETRIES || '3'),
  initialDelayMs: parseInt(process.env.ORCHESTR8_INITIAL_DELAY_MS || '1000'),
  maxDelayMs: parseInt(process.env.ORCHESTR8_MAX_DELAY_MS || '30000'),
  backoffFactor: parseFloat(process.env.ORCHESTR8_BACKOFF_FACTOR || '2')
})

// Apply to tool execution
server.tool('run_workflow', ..., async (params) => {
  return resilience.execute(async () => {
    return await orchestr8.runWorkflow(params)
  })
})
```

## Resource Templates and Subscriptions

### Resource Template Definition

```typescript
server.resourceTemplate(
  'execution',
  'Execution status and results',
  {
    uriPattern: 'execution://{executionId}',
    parameters: {
      executionId: {
        type: 'string',
        pattern: '^[a-zA-Z0-9-_]+$',
        description: 'Unique execution identifier',
      },
    },
  },
  async (params) => {
    const execution = await getExecution(params.executionId)
    return formatExecutionResource(execution)
  },
)
```

### Subscription Management

```typescript
// Handle resource subscriptions
server.on('resources/subscribe', async (params) => {
  const { uri } = params

  logger.info('mcp.resource.subscribe', { uri })

  // Parse resource type and ID
  const [type, id] = parseResourceUri(uri)

  // Register subscription
  const subscription = await subscriptionManager.subscribe(type, id, {
    onUpdate: async (data) => {
      await server.notify('notifications/resources/updated', {
        uri,
        data,
      })
    },
    onComplete: async () => {
      await server.notify('notifications/resources/updated', {
        uri,
        complete: true,
      })
    },
  })

  return { subscriptionId: subscription.id }
})

// Handle unsubscribe
server.on('resources/unsubscribe', async (params) => {
  await subscriptionManager.unsubscribe(params.subscriptionId)
  logger.info('mcp.resource.unsubscribe', {
    subscriptionId: params.subscriptionId,
  })
})
```

## Client Configuration Matrix

### Claude Desktop (claude_desktop_config.json)

```json
{
  "mcpServers": {
    "orchestr8": {
      "command": "node",
      "args": ["/path/to/@orchestr8/mcp-server/dist/index.js"],
      "env": {
        "ORCHESTR8_API_KEY": "${ORCHESTR8_API_KEY}",
        "ORCHESTR8_BASE_URL": "http://localhost:8088",
        "LOG_LEVEL": "info",
        "LOG_PRETTY": "false"
      }
    }
  }
}
```

### Cursor Configuration

#### Cursor v0.42+ (.cursorrules)

```json
{
  "mcpServers": {
    "orchestr8": {
      "command": "npx",
      "args": ["-y", "@orchestr8/mcp-server"],
      "env": {
        "ORCHESTR8_API_KEY": "${ORCHESTR8_API_KEY}",
        "LOG_LEVEL": "info"
      },
      "capabilities": {
        "tools": true,
        "resources": true,
        "notifications": true
      }
    }
  }
}
```

#### Cursor Legacy (settings.json)

```json
{
  "mcp.servers": [
    {
      "name": "orchestr8",
      "command": "node",
      "args": ["./node_modules/@orchestr8/mcp-server/dist/index.js"],
      "env": {
        "ORCHESTR8_API_KEY": "${env:ORCHESTR8_API_KEY}"
      }
    }
  ]
}
```

### VS Code (.vscode/mcp.json)

```json
{
  "servers": {
    "orchestr8": {
      "command": "node",
      "args": [
        "${workspaceFolder}/node_modules/@orchestr8/mcp-server/dist/index.js"
      ],
      "env": {
        "ORCHESTR8_API_KEY": "${env:ORCHESTR8_API_KEY}",
        "ORCHESTR8_BASE_URL": "http://localhost:8088",
        "LOG_LEVEL": "debug",
        "LOG_PRETTY": "true"
      },
      "rootPath": "${workspaceFolder}",
      "capabilities": {
        "tools": ["run_workflow", "get_status", "cancel_workflow"],
        "resources": ["workflow", "execution"],
        "notifications": ["progress", "completion"]
      }
    }
  }
}
```

### Windsurf (model_config.json)

```json
{
  "models": [
    {
      "model": "claude-3-5-sonnet",
      "contextLength": 200000,
      "mcpServers": {
        "orchestr8": {
          "command": "npx",
          "args": ["-y", "@orchestr8/mcp-server"],
          "env": {
            "ORCHESTR8_API_KEY": "${ORCHESTR8_API_KEY}",
            "ORCHESTR8_BASE_URL": "http://localhost:8088"
          },
          "autoStart": true,
          "requiredTools": ["run_workflow"],
          "optionalTools": ["get_status", "cancel_workflow"]
        }
      }
    }
  ]
}
```

### Installation Instructions

1. **Install MCP Server**:

   ```bash
   npm install -g @orchestr8/mcp-server
   # or
   pnpm add -g @orchestr8/mcp-server
   ```

2. **Set Environment Variables**:

   ```bash
   export ORCHESTR8_API_KEY="your-api-key"
   export ORCHESTR8_BASE_URL="http://localhost:8088"
   ```

3. **Configure Your Client**:
   - Copy the appropriate configuration above
   - Update paths and API keys
   - Restart your client application

4. **Verify Connection**:

```bash
 # Test the MCP server directly
 npx @orchestr8/mcp-server --test
```

## Security Hardening

### Secret Redaction

```typescript
import { DEFAULT_REDACT_KEYS } from '@orchestr8/logger'

const ADDITIONAL_REDACT_KEYS = [
  'orchestr8ApiKey',
  'workflowSecret',
  'executionToken',
]

const logger = await createLogger({
  redactKeys: [...DEFAULT_REDACT_KEYS, ...ADDITIONAL_REDACT_KEYS],
})
```

### Output Sanitization

```typescript
import { truncateValue, deepRedact } from '@orchestr8/logger'

function sanitizeToolOutput(output: unknown): unknown {
  // Truncate large values
  const { value: truncated } = truncateValue(output, 50000)

  // Redact sensitive data
  const sanitized = deepRedact(
    truncated,
    new Set(['password', 'token', 'secret']),
  )

  return sanitized
}
```

### Resource Size Limits

```typescript
const MAX_RESOURCE_SIZE = parseInt(process.env.MAX_RESOURCE_SIZE || '1048576') // 1MB

server.resource('workflow', ..., async (uri) => {
  const content = await getWorkflowContent(uri)

  if (JSON.stringify(content).length > MAX_RESOURCE_SIZE) {
    logger.warn('mcp.resource.truncated', {
      uri,
      originalSize: JSON.stringify(content).length,
      maxSize: MAX_RESOURCE_SIZE
    })

    return {
      content: [{
        type: 'text',
        text: 'Resource too large. Use pagination or filtering.'
      }],
      metadata: {
        truncated: true,
        originalSize: JSON.stringify(content).length
      }
    }
  }

  return content
})
```

### Per-Tool Authorization

```typescript
interface ToolAuthorization {
  tool: string
  requiredScopes: string[]
  rateLimit?: number
  allowedUsers?: string[]
}

const toolAuth: Map<string, ToolAuthorization> = new Map([
  [
    'run_workflow',
    {
      tool: 'run_workflow',
      requiredScopes: ['workflow:execute'],
      rateLimit: 100,
    },
  ],
  [
    'cancel_workflow',
    {
      tool: 'cancel_workflow',
      requiredScopes: ['workflow:admin'],
      rateLimit: 50,
    },
  ],
])

server.use(async (context, next) => {
  const { tool, user } = context
  const auth = toolAuth.get(tool)

  if (auth) {
    // Check scopes
    if (!hasRequiredScopes(user, auth.requiredScopes)) {
      throw new Error(`Insufficient permissions for tool: ${tool}`)
    }

    // Check rate limit
    if (!checkRateLimit(user, tool, auth.rateLimit)) {
      throw new Error(`Rate limit exceeded for tool: ${tool}`)
    }
  }

  return next()
})
```

## Best Practices

### 1. Use Descriptive Tool Names

```typescript
✅ GOOD: Clear, action-oriented names
"run_workflow"
"get_execution_status"
"cancel_workflow"

❌ BAD: Vague or abbreviated names
"run"
"status"
"cancel"
```

### 2. Provide Comprehensive Descriptions

```typescript
✅ GOOD: Detailed description with context
{
  name: "run_workflow",
  description: "Execute an @orchestr8 workflow with specified inputs and options"
}

❌ BAD: Minimal description
{
  name: "run_workflow",
  description: "Run workflow"
}
```

### 3. Use Structured Input Schemas

```typescript
✅ GOOD: Well-defined schema with validation
inputSchema: {
  type: "object",
  properties: {
    workflowId: {
      type: "string",
      pattern: "^[a-z0-9-]+$",
      description: "Workflow identifier"
    }
  },
  required: ["workflowId"]
}

❌ BAD: Loose schema
inputSchema: {
  type: "object",
  additionalProperties: true
}
```

### 4. Handle Errors Gracefully

```typescript
✅ GOOD: Structured error response
try {
  const result = await executeWorkflow(params)
  return { content: [{ type: "text", text: JSON.stringify(result) }] }
} catch (error) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        error: {
          code: error.code || "UNKNOWN",
          message: error.message,
          retryable: isRetryableError(error)
        }
      })
    }]
  }
}

❌ BAD: Raw error throw
const result = await executeWorkflow(params) // Throws on error
return { content: [{ type: "text", text: JSON.stringify(result) }] }
```

## Common Patterns

### Long-Polling for Status

```typescript
server.tool(
  'get_status',
  'Get workflow status with optional long-polling',
  {
    executionId: z.string(),
    waitForMs: z.number().optional().default(0),
  },
  async ({ executionId, waitForMs }) => {
    const startTime = Date.now()

    while (Date.now() - startTime < waitForMs) {
      const status = await getExecutionStatus(executionId)

      if (status.state !== 'running') {
        return formatStatusResponse(status)
      }

      await sleep(1000) // Poll every second
    }

    // Return current status after timeout
    const status = await getExecutionStatus(executionId)
    return formatStatusResponse(status)
  },
)
```

### Resource Caching

```typescript
const resourceCache = new Map()

server.resource(
  'workflow',
  'Access workflow with caching',
  async (uri: string) => {
    const cacheKey = uri

    // Check cache
    if (resourceCache.has(cacheKey)) {
      const cached = resourceCache.get(cacheKey)
      if (Date.now() - cached.timestamp < 60000) {
        // 1 minute cache
        return cached.content
      }
    }

    // Fetch and cache
    const content = await fetchWorkflow(uri)
    resourceCache.set(cacheKey, {
      content,
      timestamp: Date.now(),
    })

    return content
  },
)
```

## Performance Optimization

### Caching Strategy

```typescript
import { LRUCache } from 'lru-cache'

const resourceCache = new LRUCache<string, any>({
  max: 100,
  ttl: 1000 * 60 * 5, // 5 minutes
  updateAgeOnGet: true
})

server.resource('workflow', ..., async (uri) => {
  // Check cache first
  const cached = resourceCache.get(uri)
  if (cached) {
    logger.debug('mcp.resource.fetch', { uri, cached: true })
    return cached
  }

  // Fetch and cache
  const content = await fetchWorkflow(uri)
  resourceCache.set(uri, content)

  logger.debug('mcp.resource.fetch', { uri, cached: false })
  return content
})
```

### Batch Operations

```typescript
server.tool('batch_run_workflows', ..., async (params) => {
  const { workflows } = params

  // Execute in parallel with concurrency limit
  const results = await pLimit(5)(workflows.map(w =>
    () => orchestr8.runWorkflow(w)
  ))

  return formatBatchResults(results)
})
```

## Error Recovery Patterns

### Graceful Degradation

```typescript
server.tool('run_workflow', ..., async (params) => {
  try {
    return await orchestr8.runWorkflow(params)
  } catch (error) {
    logger.error('mcp.tool.error', {
      tool: 'run_workflow',
      error: error.message,
      fallback: true
    })

    // Try fallback execution
    if (params.allowFallback) {
      return await orchestr8.runWorkflowSimple(params)
    }

    throw error
  }
})
```

### Circuit Breaker Integration

```typescript
import { CircuitBreaker } from '@orchestr8/resilience'

const breaker = new CircuitBreaker({
  threshold: 5,
  timeout: 60000,
  onOpen: () => logger.warn('mcp.circuit.open', { service: 'orchestr8' }),
  onHalfOpen: () => logger.info('mcp.circuit.halfopen', { service: 'orchestr8' })
})

server.tool('run_workflow', ..., async (params) => {
  return breaker.execute(async () => {
    return await orchestr8.runWorkflow(params)
  })
})
```

## Conclusion

MCP tools provide a powerful, standardized way for Claude to interact with @orchestr8:

- **Structured Logging** via @orchestr8/logger for consistent observability
- **Dual Output Format** with structured content and text fallback
- **Progress Notifications** for long-running operations
- **Resource Templates** for dynamic content access
- **Client Configurations** for all major AI coding assistants
- **Resilience Patterns** with configurable retry and circuit breaking
- **Security Hardening** with redaction, sanitization, and authorization

This enhanced approach enables seamless, observable, and resilient integration between Claude's AI capabilities and @orchestr8's workflow orchestration engine.
