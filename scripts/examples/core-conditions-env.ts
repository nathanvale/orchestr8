/*
  Conditions + Env allowlist example for @orchestr8/core
  - Demonstrates if/unless conditions (JMESPath)
  - Demonstrates env access via workflow.allowedEnvVars
*/

import type {
  Agent,
  AgentRegistry,
  Workflow,
  ResilienceAdapter,
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

// No-op adapter: conditions are evaluated before agent execution
const adapter: ResilienceAdapter = {
  async applyPolicy<T>(op: (s?: AbortSignal) => Promise<T>) {
    return op()
  },
}

const registry = new MemoryAgentRegistry()

await registry.registerAgent({
  id: 'echo',
  name: 'Echo',
  async execute(input) {
    return { echo: input }
  },
})

await registry.registerAgent({
  id: 'env-reader',
  name: 'Env Reader',
  async execute() {
    return { region: process.env.MY_REGION ?? 'unset' }
  },
})

process.env.MY_REGION = 'eu-west-1'

const workflow: Workflow = {
  id: 'wf-conditions-env',
  name: 'Conditions + Env',
  version: '1.0.0',
  allowedEnvVars: ['MY_REGION'],
  steps: [
    {
      id: 'maybe-run',
      type: 'agent',
      agentId: 'echo',
      input: { flag: '${variables.flag ?? "off"}' },
      if: "variables.flag == 'on'",
    },
    {
      id: 'read-env',
      type: 'agent',
      agentId: 'env-reader',
      dependsOn: ['maybe-run'],
      unless: "steps.maybe-run.status == 'failed'",
    },
  ],
}

const engine = new OrchestrationEngine({
  agentRegistry: registry,
  resilienceAdapter: adapter,
})

const result = await engine.execute(workflow, { flag: 'on' })
console.log('[conditions-env] status:', result.status)
console.log('[conditions-env] maybe-run:', result.steps['maybe-run'])
console.log('[conditions-env] read-env:', result.steps['read-env'])
