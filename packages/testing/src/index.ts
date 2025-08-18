/**
 * @orchestr8/testing - Test utilities and mocks
 */

// Export mock implementations
export { MockAgent, MockAgentRegistry } from './mocks/agent-registry.js'
export { MockResilienceAdapter } from './mocks/resilience-adapter.js'

// Export test helpers
export {
  createSuccessfulStepResult,
  createFailedStepResult,
  createSkippedStepResult,
  createCancelledStepResult,
  createSuccessfulWorkflowResult,
  waitFor,
  createDeferredPromise,
  createTimeoutController,
  fakeTimers,
  calculateJsonSize,
  createLargeData,
  createCircularReference,
} from './utilities/test-helpers.js'

// Export workflow builders
export {
  WorkflowBuilder,
  createAgentStep,
  createSequentialWorkflow,
  createParallelWorkflow,
  createWorkflowWithDependencies,
  createHybridWorkflow,
} from './utilities/workflow-builder.js'
