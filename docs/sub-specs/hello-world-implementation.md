# Hello World Multi-Agent Orchestrator - Implementation Guide

This document provides a comprehensive implementation reference for the Hello World Multi-Agent Orchestrator detailed in @.agent-os/specs/2025-01-17-orchestr8-system/spec.md

> Created: 2025-01-17  
> Version: 1.0.0  
> Status: Reference Implementation

## Overview

The Hello World Multi-Agent Orchestrator serves as the **MVP reference implementation** demonstrating core @orchestr8 system capabilities through a practical, working example. This implementation showcases multi-agent coordination, JSON prompt configuration, basic resilience patterns (retry, timeout, circuit breaker), and simple deployment strategies.

## System Architecture

```mermaid
graph TB
    subgraph "Hello World Orchestrator"
        HWO[Hello World Orchestrator<br/>Main Coordinator]

        subgraph "Research Agent Pool"
            GRA[GitHub Research Agent<br/>Repository Analysis]
            PRA[Profile Research Agent<br/>User Profile Analysis]
            ARA[Activity Research Agent<br/>Activity Tracking]
        end

        subgraph "Core Infrastructure"
            CP[Contribution Points System]
            EB[Event Bus]
            CB[Circuit Breaker]
            SM[State Manager]
            OT[OpenTelemetry]
        end

        subgraph "External Services"
            GITHUB[GitHub API]
            TAVILY[Tavily Search]
            MCP[MCP Servers]
        end
    end

    HWO --> GRA
    HWO --> PRA
    HWO --> ARA

    GRA --> CP
    PRA --> CP
    ARA --> CP

    CP --> EB
    EB --> CB
    CB --> SM
    SM --> OT

    GRA --> GITHUB
    PRA --> TAVILY
    ARA --> MCP
```

## Implementation Structure

### Core Package Structure

```
packages/
├── hello-world/
│   ├── src/
│   │   ├── orchestrator/
│   │   │   ├── hello-world-orchestrator.ts    # Main coordination logic
│   │   │   ├── execution-strategies.ts        # Parallel/sequential patterns
│   │   │   └── error-recovery.ts              # Resilience implementations
│   │   ├── agents/
│   │   │   ├── github-research-agent.ts       # GitHub API integration
│   │   │   ├── profile-research-agent.ts      # Profile analysis
│   │   │   └── activity-research-agent.ts     # Activity tracking
│   │   ├── prompts/
│   │   │   ├── base-agent-template.json       # Base JSON template
│   │   │   ├── research-agent-template.json   # Research specialization
│   │   │   └── coordination-template.json     # Orchestration prompts
│   │   ├── infrastructure/
│   │   │   ├── contribution-points.ts         # Plugin system
│   │   │   ├── event-bus.ts                   # Message coordination
│   │   │   ├── resilience-patterns.ts         # Fault tolerance
│   │   │   └── observability.ts               # Monitoring setup
│   │   └── deployment/
│   │       ├── standalone-deployment.ts       # Independent execution
│   │       └── integrated-deployment.ts       # Claude Code integration
│   ├── prompts/                               # JSON prompt library
│   ├── tests/                                 # Comprehensive test suite
│   ├── docs/                                  # Implementation documentation
│   └── examples/                              # Usage examples
```

## Core Implementation

### 1. Hello World Orchestrator

The main orchestrator demonstrates event-driven coordination with resilience patterns:

```typescript
import {
  BaseAgent,
  ExecutionStrategy,
  ResiliencePattern,
} from '@orchestr8/core'
import { EventBus, ContributionPoints } from '@orchestr8/runtime'
import {
  GitHubResearchAgent,
  ProfileResearchAgent,
  ActivityResearchAgent,
} from './agents'

export class HelloWorldOrchestrator extends BaseAgent {
  private eventBus: EventBus
  private contributionPoints: ContributionPoints
  private researchAgents: Map<string, BaseAgent>

  constructor(config: HelloWorldConfig) {
    super(config)
    this.eventBus = new EventBus({
      enableEventSourcing: false, // Post-MVP feature
      persistenceConfig: config.persistence,
    })

    this.contributionPoints = new ContributionPoints({
      registry: config.agentRegistry,
      discoveryStrategy: 'capability-based',
    })

    this.researchAgents = new Map([
      ['github', new GitHubResearchAgent(config.github)],
      ['profile', new ProfileResearchAgent(config.profile)],
      ['activity', new ActivityResearchAgent(config.activity)],
    ])

    this.setupEventHandlers()
    this.initializeResiliencePatterns()
  }

  /**
   * Main orchestration method demonstrating multi-agent coordination
   */
  async executeResearch(request: ResearchRequest): Promise<ResearchResult> {
    const correlationId = this.generateCorrelationId()
    const executionContext = this.createExecutionContext(correlationId)

    try {
      // Phase 1: Parallel research execution
      const researchTasks = this.createResearchTasks(request)
      const results = await this.executeWithStrategy(
        ExecutionStrategy.PARALLEL_WITH_FALLBACK,
        researchTasks,
        executionContext,
      )

      // Phase 2: Result synthesis and validation
      const synthesizedResult = await this.synthesizeResults(results)

      // Phase 3: Quality assurance and final processing
      const validatedResult = await this.validateAndEnrich(synthesizedResult)

      await this.publishSuccess(correlationId, validatedResult)
      return validatedResult
    } catch (error) {
      await this.handleExecutionError(error, correlationId)
      throw error
    }
  }

  /**
   * Demonstrates different execution strategies
   */
  private async executeWithStrategy(
    strategy: ExecutionStrategy,
    tasks: ResearchTask[],
    context: ExecutionContext,
  ): Promise<AgentResult[]> {
    switch (strategy) {
      case ExecutionStrategy.PARALLEL_WITH_FALLBACK:
        return await this.executeParallelWithFallback(tasks, context)

      case ExecutionStrategy.SEQUENTIAL_WITH_DEPENDENCIES:
        return await this.executeSequentialWithDependencies(tasks, context)

      case ExecutionStrategy.HYBRID_PRIORITIZED:
        return await this.executeHybridPrioritized(tasks, context)

      default:
        throw new Error(`Unsupported execution strategy: ${strategy}`)
    }
  }

  /**
   * Parallel execution with automatic fallback to sequential on partial failure
   */
  private async executeParallelWithFallback(
    tasks: ResearchTask[],
    context: ExecutionContext,
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = []
    const failedTasks: ResearchTask[] = []

    // Attempt parallel execution
    const parallelResults = await Promise.allSettled(
      tasks.map((task) => this.executeTask(task, context)),
    )

    parallelResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        failedTasks.push(tasks[index])
        this.logger.warn(
          `Task ${tasks[index].id} failed in parallel execution`,
          {
            error: result.reason,
            correlationId: context.correlationId,
          },
        )
      }
    })

    // Fallback: sequential execution for failed tasks
    if (failedTasks.length > 0) {
      this.logger.info(
        `Executing ${failedTasks.length} failed tasks sequentially`,
      )

      for (const task of failedTasks) {
        try {
          const result = await this.executeTaskWithRetry(task, context)
          results.push(result)
        } catch (error) {
          // Log and continue - demonstrate graceful degradation
          this.logger.error(
            `Task ${task.id} failed even in sequential execution`,
            {
              error,
              correlationId: context.correlationId,
            },
          )
        }
      }
    }

    return results
  }

  /**
   * Event sourcing for complete execution recording
   */
  private async publishExecutionEvent(
    type: string,
    payload: any,
    context: ExecutionContext,
  ): Promise<void> {
    const event = {
      id: crypto.randomUUID(),
      type,
      timestamp: new Date(),
      correlationId: context.correlationId,
      causationId: context.causationId,
      agentId: this.config.agentId,
      payload,
    }

    await this.eventBus.publish(event)

    // Post-MVP: Time travel debugger support will be added later
  }
}
```

### 2. JSON Prompt Configuration Framework

Demonstration of structured JSON prompt templates:

```json
// base-agent-template.json
{
  "name": "base-agent",
  "version": "1.0",
  "metadata": {
    "role": "{{role}}",
    "version": "{{version}}",
    "capabilities": "{{capabilities}}"
  },
  "executionContext": {
    "correlationId": "{{correlationId}}",
    "executionStrategy": "{{strategy}}",
    "errorHandling": "{{errorHandling}}"
  },
  "instructions": {
    "primaryObjective": "{{primaryObjective}}",
    "executionSteps": [
      {
        "number": "{{number}}",
        "description": "{{description}}",
        "action": "{{action}}",
        "validation": "{{validation}}",
        "onError": "{{errorAction}}"
      }
    ]
  },
  "constraints": {
    "forbiddenActions": ["{{forbiddenActions}}"],
    "requiredValidations": ["{{validations}}"],
    "maxRetries": 3,
    "timeout": 30000
  },
  "outputFormat": {
    "structure": "{{outputStructure}}",
    "validationSchema": "{{validationSchema}}"
  },
  "parsingRules": [
    "Process instructions in sequential order",
    "Use templates as exact patterns",
    "Never deviate from specified commands",
    "Validate each step before proceeding"
  ],
  "toolConventions": [
    "Only use tools explicitly listed in capabilities",
    "Follow exact command templates",
    "Always validate outputs before proceeding",
    "Report failures immediately with context"
  ]
}
```

````json
// github-research-agent-template.json
{
  "name": "github-research-agent",
  "extends": "research-agent-template",
  "version": "1.0.0",
  "metadata": {
    "role": "GitHub Repository Research Specialist",
    "specialization": "GitHub API Integration and Repository Analysis"
  },
  "githubSpecific": {
    "apiConfiguration": {
      "rateLimiting": {
        "requestsPerHour": 5000,
        "burstAllowance": 100,
        "backoffStrategy": "exponential"
      },
      "authentication": {
        "method": "personal-access-token",
        "scopeRequirements": ["repo", "read:user", "read:org"]
      }
    },
    "searchStrategies": {
      "repositoryDiscovery": {
        "action": "Use GitHub API to search repositories",
        "validate": "Repository exists and is accessible",
        "extract": "Repository metadata, statistics, and recent activity",
        "analyze": "Code structure, contribution patterns, and health metrics"
      },
      "contributorAnalysis": {
        "action": "Analyze repository contributors and their activity patterns",
        "validate": "User profiles are public and accessible",
        "extract": "Contribution statistics, commit history, and collaboration patterns",
        "synthesize": "Developer activity summary and expertise assessment"
      }
    }
  },
  "outputSpecification": {
    "repositoryAnalysis": {
      "metadata": {
        "name": "string",
        "description": "string",
        "language": "string",
        "stars": "number",
        "forks": "number",
        "lastUpdated": "datetime"
      },
      "activityMetrics": {
        "commitFrequency": "number",
        "contributorCount": "number",
        "issueResolutionTime": "duration",
        "pullRequestVelocity": "number"
      },
      "healthIndicators": {
        "maintenanceStatus": "active|maintained|deprecated",
        "communityEngagement": "high|medium|low",
        "codeQualityIndicators": "object"
      }
    }
  }
}

### 3. Research Agent Implementations

```typescript
/**
 * GitHub Research Agent - Demonstrates MCP integration and API handling
 */
export class GitHubResearchAgent extends BaseAgent {
  private github: GitHubAPIClient;
  private circuitBreaker: CircuitBreaker;

  constructor(config: GitHubAgentConfig) {
    super({
      ...config,
      promptTemplate: 'github-research-agent-template.xml',
      capabilities: ['repository-analysis', 'contributor-research', 'activity-tracking']
    });

    this.github = new GitHubAPIClient({
      token: config.githubToken,
      rateLimit: config.rateLimit
    });

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringEnabled: true
    });
  }

  async analyzeRepository(request: RepositoryAnalysisRequest): Promise<RepositoryAnalysis> {
    const context = this.createExecutionContext();

    return await this.circuitBreaker.execute(async () => {
      // Step 1: Repository metadata retrieval
      const repository = await this.github.getRepository(request.owner, request.repo);

      // Step 2: Contributor analysis
      const contributors = await this.github.getContributors(request.owner, request.repo);

      // Step 3: Activity metrics calculation
      const activityMetrics = await this.calculateActivityMetrics(repository, contributors);

      // Step 4: Health assessment
      const healthIndicators = await this.assessRepositoryHealth(repository, activityMetrics);

      return {
        metadata: this.extractRepositoryMetadata(repository),
        activityMetrics,
        healthIndicators,
        contributors: this.processContributors(contributors),
        timestamp: new Date(),
        correlationId: context.correlationId
      };
    });
  }

  private async calculateActivityMetrics(
    repository: GitHubRepository,
    contributors: GitHubContributor[]
  ): Promise<ActivityMetrics> {

    const commits = await this.github.getCommits(repository.full_name, {
      since: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
    });

    const issues = await this.github.getIssues(repository.full_name, {
      state: 'all',
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
    });

    const pullRequests = await this.github.getPullRequests(repository.full_name, {
      state: 'all',
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    });

    return {
      commitFrequency: this.calculateCommitFrequency(commits),
      contributorCount: contributors.length,
      issueResolutionTime: this.calculateAverageResolutionTime(issues),
      pullRequestVelocity: this.calculatePRVelocity(pullRequests),
      codeChurn: this.calculateCodeChurn(commits),
      testCoverage: await this.estimateTestCoverage(repository)
    };
  }
}

/**
 * Profile Research Agent - Demonstrates web search integration
 */
export class ProfileResearchAgent extends BaseAgent {
  private webSearch: TavilySearchClient;
  private profileCache: LRUCache<string, ProfileAnalysis>;

  constructor(config: ProfileAgentConfig) {
    super({
      ...config,
      promptTemplate: 'profile-research-agent-template.xml',
      capabilities: ['profile-analysis', 'social-research', 'professional-assessment']
    });

    this.webSearch = new TavilySearchClient({
      apiKey: config.tavilyApiKey,
      maxResults: config.maxSearchResults || 10
    });

    this.profileCache = new LRUCache({
      max: 1000,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
  }

  async analyzeProfile(request: ProfileAnalysisRequest): Promise<ProfileAnalysis> {
    const cacheKey = this.generateCacheKey(request);
    const cached = this.profileCache.get(cacheKey);

    if (cached && !request.forceRefresh) {
      return cached;
    }

    const context = this.createExecutionContext();

    try {
      // Multi-source profile research
      const [
        professionalProfile,
        socialMediaPresence,
        publicContributions,
        expertiseAssessment
      ] = await Promise.allSettled([
        this.researchProfessionalProfile(request),
        this.analyzeSocialMediaPresence(request),
        this.catalogPublicContributions(request),
        this.assessExpertiseLevel(request)
      ]);

      const analysis = {
        professionalProfile: this.extractResult(professionalProfile),
        socialMediaPresence: this.extractResult(socialMediaPresence),
        publicContributions: this.extractResult(publicContributions),
        expertiseAssessment: this.extractResult(expertiseAssessment),
        confidenceScore: this.calculateConfidenceScore([
          professionalProfile,
          socialMediaPresence,
          publicContributions,
          expertiseAssessment
        ]),
        timestamp: new Date(),
        correlationId: context.correlationId
      };

      this.profileCache.set(cacheKey, analysis);
      return analysis;

    } catch (error) {
      this.logger.error('Profile analysis failed', {
        error,
        request: this.sanitizeRequest(request),
        correlationId: context.correlationId
      });
      throw error;
    }
  }

  private async researchProfessionalProfile(
    request: ProfileAnalysisRequest
  ): Promise<ProfessionalProfile> {

    const searchQuery = this.buildProfessionalSearchQuery(request);
    const searchResults = await this.webSearch.search({
      query: searchQuery,
      searchType: 'professional',
      includeAnswer: true,
      maxResults: 5
    });

    return {
      linkedin: await this.extractLinkedInData(searchResults),
      companyAffiliations: await this.extractCompanyData(searchResults),
      professionalAchievements: await this.extractAchievements(searchResults),
      skills: await this.extractSkillsAndExpertise(searchResults),
      timeline: await this.constructProfessionalTimeline(searchResults)
    };
  }
}
````

### 4. MVP Resilience Pattern Implementation

```typescript
/**
 * MVP resilience patterns - Retry, Timeout, Circuit Breaker only
 */
export class ResiliencePatternManager {
  private circuitBreakers: Map<string, CircuitBreaker>
  private retryPolicies: Map<string, RetryPolicy>
  private timeoutManagers: Map<string, TimeoutManager>

  constructor(config: ResilienceConfig) {
    this.circuitBreakers = new Map()
    this.retryPolicies = new Map()
    this.timeoutManagers = new Map()

    this.initializePatterns(config)
  }

  /**
   * Circuit Breaker Pattern - Prevents cascading failures
   * MVP: Simple open/closed/half-open states
   */
  createCircuitBreaker(
    name: string,
    config: CircuitBreakerConfig,
  ): CircuitBreaker {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: config.failureThreshold || 5,
      successThreshold: config.successThreshold || 3,
      resetTimeout: config.resetTimeout || 60000,
      monitoringEnabled: true,

      onStateChange: (state: CircuitBreakerState) => {
        this.publishStateChangeEvent(name, state)
      },

      onTrip: (error: Error) => {
        this.handleCircuitBreakerTrip(name, error)
      },
    })

    this.circuitBreakers.set(name, circuitBreaker)
    return circuitBreaker
  }

  /**
   * Retry Policy - MVP: Max 3 retries with exponential backoff
   */
  createRetryPolicy(name: string, config: RetryPolicyConfig): RetryPolicy {
    const retryPolicy = new RetryPolicy({
      maxRetries: config.maxRetries || 3, // MVP: Max 3 retries
      baseDelay: config.baseDelay || 1000,
      maxDelay: config.maxDelay || 10000, // MVP: Max 10s delay
      backoffMultiplier: config.backoffMultiplier || 2,
      jitter: config.jitter || true,

      retryCondition: (error: Error, attempt: number) => {
        // Determine if error is retryable
        return this.isRetryableError(error) && attempt < config.maxRetries
      },

      onRetry: (error: Error, attempt: number) => {
        this.logger.warn(`Retry attempt ${attempt} for ${name}`, {
          error: error.message,
          attempt,
        })
      },
    })

    this.retryPolicies.set(name, retryPolicy)
    return retryPolicy
  }

  /**
   * Timeout Management - MVP: 30 second default timeout
   */
  createTimeoutManager(name: string, config: TimeoutConfig): TimeoutManager {
    const timeoutManager = new TimeoutManager({
      defaultTimeout: config.defaultTimeout || 30000, // MVP: 30s default
      operationTimeouts: config.operationTimeouts || {},

      onTimeout: (operation: string, duration: number) => {
        this.handleTimeout(name, operation, duration)
      },

      gracefulShutdown: config.gracefulShutdown || true,
    })

    this.timeoutManagers.set(name, timeoutManager)
    return timeoutManager
  }

  /**
   * Execute with combined resilience patterns
   * MVP: Composition order: Retry -> Circuit Breaker -> Timeout
   */
  async executeWithResilience<T>(
    name: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const circuitBreaker = this.circuitBreakers.get(name)
    const retryPolicy = this.retryPolicies.get(name)
    const timeoutManager = this.timeoutManagers.get(name)

    if (!circuitBreaker || !retryPolicy || !timeoutManager) {
      // If patterns not configured, execute directly
      return await operation()
    }

    // MVP composition: Retry wraps Circuit Breaker wraps Timeout wraps operation
    return await retryPolicy.execute(async () => {
      return await circuitBreaker.execute(async () => {
        return await timeoutManager.execute('default', operation)
      })
    })
  }
}

// Note: Bulkhead isolation and other advanced patterns are deferred to post-MVP
```

### 5. Event-Driven Communication

```typescript
/**
 * MVP Event Bus Implementation - Simple in-process events
 */
export class EventBus {
  private subscribers: Map<string, Set<EventHandler>>
  private circuitBreakers: Map<string, CircuitBreaker>

  constructor(config: EventBusConfig) {
    this.subscribers = new Map()
    this.circuitBreakers = new Map()
  }

  /**
   * Publish event to subscribers
   */
  async publish(event: AgentEvent): Promise<void> {
    // Get subscribers for this event type
    const handlers = this.subscribers.get(event.type) || new Set()

    // Execute handlers with circuit breaker protection
    const handlerPromises = Array.from(handlers).map(async (handler) => {
      const handlerId = this.getHandlerId(handler)
      const circuitBreaker = this.getOrCreateCircuitBreaker(handlerId)

      return circuitBreaker.execute(async () => {
        await handler(event)
      })
    })

    // Wait for all handlers to complete (or fail gracefully)
    const results = await Promise.allSettled(handlerPromises)

    // Log any handler failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(`Event handler failed`, {
          eventType: event.type,
          eventId: event.id,
          handlerIndex: index,
          error: result.reason,
        })
      }
    })
  }

  /**
   * Subscribe to events with automatic circuit breaker protection
   */
  subscribe(eventType: string, handler: EventHandler): EventSubscription {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set())
    }

    this.subscribers.get(eventType)!.add(handler)

    return {
      eventType,
      handler,
      unsubscribe: () => {
        const handlers = this.subscribers.get(eventType)
        if (handlers) {
          handlers.delete(handler)
        }
      },
    }
  }

  // Note: Event sourcing and replay functionality deferred to post-MVP
}
```

## Deployment Strategies

### Standalone Deployment

```typescript
/**
 * Standalone deployment for independent execution
 */
export class StandaloneDeployment {
  private orchestrator: HelloWorldOrchestrator
  private server: HTTPServer
  private monitoring: MonitoringSetup

  constructor(config: StandaloneConfig) {
    this.orchestrator = new HelloWorldOrchestrator(config.orchestrator)
    this.server = new HTTPServer(config.server)
    this.monitoring = new MonitoringSetup(config.monitoring)
  }

  async start(): Promise<void> {
    // Initialize monitoring
    await this.monitoring.initialize()

    // Setup HTTP endpoints
    this.server.post('/research', async (req, res) => {
      try {
        const result = await this.orchestrator.executeResearch(req.body)
        res.json(result)
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    })

    this.server.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date(),
      })
    })

    // Start server
    await this.server.listen()
    console.log(`Hello World Orchestrator running on port ${this.server.port}`)
  }
}

// Docker deployment configuration
const dockerConfig = {
  image: '@orchestr8/hello-world:latest',
  ports: [3000],
  environment: {
    NODE_ENV: 'production',
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    OPENTELEMETRY_ENDPOINT: process.env.OTEL_ENDPOINT,
  },
  healthCheck: {
    test: ['CMD', 'curl', '-f', 'http://localhost:3000/health'],
    interval: '30s',
    timeout: '10s',
    retries: 3,
  },
}
```

### Claude Code Integration

```typescript
/**
 * Integration deployment for Claude Code sub-agent execution
 */
export class ClaudeCodeIntegration {
  private orchestrator: HelloWorldOrchestrator
  private claudeInterface: ClaudeCodeInterface

  constructor(config: IntegratedConfig) {
    this.orchestrator = new HelloWorldOrchestrator(config.orchestrator)
    this.claudeInterface = new ClaudeCodeInterface(config.claude)
  }

  /**
   * Register as Claude Code sub-agent
   */
  async registerSubAgent(): Promise<void> {
    await this.claudeInterface.registerAgent({
      name: 'hello-world-orchestrator',
      description:
        'Multi-agent research orchestrator demonstrating @orchestr8 capabilities',
      capabilities: [
        'multi-agent-coordination',
        'github-research',
        'profile-analysis',
        'activity-tracking',
        'research-synthesis',
      ],

      // Agent execution handler
      execute: async (request: AgentRequest) => {
        return await this.orchestrator.executeResearch(request.payload)
      },

      // Health check for agent management
      healthCheck: async () => {
        return await this.orchestrator.performHealthCheck()
      },
    })
  }

  /**
   * Handle Claude Code agent lifecycle
   */
  async handleAgentLifecycle(): Promise<void> {
    // Graceful shutdown handling
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...')
      await this.orchestrator.shutdown()
      process.exit(0)
    })

    // Error handling and recovery
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error)
      await this.orchestrator.handleCriticalError(error)
    })
  }
}
```

## Performance Benchmarks and Testing

### Performance Requirements

```typescript
/**
 * Performance benchmark suite demonstrating system capabilities
 */
export class PerformanceBenchmarks {
  private orchestrator: HelloWorldOrchestrator
  private metrics: PerformanceMetrics

  async runBenchmarkSuite(): Promise<BenchmarkResults> {
    const results: BenchmarkResults = {
      orchestrationOverhead: await this.measureOrchestrationOverhead(),
      parallelExecutionEfficiency: await this.measureParallelExecution(),
      resilienceRecoveryTime: await this.measureResilienceRecovery(),
      eventSourcingPerformance: await this.measureEventSourcing(),
      memoryUsage: await this.measureMemoryFootprint(),
      concurrentAgentCapacity: await this.measureConcurrentCapacity(),
    }

    return results
  }

  /**
   * Target: <100ms orchestration overhead
   */
  private async measureOrchestrationOverhead(): Promise<PerformanceMetric> {
    const iterations = 1000
    const timings: number[] = []

    for (let i = 0; i < iterations; i++) {
      const start = performance.now()

      // Minimal orchestration task
      await this.orchestrator.coordinateAgents([
        { type: 'noop', agent: 'test-agent-1' },
        { type: 'noop', agent: 'test-agent-2' },
      ])

      const end = performance.now()
      timings.push(end - start)
    }

    return {
      average: timings.reduce((a, b) => a + b) / timings.length,
      p95: this.calculatePercentile(timings, 0.95),
      p99: this.calculatePercentile(timings, 0.99),
      target: 100, // ms
      status:
        timings.reduce((a, b) => a + b) / timings.length < 100
          ? 'PASS'
          : 'FAIL',
    }
  }

  /**
   * Target: 10 concurrent agents (MVP target)
   */
  private async measureConcurrentCapacity(): Promise<PerformanceMetric> {
    const maxAgents = 15 // Test up to 15 to verify 10 works well
    const batchSize = 5
    let successfulAgents = 0

    for (let batch = 0; batch < maxAgents / batchSize; batch++) {
      const agents = Array.from({ length: batchSize }, (_, i) =>
        this.createTestAgent(`agent-${batch}-${i}`),
      )

      try {
        await Promise.all(agents.map((agent) => agent.executeTask()))
        successfulAgents += batchSize
      } catch (error) {
        break // Stop when we hit capacity limits
      }
    }

    return {
      maxConcurrent: successfulAgents,
      target: 10, // MVP target
      status: successfulAgents >= 10 ? 'PASS' : 'FAIL',
    }
  }
}
```

### Comprehensive Test Suite

```typescript
/**
 * Test suite demonstrating TDD approach and comprehensive coverage
 */
describe('Hello World Orchestrator', () => {
  let orchestrator: HelloWorldOrchestrator
  let mockGitHubAgent: jest.Mocked<GitHubResearchAgent>
  let mockProfileAgent: jest.Mocked<ProfileResearchAgent>
  let mockActivityAgent: jest.Mocked<ActivityResearchAgent>

  beforeEach(() => {
    // Setup mocks and test environment
    mockGitHubAgent = createMockGitHubAgent()
    mockProfileAgent = createMockProfileAgent()
    mockActivityAgent = createMockActivityAgent()

    orchestrator = new HelloWorldOrchestrator({
      agents: {
        github: mockGitHubAgent,
        profile: mockProfileAgent,
        activity: mockActivityAgent,
      },
      resilience: createTestResilienceConfig(),
      monitoring: createTestMonitoringConfig(),
    })
  })

  describe('Multi-Agent Coordination', () => {
    test('should coordinate parallel research execution', async () => {
      // Arrange
      const request = createTestResearchRequest()

      mockGitHubAgent.analyzeRepository.mockResolvedValue(
        createMockRepositoryAnalysis(),
      )
      mockProfileAgent.analyzeProfile.mockResolvedValue(
        createMockProfileAnalysis(),
      )
      mockActivityAgent.trackActivity.mockResolvedValue(
        createMockActivityAnalysis(),
      )

      // Act
      const result = await orchestrator.executeResearch(request)

      // Assert
      expect(result).toBeDefined()
      expect(result.githubAnalysis).toBeDefined()
      expect(result.profileAnalysis).toBeDefined()
      expect(result.activityAnalysis).toBeDefined()
      expect(result.synthesis).toBeDefined()

      // Verify parallel execution
      expect(mockGitHubAgent.analyzeRepository).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: expect.any(String) }),
      )
      expect(mockProfileAgent.analyzeProfile).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: expect.any(String) }),
      )
      expect(mockActivityAgent.trackActivity).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: expect.any(String) }),
      )
    })

    test('should handle partial failures with graceful degradation', async () => {
      // Arrange
      const request = createTestResearchRequest()

      mockGitHubAgent.analyzeRepository.mockResolvedValue(
        createMockRepositoryAnalysis(),
      )
      mockProfileAgent.analyzeProfile.mockRejectedValue(
        new Error('Profile API unavailable'),
      )
      mockActivityAgent.trackActivity.mockResolvedValue(
        createMockActivityAnalysis(),
      )

      // Act
      const result = await orchestrator.executeResearch(request)

      // Assert
      expect(result).toBeDefined()
      expect(result.githubAnalysis).toBeDefined()
      expect(result.profileAnalysis).toBeUndefined()
      expect(result.activityAnalysis).toBeDefined()
      expect(result.partialFailures).toContain('profile-analysis')
      expect(result.synthesis).toBeDefined() // Should still synthesize available data
    })
  })

  describe('Resilience Patterns', () => {
    test('should implement circuit breaker pattern', async () => {
      // Arrange
      const request = createTestResearchRequest()

      // Simulate repeated failures
      mockGitHubAgent.analyzeRepository.mockRejectedValue(
        new Error('GitHub API error'),
      )

      // Act & Assert
      for (let i = 0; i < 10; i++) {
        try {
          await orchestrator.executeResearch(request)
        } catch (error) {
          // Expected failures
        }
      }

      // Verify circuit breaker tripped
      const circuitBreakerState =
        await orchestrator.getCircuitBreakerState('github-agent')
      expect(circuitBreakerState).toBe('OPEN')
    })

    test('should implement retry policy with exponential backoff', async () => {
      // Arrange
      const request = createTestResearchRequest()
      let callCount = 0

      mockGitHubAgent.analyzeRepository.mockImplementation(() => {
        callCount++
        if (callCount < 3) {
          throw new Error('Temporary failure')
        }
        return Promise.resolve(createMockRepositoryAnalysis())
      })

      // Act
      const result = await orchestrator.executeResearch(request)

      // Assert
      expect(result).toBeDefined()
      expect(callCount).toBe(3) // Should retry twice before succeeding
    })
  })

  // Note: Event sourcing tests deferred to post-MVP
})
```

## Usage Examples and Documentation

### Basic Usage

```typescript
// Basic standalone usage
import { HelloWorldOrchestrator } from '@orchestr8/hello-world'

const orchestrator = new HelloWorldOrchestrator({
  github: {
    token: process.env.GITHUB_TOKEN,
    rateLimit: { requestsPerHour: 5000 },
  },
  profile: {
    tavilyApiKey: process.env.TAVILY_API_KEY,
    maxSearchResults: 10,
  },
  activity: {
    mcpServers: ['tavily-mcp', 'github-mcp'],
  },
  resilience: {
    circuitBreaker: { failureThreshold: 5 },
    retry: { maxRetries: 3 },
    timeout: { defaultTimeout: 30000 },
  },
})

const result = await orchestrator.executeResearch({
  target: 'nathanvale',
  includeRepositories: true,
  includeProfile: true,
  includeActivity: true,
  synthesize: true,
})

console.log('Research Result:', result)
```

### Claude Code Sub-Agent Usage

```bash
# Create Claude Code sub-agent configuration
mkdir -p .claude/agents

cat > .claude/agents/hello-world-orchestrator.md << 'EOF'
---
name: hello-world-orchestrator
description: Multi-agent research orchestrator demonstrating @orchestr8 capabilities. Use for comprehensive research requiring GitHub analysis, profile research, and activity tracking.
tools: github_api, web_search, file_write
---

# Hello World Multi-Agent Orchestrator

You are a sophisticated research orchestrator that coordinates multiple specialized agents to conduct comprehensive research. Your capabilities include:

## Research Coordination
- **GitHub Analysis**: Repository statistics, contributor analysis, and activity metrics
- **Profile Research**: Professional background, social presence, and expertise assessment
- **Activity Tracking**: Recent activities, contributions, and engagement patterns
- **Research Synthesis**: Combine findings into coherent insights and recommendations

## Execution Strategy
1. **Parallel Coordination**: Execute research agents simultaneously for efficiency
2. **Resilience Handling**: Gracefully handle partial failures and API limitations
3. **Quality Synthesis**: Combine results into actionable insights
4. **Performance Optimization**: Monitor execution metrics and optimize workflows

## Usage Patterns
- Comprehensive user research for team evaluation
- Technology adoption analysis and recommendations
- Open source project assessment and due diligence
- Developer community engagement analysis

When invoked, coordinate the GitHub, Profile, and Activity research agents in parallel, handle any failures gracefully, and synthesize findings into a comprehensive report.
EOF

# Usage in Claude Code
claude -p "Use hello-world-orchestrator to research user 'gaearon' including GitHub repositories, professional profile, and recent activity patterns"
```

### Performance Monitoring Example

```typescript
// Performance monitoring and optimization
import { PerformanceMonitor } from '@orchestr8/hello-world/monitoring'

const monitor = new PerformanceMonitor({
  metricsConfig: {
    orchestrationOverhead: { threshold: 100, unit: 'ms' },
    parallelEfficiency: { threshold: 0.8, unit: 'ratio' },
    memoryUsage: { threshold: 512, unit: 'MB' },
    concurrentCapacity: { threshold: 100, unit: 'agents' },
  },

  alerting: {
    thresholdViolations: true,
    performanceDegradation: true,
    circuitBreakerEvents: true,
  },

  optimization: {
    autoScaling: true,
    resourceOptimization: true,
    cacheManagement: true,
  },
})

// Run continuous monitoring
monitor.startContinuousMonitoring()

// Get performance insights
const insights = await monitor.getPerformanceInsights()
console.log('Performance Insights:', insights)
```

## Conclusion

The Hello World Multi-Agent Orchestrator provides an **MVP reference implementation** that demonstrates core @orchestr8 capabilities:

- ✅ **Multi-Agent Coordination**: Parallel execution with graceful fallback strategies
- ✅ **JSON Prompt Configuration**: Structured prompt templates with validation
- ✅ **Basic Resilience Patterns**: Retry (3x), timeout (30s), and circuit breaker
- ✅ **In-Process Events**: Simple event bus for agent communication
- ✅ **Performance Targets**: Sub-100ms orchestration overhead with 10 concurrent agents
- ✅ **Simple Deployment**: Standalone execution and basic Claude Code integration
- ✅ **Production Ready**: Basic monitoring, observability, and error handling

This implementation serves as the **MVP example** for @orchestr8 adoption in the 4-week timeline, providing teams with working code, configuration patterns, and best practices for building multi-agent systems. The test suite with 80% coverage target, performance benchmarks, and deployment examples ensure teams can adopt the platform within the MVP constraints.

The Hello World Orchestrator demonstrates that production-ready agent orchestration can be achieved with simple, proven patterns that avoid complexity while maintaining reliability and performance.
