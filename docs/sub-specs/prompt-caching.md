# Prompt Caching Specification

This document defines the official Anthropic prompt caching implementation for @orchestr8 agents, based on Claude's production caching patterns.

> Created: 2025-01-18  
> Version: 1.0.0  
> Status: Production Implementation

## Overview

Prompt caching reduces costs by 90% and improves response times by caching static content like system prompts, tools, and context. Based on official Anthropic documentation, this spec provides the exact implementation patterns for @orchestr8.

## Core Concepts

### Cache Lifetime

- **Ephemeral Cache**: 5-minute lifetime (only supported type)
- **Cache Key**: Based on exact prefix match of content
- **Automatic Refresh**: Cache refreshes on hit, extending lifetime

### Supported Models

- Claude Opus 4, Sonnet 4, Sonnet 3.7, Sonnet 3.5
- Claude Haiku 3.5, Haiku 3
- Claude Opus 3

## Implementation Pattern

### Basic Cache Control Structure

```json
{
  "model": "claude-opus-4-20250514",
  "max_tokens": 1024,
  "system": [
    {
      "type": "text",
      "text": "You are an AI assistant for @orchestr8...",
      "cache_control": { "type": "ephemeral" }
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": "Analyze this workflow"
    }
  ]
}
```

### Multi-Level Caching with Tools

```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 2048,
  "tools": [
    {
      "name": "search_workflows",
      "description": "Search through workflow definitions",
      "input_schema": {
        "type": "object",
        "properties": {
          "query": { "type": "string" }
        },
        "required": ["query"]
      }
    },
    {
      "name": "execute_workflow",
      "description": "Execute a workflow by ID",
      "input_schema": {
        "type": "object",
        "properties": {
          "workflow_id": { "type": "string" },
          "inputs": { "type": "object" }
        },
        "required": ["workflow_id"]
      },
      "cache_control": { "type": "ephemeral" }
    }
  ],
  "system": [
    {
      "type": "text",
      "text": "# @orchestr8 Agent System Prompt\n\nYou are an orchestration agent...",
      "cache_control": { "type": "ephemeral" }
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Previous context from earlier in conversation..."
        },
        {
          "type": "text",
          "text": "New user query here",
          "cache_control": { "type": "ephemeral" }
        }
      ]
    }
  ]
}
```

## Caching Strategy for @orchestr8

### 1. System Prompt Caching

Always cache the system prompt as it rarely changes:

```typescript
interface CachedSystemPrompt {
  system: Array<{
    type: 'text'
    text: string
    cache_control?: { type: 'ephemeral' }
  }>
}

function buildSystemPrompt(agent: AgentConfig): CachedSystemPrompt {
  return {
    system: [
      {
        type: 'text',
        text: agent.systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
  }
}
```

### 2. Tool Definition Caching

Cache tool definitions after the last frequently-used tool:

```typescript
function buildToolsWithCache(tools: Tool[]): Tool[] {
  // Sort tools by usage frequency
  const sortedTools = tools.sort((a, b) => b.usageFreq - a.usageFreq)

  // Add cache control to the last tool
  const lastIndex = sortedTools.length - 1
  sortedTools[lastIndex].cache_control = { type: 'ephemeral' }

  return sortedTools
}
```

### 3. Multi-Turn Conversation Caching

For conversations, cache at the end of each turn:

```typescript
interface ConversationCache {
  messages: Array<{
    role: 'user' | 'assistant'
    content: Array<{
      type: string
      text?: string
      cache_control?: { type: 'ephemeral' }
    }>
  }>
}

function addCacheToLastMessage(messages: Message[]): Message[] {
  const lastMessage = messages[messages.length - 1]
  const lastContent = lastMessage.content[lastMessage.content.length - 1]

  // Add cache control to the last content block
  lastContent.cache_control = { type: 'ephemeral' }

  return messages
}
```

### 4. Context Document Caching (RAG Pattern)

For document retrieval and context injection:

```json
{
  "system": [
    {
      "type": "text",
      "text": "# Knowledge Base Context\n\n## Document 1: Workflow Patterns\n[Large document content...]\n\n## Document 2: Best Practices\n[Large document content...]",
      "cache_control": { "type": "ephemeral" }
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": "How should I structure a retry pattern?"
    }
  ]
}
```

## Token Requirements and Limits

### Minimum Cacheable Length

- **Opus 4, Sonnet models**: 1024 tokens minimum
- **Haiku models**: 2048 tokens minimum

### Maximum Cache Breakpoints

- Up to 4 cache breakpoints per request
- System automatically finds longest matching prefix

## What Can Be Cached

✅ **Cacheable with `cache_control`:**

- Tools array definitions
- System message content blocks
- User message content blocks (text, images, documents)
- Assistant message content blocks
- Tool use and tool result blocks

❌ **Cannot Be Cached:**

- Thinking blocks (but can be cached in previous assistant turns)
- Sub-content blocks (cache parent block instead)
- Empty text blocks

## Pricing Impact

### Cost Reduction Formula

```typescript
interface CachePricing {
  base_input: number // Standard rate
  cache_write: number // 1.25x base rate (5min), 2x (1hr)
  cache_hit: number // 0.1x base rate (90% discount)
  output: number // Standard rate
}

// Example: Claude Sonnet 4
const pricing: CachePricing = {
  base_input: 3.0, // $3/MTok
  cache_write: 3.75, // $3.75/MTok (5min cache)
  cache_hit: 0.3, // $0.30/MTok (90% savings)
  output: 15.0, // $15/MTok
}

function calculateSavings(tokens: number, hitRate: number): number {
  const withoutCache = tokens * pricing.base_input
  const withCache =
    tokens * pricing.cache_write + tokens * pricing.cache_hit * hitRate
  return (withoutCache - withCache) / withoutCache
}
```

## Implementation in @orchestr8

### Agent Prompt Builder with Caching

```typescript
export class CachedPromptBuilder {
  private readonly CACHE_TYPE = 'ephemeral' as const

  buildAgentPrompt(
    agent: AgentConfig,
    context: ExecutionContext,
    input: unknown,
  ): AnthropicMessage {
    return {
      model: agent.model || 'claude-sonnet-4-20250514',
      max_tokens: agent.maxTokens || 4096,

      // Cache tool definitions
      tools: this.buildToolsWithCache(agent.tools),

      // Cache system prompt
      system: [
        {
          type: 'text',
          text: this.buildSystemPrompt(agent),
          cache_control: { type: this.CACHE_TYPE },
        },
      ],

      // Messages with selective caching
      messages: this.buildMessagesWithCache(context, input),
    }
  }

  private buildMessagesWithCache(
    context: ExecutionContext,
    input: unknown,
  ): Message[] {
    const messages: Message[] = []

    // Add context as first message (if large)
    if (context.documents && context.documents.length > 0) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: this.formatDocuments(context.documents),
            cache_control: { type: this.CACHE_TYPE },
          },
        ],
      })
    }

    // Add current query
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: JSON.stringify(input),
        },
      ],
    })

    return messages
  }
}
```

### Cache Performance Monitoring

```typescript
interface CacheMetrics {
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  input_tokens: number
  output_tokens: number
}

export class CacheMonitor {
  trackCachePerformance(response: AnthropicResponse): void {
    const metrics: CacheMetrics = response.usage

    const cacheHitRate =
      metrics.cache_read_input_tokens /
      (metrics.cache_creation_input_tokens + metrics.cache_read_input_tokens)

    console.log(`Cache Performance:
      - Hit Rate: ${(cacheHitRate * 100).toFixed(1)}%
      - Tokens Saved: ${metrics.cache_read_input_tokens}
      - Cost Reduction: ${(cacheHitRate * 0.9 * 100).toFixed(1)}%
    `)
  }
}
```

## Best Practices

### 1. Structure Prompts for Optimal Caching

```typescript
// ✅ GOOD: Static content first, dynamic last
{
  tools: [...],           // Static, cacheable
  system: [...],          // Static, cacheable
  messages: [
    { /* context */ },    // Semi-static, cacheable
    { /* user query */ }  // Dynamic, not cached
  ]
}

// ❌ BAD: Dynamic content mixed throughout
{
  messages: [
    { /* user query */ },
    { /* context */ },
    { /* more queries */ }
  ]
}
```

### 2. Use Cache for Repeated Contexts

```typescript
// Cache workflow definitions that are used repeatedly
const workflowContext = {
  type: 'text',
  text: JSON.stringify(workflowDefinitions),
  cache_control: { type: 'ephemeral' },
}

// Reuse across multiple agent calls
for (const task of tasks) {
  await agent.execute({
    system: [workflowContext], // Cached after first use
    messages: [{ content: task }],
  })
}
```

### 3. Monitor Cache Effectiveness

```typescript
class CacheEffectiveness {
  private metrics: CacheMetrics[] = []

  analyze(): void {
    const avgHitRate = this.calculateAverageHitRate()
    const costSavings = this.calculateCostSavings()

    if (avgHitRate < 0.5) {
      console.warn("Low cache hit rate. Consider:
        - Increasing cache lifetime (when available)
        - Batching similar requests
        - Restructuring prompts for better prefix matching
      ")
    }
  }
}
```

## Common Pitfalls to Avoid

### 1. Caching Dynamic Content

```typescript
// ❌ WRONG: User-specific data changes frequently
{
  type: "text",
  text: `User ${userId} preferences: ${JSON.stringify(prefs)}`,
  cache_control: { type: "ephemeral" }  // Won't be reused!
}
```

### 2. Too Many Cache Breakpoints

```typescript
// ❌ WRONG: More than 4 cache breakpoints
messages.forEach((msg) => {
  msg.cache_control = { type: 'ephemeral' } // Only 4 will work
})
```

### 3. Caching Short Content

```typescript
// ❌ WRONG: Less than minimum tokens
{
  type: "text",
  text: "Hello",  // Too short to cache!
  cache_control: { type: "ephemeral" }
}
```

## Migration Guide

### From Non-Cached to Cached Prompts

```typescript
// Before: No caching
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  system: 'You are a helpful assistant',
  messages: [{ role: 'user', content: 'Hello' }],
})

// After: With caching
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  system: [
    {
      type: 'text',
      text: 'You are a helpful assistant',
      cache_control: { type: 'ephemeral' },
    },
  ],
  messages: [{ role: 'user', content: 'Hello' }],
})
```

## Conclusion

Prompt caching is essential for production @orchestr8 agents:

- **90% cost reduction** on cached content
- **Faster responses** due to pre-processed content
- **Better scalability** for high-volume operations
- **Simple implementation** with `cache_control` parameter

Always cache static content (system prompts, tools, context) and monitor cache effectiveness to optimize your caching strategy.
