/**
 * Agent-related type definitions for @orchestr8
 * These types define the contracts for agents and agent registries
 */

import type { ExecutionContext } from './workflow.js'

/**
 * Agent definition for execution
 */
export interface Agent {
  /**
   * Unique agent identifier
   */
  id: string

  /**
   * Agent name
   */
  name: string

  /**
   * Agent execution function
   */
  execute: (
    input: unknown,
    context: ExecutionContext,
    signal?: AbortSignal,
  ) => Promise<unknown>
}

/**
 * Registry for agent lookup and management
 */
export interface AgentRegistry {
  /**
   * Get an agent by ID
   * @param agentId The agent identifier
   * @returns The agent if found
   * @throws ExecutionError with VALIDATION code if agent not found
   */
  getAgent(agentId: string): Promise<Agent>

  /**
   * Check if an agent exists
   * @param agentId The agent identifier
   */
  hasAgent(agentId: string): Promise<boolean>

  /**
   * Register an agent
   * @param agent The agent to register
   */
  registerAgent?(agent: Agent): Promise<void>
}
