/*
  Quick-start example for @orchestr8/core
  - Registers two simple agents
  - Executes a workflow with dependency + input mapping
*/

import type {
  Agent,
  AgentRegistry,
  ResilienceAdapter,
  Workflow,
} from '@orchestr8/schema'

import { OrchestrationEngine } from '@orchestr8/core'

class MemoryAgentRegistry implements AgentRegistry {
  private agents = new Map<string, Agent>()

  async getAgent(id: string): Promise<Agent> {
    const a = this.agents.get(id)
    if (!a) throw new Error(`Agent not found: ${id}`)
    return a
  }

  async hasAgent(id: string): Promise<boolean> {
    return this.agents.has(id)
  }

  async registerAgent(agent: Agent): Promise<void> {
    this.agents.set(agent.id, agent)
  }
}

const noResilience: ResilienceAdapter = {
  async applyPolicy(fn) {
    return fn()
  },
}

const registry = new MemoryAgentRegistry()

await registry.registerAgent({
  id: 'greeter',
  name: 'Greeter Agent',
  async execute(input) {
    const name = (input as { name?: string } | undefined)?.name ?? 'world'
    return { message: `Hello, ${name}!` }
  },
})

await registry.registerAgent({
  id: 'length',
  name: 'Length Agent',
  async execute(input) {
    const text = String((input as Record<string, unknown>)?.text ?? '')
    return { length: text.length }
  },
})

const workflow: Workflow = {
  id: 'wf-hello',
  name: 'Hello world',
  version: '1.0.0',
  steps: [
    {
      id: 'say-hello',
      type: 'agent',
      agentId: 'greeter',
      input: { name: "${variables.userName ?? 'Alice'}" },
    },
    {
      id: 'measure',
      type: 'agent',
      agentId: 'length',
      dependsOn: ['say-hello'],
      input: { text: '${steps.say-hello.output.message}' },
    },
  ],
}

const engine = new OrchestrationEngine({
  agentRegistry: registry,
  resilienceAdapter: noResilience,
  maxConcurrency: 5,
})

const result = await engine.execute(workflow, { userName: 'Nora' })

console.log('[quick-start] status:', result.status)
console.log('[quick-start] say-hello:', result.steps['say-hello'])
console.log('[quick-start] measure:', result.steps['measure'])
