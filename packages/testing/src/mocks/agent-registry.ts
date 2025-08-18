/**
 * Mock AgentRegistry for testing
 * Wallaby.js compatible with mockImplementation pattern
 */

import type { Agent, AgentRegistry } from '@orchestr8/core'

import { createExecutionError, ExecutionErrorCode } from '@orchestr8/schema'
import { vi } from 'vitest'

/**
 * Mock agent for testing
 */
export class MockAgent implements Agent {
  id: string
  name: string
  execute = vi.fn()

  constructor(id: string, name?: string) {
    this.id = id
    this.name = name || `Mock Agent ${id}`

    // Default implementation that returns the input
    this.execute.mockImplementation(async (input) => {
      return { processed: true, input }
    })
  }

  /**
   * Configure the agent to return a specific value
   */
  mockReturnValue(value: unknown): this {
    this.execute.mockImplementation(async () => value)
    return this
  }

  /**
   * Configure the agent to throw an error
   */
  mockRejectedValue(error: Error): this {
    this.execute.mockImplementation(async () => {
      throw error
    })
    return this
  }

  /**
   * Configure the agent with a custom implementation
   */
  mockImplementation(
    fn: (
      input: unknown,
      context: unknown,
      signal?: AbortSignal,
    ) => Promise<unknown>,
  ): this {
    this.execute.mockImplementation(fn)
    return this
  }
}

/**
 * Mock AgentRegistry for testing
 */
export class MockAgentRegistry implements AgentRegistry {
  private agents = new Map<string, Agent>()

  // Spy functions for testing
  getAgent = vi.fn()
  hasAgent = vi.fn()
  registerAgent = vi.fn()

  constructor() {
    // Default implementations using mockImplementation for Wallaby compatibility
    this.getAgent.mockImplementation(async (agentId: string) => {
      const agent = this.agents.get(agentId)
      if (!agent) {
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${agentId}`,
          { context: { agentId } },
        )
      }
      return agent
    })

    this.hasAgent.mockImplementation(async (agentId: string) => {
      return this.agents.has(agentId)
    })

    this.registerAgent.mockImplementation(async (agent: Agent) => {
      this.agents.set(agent.id, agent)
    })
  }

  /**
   * Add a mock agent to the registry
   */
  addMockAgent(id: string, name?: string): MockAgent {
    const agent = new MockAgent(id, name)
    this.agents.set(id, agent)
    return agent
  }

  /**
   * Configure to simulate agent not found
   */
  simulateAgentNotFound(agentId: string): void {
    this.getAgent.mockImplementationOnce(async () => {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        `Agent not found: ${agentId}`,
        { context: { agentId } },
      )
    })
  }

  /**
   * Configure to simulate lookup failure
   */
  simulateLookupFailure(error: Error): void {
    this.getAgent.mockImplementationOnce(async () => {
      throw error
    })
  }

  /**
   * Clear all registered agents
   */
  clear(): void {
    this.agents.clear()
  }

  /**
   * Reset all mocks
   */
  reset(): void {
    this.getAgent.mockReset()
    this.hasAgent.mockReset()
    this.registerAgent.mockReset()

    // Restore default implementations
    this.getAgent.mockImplementation(async (agentId: string) => {
      const agent = this.agents.get(agentId)
      if (!agent) {
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${agentId}`,
          { context: { agentId } },
        )
      }
      return agent
    })

    this.hasAgent.mockImplementation(async (agentId: string) => {
      return this.agents.has(agentId)
    })

    this.registerAgent.mockImplementation(async (agent: Agent) => {
      this.agents.set(agent.id, agent)
    })
  }
}
