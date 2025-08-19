# Subagent Format Specification

This document defines the subagent file format and configuration for orchestr8 Claude integration.

> Created: 2025-01-18
> Version: 1.0.0

## Subagent File Format

Subagents are defined in markdown files with YAML frontmatter that specify configuration and a system prompt.

### File Structure

```yaml
---
name: agent-name # Required: Unique identifier
description: Agent purpose # Required: When to invoke this agent
tools: tool1, tool2, tool3 # Optional: Inherits all if omitted
proactive: true # Optional: Auto-invoke on patterns
---
System prompt content goes here. This defines the agent's role,
capabilities, and approach to solving problems.
```

### Storage Locations

- **User Agents**: `~/.claude/agents/` - Available across all projects
- **Project Agents**: `.claude/agents/` - Project-specific, shareable

## Orchestr8 Subagent Definitions

### Orchestr8 Executor Agent

```yaml
---
name: orchestr8-executor
description: Execute orchestr8 workflows with resilience patterns. Use for workflow execution tasks.
tools: run_workflow, get_status, cancel_workflow
proactive: true
---

You are the orchestr8 workflow executor, specialized in running resilient workflows.

## Core Responsibilities
- Execute workflows via the orchestr8 MCP tools
- Monitor execution status with intelligent polling
- Handle cancellations gracefully
- Return only normalized envelope data

## Available Tools
- `run_workflow`: Start workflow execution with inputs
- `get_status`: Check execution progress (respect waitForMs)
- `cancel_workflow`: Terminate with reason tracking

## Execution Protocol
1. Validate workflow requests against schemas
2. Execute with resilience patterns (retry, timeout, circuit breaker)
3. Poll for completion respecting waitForMs hints
4. Return normalized envelope without commentary

## Error Handling
- Classify errors as retryable/non-retryable
- Include retry metadata in error responses
- Respect circuit breaker states
- Escalate quota/auth errors immediately

## Output Constraints
- Return ONLY the execution envelope
- No additional explanation or commentary
- Preserve correlation IDs throughout
- Include all cost and cache metrics
```

### Orchestr8 Workflow Designer

```yaml
---
name: orchestr8-designer
description: Design and validate orchestr8 workflow definitions. Use for workflow creation.
tools: Read, Write, Edit, run_workflow
proactive: false
---

You are the orchestr8 workflow designer, expert in creating resilient workflow definitions.

## Core Competencies
- Workflow AST design with Zod schemas
- Resilience pattern configuration
- Sequential and parallel execution planning
- Error boundary design

## Workflow Design Process
1. Analyze requirements for workflow structure
2. Define input/output schemas with Zod
3. Configure resilience patterns:
   - Retry with exponential backoff
   - Timeout boundaries
   - Circuit breaker thresholds
4. Structure sequential/parallel execution
5. Validate workflow against schema
6. Test with sample inputs

## Best Practices
- Keep workflows idempotent
- Design for partial failure recovery
- Include comprehensive error handling
- Document state transitions clearly
- Use correlation IDs for traceability

## Output Format
Always provide workflow definitions in valid TypeScript with:
- Complete Zod schemas
- Resilience configuration
- Clear documentation
- Test cases
```

### Orchestr8 Monitor Agent

```yaml
---
name: orchestr8-monitor
description: Monitor and analyze orchestr8 workflow executions. Use for debugging and optimization.
tools: get_status, Grep, Read
proactive: true
---

You are the orchestr8 execution monitor, specialized in analyzing workflow performance.

## Monitoring Responsibilities
- Track execution progress in real-time
- Analyze performance metrics
- Identify bottlenecks and failures
- Provide optimization recommendations

## Analysis Protocol
1. Check execution status regularly
2. Analyze execution journal for patterns
3. Calculate performance metrics:
   - Execution duration
   - Retry counts
   - Cache hit ratios
   - Token usage
4. Identify optimization opportunities
5. Report anomalies immediately

## Metrics Focus
- **Performance**: Execution time, throughput
- **Reliability**: Success rate, retry patterns
- **Cost**: Token usage, cache efficiency
- **Errors**: Failure patterns, timeout analysis

## Reporting Format
Provide concise status updates with:
- Current execution state
- Key performance indicators
- Identified issues
- Recommended actions
```

## Agent Discovery and Management

### Agent Registry Implementation

Complete agent registry with discovery, management, and lifecycle operations:

```typescript
export class AgentRegistry {
  private agents: Map<string, Agent> = new Map()
  private fileWatcher: FSWatcher | null = null
  private locations: AgentLocation[] = [
    { type: 'user', path: '~/.claude/agents/' },
    { type: 'project', path: '.claude/agents/' },
  ]

  async initialize(): Promise<void> {
    // Discover existing agents
    await this.discoverAgents()

    // Set up file watching for dynamic updates
    this.watchForChanges()
  }

  private async discoverAgents(): Promise<void> {
    for (const location of this.locations) {
      const agentFiles = await this.scanDirectory(location.path)

      for (const file of agentFiles) {
        const agent = await this.loadAgent(file, location.type)
        if (agent) {
          this.agents.set(agent.name, agent)
        }
      }
    }
  }

  private async loadAgent(
    filePath: string,
    locationType: 'user' | 'project',
  ): Promise<Agent | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const { frontmatter, body } = this.parseFrontmatter(content)

      return {
        name: frontmatter.name,
        description: frontmatter.description,
        tools: this.parseTools(frontmatter.tools),
        proactive: frontmatter.proactive ?? false,
        triggers: frontmatter.triggers ?? [],
        location: locationType,
        filePath,
        systemPrompt: body.trim(),
        metadata: {
          createdAt: (await fs.stat(filePath)).birthtime,
          modifiedAt: (await fs.stat(filePath)).mtime,
          version: frontmatter.version ?? '1.0.0',
        },
      }
    } catch (error) {
      console.error(`Failed to load agent from ${filePath}:`, error)
      return null
    }
  }

  private parseFrontmatter(content: string): {
    frontmatter: any
    body: string
  } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)

    if (!match) {
      throw new Error('Invalid agent file format')
    }

    return {
      frontmatter: yaml.parse(match[1]),
      body: match[2],
    }
  }

  private parseTools(tools?: string | string[]): string[] {
    if (!tools) return [] // Inherit all tools
    if (typeof tools === 'string') {
      return tools.split(',').map((t) => t.trim())
    }
    return tools
  }

  private watchForChanges(): void {
    this.fileWatcher = chokidar.watch(
      this.locations.map((l) => l.path),
      {
        persistent: true,
        ignoreInitial: true,
      },
    )

    this.fileWatcher
      .on('add', (path) => this.handleFileAdd(path))
      .on('change', (path) => this.handleFileChange(path))
      .on('unlink', (path) => this.handleFileRemove(path))
  }

  private async handleFileAdd(path: string): Promise<void> {
    const locationType = this.getLocationType(path)
    const agent = await this.loadAgent(path, locationType)

    if (agent) {
      this.agents.set(agent.name, agent)
      this.emit('agent:added', agent)
    }
  }

  private async handleFileChange(path: string): Promise<void> {
    const existingAgent = Array.from(this.agents.values()).find(
      (a) => a.filePath === path,
    )

    if (existingAgent) {
      const locationType = this.getLocationType(path)
      const updatedAgent = await this.loadAgent(path, locationType)

      if (updatedAgent) {
        this.agents.set(updatedAgent.name, updatedAgent)
        this.emit('agent:updated', updatedAgent)
      }
    }
  }

  private handleFileRemove(path: string): void {
    const agent = Array.from(this.agents.values()).find(
      (a) => a.filePath === path,
    )

    if (agent) {
      this.agents.delete(agent.name)
      this.emit('agent:removed', agent)
    }
  }

  // Public API

  listAgents(filter?: AgentFilter): Agent[] {
    let agents = Array.from(this.agents.values())

    if (filter) {
      if (filter.location) {
        agents = agents.filter((a) => a.location === filter.location)
      }
      if (filter.proactive !== undefined) {
        agents = agents.filter((a) => a.proactive === filter.proactive)
      }
      if (filter.tools) {
        agents = agents.filter((a) =>
          filter.tools!.every((tool) => a.tools.includes(tool)),
        )
      }
    }

    return agents
  }

  getAgent(name: string): Agent | undefined {
    return this.agents.get(name)
  }

  async createAgent(config: AgentConfig): Promise<Agent> {
    // Validate config
    this.validateAgentConfig(config)

    // Determine file path
    const fileName = `${config.name}.md`
    const directory =
      config.location === 'user'
        ? this.locations[0].path
        : this.locations[1].path
    const filePath = path.join(directory, fileName)

    // Check if already exists
    if (await this.fileExists(filePath)) {
      throw new Error(`Agent ${config.name} already exists`)
    }

    // Create agent file
    const content = this.generateAgentFile(config)
    await fs.writeFile(filePath, content, 'utf-8')

    // Load and return
    const agent = await this.loadAgent(filePath, config.location)
    if (agent) {
      this.agents.set(agent.name, agent)
      return agent
    }

    throw new Error('Failed to create agent')
  }

  async updateAgent(
    name: string,
    updates: Partial<AgentConfig>,
  ): Promise<Agent> {
    const existing = this.agents.get(name)

    if (!existing) {
      throw new Error(`Agent ${name} not found`)
    }

    // Merge config
    const updated = { ...existing, ...updates }

    // Update file
    const content = this.generateAgentFile(updated)
    await fs.writeFile(existing.filePath, content, 'utf-8')

    // Reload
    const agent = await this.loadAgent(existing.filePath, existing.location)

    if (agent) {
      this.agents.set(agent.name, agent)
      return agent
    }

    throw new Error('Failed to update agent')
  }

  async deleteAgent(name: string): Promise<void> {
    const agent = this.agents.get(name)

    if (!agent) {
      throw new Error(`Agent ${name} not found`)
    }

    // Remove file
    await fs.unlink(agent.filePath)

    // Remove from registry
    this.agents.delete(name)
    this.emit('agent:removed', agent)
  }

  private generateAgentFile(config: AgentConfig): string {
    const frontmatter = yaml.stringify({
      name: config.name,
      description: config.description,
      tools: config.tools?.join(', '),
      proactive: config.proactive,
      triggers: config.triggers,
      version: config.version ?? '1.0.0',
    })

    return `---\n${frontmatter}---\n\n${config.systemPrompt}`
  }

  private validateAgentConfig(config: AgentConfig): void {
    if (!config.name || !/^[a-z0-9-]+$/.test(config.name)) {
      throw new Error('Invalid agent name')
    }

    if (!config.description) {
      throw new Error('Description is required')
    }

    if (!config.systemPrompt) {
      throw new Error('System prompt is required')
    }
  }

  // Event emitter functionality
  private listeners: Map<string, Set<Function>> = new Map()

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback)
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach((cb) => cb(data))
    }
  }

  dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close()
    }
    this.agents.clear()
    this.listeners.clear()
  }
}

// Type definitions
interface Agent {
  name: string
  description: string
  tools: string[]
  proactive: boolean
  triggers?: Trigger[]
  location: 'user' | 'project'
  filePath: string
  systemPrompt: string
  metadata: {
    createdAt: Date
    modifiedAt: Date
    version: string
  }
}

interface AgentConfig {
  name: string
  description: string
  tools?: string[]
  proactive?: boolean
  triggers?: Trigger[]
  location: 'user' | 'project'
  systemPrompt: string
  version?: string
}

interface AgentFilter {
  location?: 'user' | 'project'
  proactive?: boolean
  tools?: string[]
}

interface Trigger {
  pattern: string
  type: 'file_modified' | 'commit_created' | 'pr_opened' | 'custom'
}
```

### Tool Permissions

Define granular tool access per agent:

```yaml
# Full MCP access
tools: mcp__*

# Specific MCP tools only (host-composed labels: serverId + tool)
tools: mcp__io.orchestr8__run_workflow, mcp__io.orchestr8__get_status

# Mix of MCP and built-in tools
tools: Read, Write, mcp__io.orchestr8__*

# Inherit all available tools (default)
tools: # omit for all tools
```

### Proactive Invocation Triggers

Agents marked with `proactive: true` can be automatically invoked:

```yaml
---
name: test-runner
description: Automatically run tests when code changes
tools: Bash, Read
proactive: true
triggers:
  - pattern: 'file_modified:*.test.ts'
  - pattern: 'commit_created'
  - pattern: 'pr_opened'
---
```

## Agent Coordination Patterns

### Sequential Handoff

```yaml
# Agent A completes and hands off to Agent B
- agent: orchestr8-designer
  output: workflow_definition
- agent: orchestr8-executor
  input: $workflow_definition
```

### Parallel Execution

```yaml
# Multiple agents work simultaneously
parallel:
  - agent: orchestr8-executor
    task: run_workflow_1
  - agent: orchestr8-monitor
    task: monitor_system
```

### Conditional Routing

```yaml
# Route based on conditions
if: error_detected
then: orchestr8-monitor
else: orchestr8-executor
```

## Best Practices

### Agent Design Principles

1. **Single Responsibility**: Each agent should have one clear purpose
2. **Minimal Tools**: Only grant necessary tool permissions
3. **Clear Triggers**: Define when proactive agents should activate
4. **Structured Output**: Use JSON for agent coordination
5. **Error Handling**: Include failure recovery in prompts

### Naming Conventions

- Use kebab-case for agent names
- Prefix with domain (e.g., `orchestr8-*`)
- Descriptive but concise names
- Avoid generic names like "helper"

### System Prompt Guidelines

- Start with role definition
- List core competencies
- Define clear protocols
- Specify output constraints
- Include error handling

### Tool Permission Strategy

- Start with minimal permissions
- Add tools as needed
- Audit regularly
- Document tool usage in prompt

## Examples

### Creating a New Orchestr8 Agent

```bash
# Create agent file
cat > .claude/agents/orchestr8-validator.md << 'EOF'
---
name: orchestr8-validator
description: Validate workflow definitions against schemas
tools: Read, run_workflow
---

You are the orchestr8 workflow validator...
EOF

# Test the agent
> Use the orchestr8-validator agent to check my workflow
```

### Agent Chain Example

```bash
# Design, validate, and execute workflow
> Use orchestr8-designer to create a data processing workflow,
  then orchestr8-validator to verify it,
  finally orchestr8-executor to run it
```

## References

- Claude Code Subagents: @docs.anthropic.com/claude-code/sub-agents
- MCP Tools: @.agent-os/specs/2025-01-18-mcp-integration/sub-specs/mcp-tools-spec.md
- Orchestr8 Core: @orchestr8/core
