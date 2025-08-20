/*
  Fallback + Retry example for @orchestr8/core
  - Demonstrates onError: 'retry' with a simple adapter
  - Demonstrates onError: 'fallback' aliasing
*/

import type {
  Agent,
  AgentRegistry,
  ResilienceAdapter,
  ResilienceInvocationContext,
  ResiliencePolicy,
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

// Minimal adapter with retry + timeout support; circuit breaker omitted for brevity
const adapter: ResilienceAdapter = {
  async applyPolicy<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    policy: ResiliencePolicy,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.applyNormalizedPolicy!(
      operation,
      policy,
      'retry-cb-timeout',
      signal,
    )
  },

  async applyNormalizedPolicy<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    policy: ResiliencePolicy,
    _order,
    signal?: AbortSignal,
    _ctx?: ResilienceInvocationContext,
  ): Promise<T> {
    // Timeout wrapper
    const withTimeout = async () => {
      if (!policy.timeout) return operation(signal)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), policy.timeout)
      try {
        const composite = signal
          ? AbortSignal.any([signal, controller.signal])
          : controller.signal
        return await operation(composite)
      } finally {
        clearTimeout(timer)
      }
    }

    // Simple retry wrapper
    const retry = policy.retry
    if (!retry) return withTimeout()

    let attempt = 0
    let lastError: unknown
    const delay = async (ms: number) =>
      await new Promise((r) => setTimeout(r, ms))

    while (attempt < retry.maxAttempts) {
      try {
        return await withTimeout()
      } catch (e) {
        lastError = e
        attempt++
        if (attempt >= retry.maxAttempts) break
        const base =
          retry.backoffStrategy === 'fixed'
            ? retry.initialDelay
            : retry.initialDelay * Math.pow(2, attempt - 1)
        const jitter =
          retry.jitterStrategy === 'full-jitter' ? Math.random() * base : 0
        const wait = Math.min(base + jitter, retry.maxDelay)
        await delay(wait)
      }
    }
    throw lastError
  },
}

const registry = new MemoryAgentRegistry()

// Unstable agent that fails twice then succeeds
{
  let counter = 0
  await registry.registerAgent({
    id: 'unstable',
    name: 'Unstable Agent',
    async execute() {
      counter++
      if (counter < 3) {
        throw new Error(`Flaky failure #${counter}`)
      }
      return { ok: true, attempt: counter }
    },
  })
}

// Backup agent used as fallback
await registry.registerAgent({
  id: 'backup',
  name: 'Backup Agent',
  async execute(input) {
    const reason =
      (input as { reason?: string } | undefined)?.reason ?? 'unknown'
    return { recovered: true, reason }
  },
})

const workflow: Workflow = {
  id: 'wf-fallback-retry',
  name: 'Fallback + Retry',
  version: '1.0.0',
  steps: [
    {
      id: 'maybe-flaky',
      type: 'agent',
      agentId: 'unstable',
      onError: 'retry', // engine supplies default policy if none given
    },
    {
      id: 'consumer',
      type: 'agent',
      agentId: 'backup',
      dependsOn: ['maybe-flaky'],
      onError: 'fallback',
      fallbackStepId: 'backup-step',
      input: { reason: "${steps.maybe-flaky.error.message ?? 'n/a'}" },
    },
    {
      id: 'backup-step',
      type: 'agent',
      agentId: 'backup',
    },
  ],
}

const engine = new OrchestrationEngine({
  agentRegistry: registry,
  resilienceAdapter: adapter,
})

const result = await engine.execute(workflow)
console.log('[fallback-retry] status:', result.status)
console.log('[fallback-retry] maybe-flaky:', result.steps['maybe-flaky'])
console.log('[fallback-retry] consumer:', result.steps['consumer'])
console.log('[fallback-retry] backup-step:', result.steps['backup-step'])
