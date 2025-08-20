/*
 Multi-LLM fan-out + Grok aggregation using orchestr8

 Flow:
 - openai.chat: call OpenAI Chat Completions
 - anthropic.messages: call Anthropic Claude Messages
 - local.chat: call local OpenAI-compatible endpoint (e.g., LM Studio / Ollama proxy)
 - aggregate.grok: send all 3 outputs to Grok (xAI) to reconcile/summarize
 - notify: echo the final result

 Env (whitelisted):
 - OPENAI_API_KEY
 - ANTHROPIC_API_KEY
 - XAI_API_KEY
 - LOCAL_OPENAI_BASE_URL (e.g., http://localhost:1234/v1)
 - LOCAL_OPENAI_API_KEY (optional)

 Inputs (variables):
 - prompt: user prompt to send to each model
 - openaiModel: default 'gpt-4o-mini'
 - claudeModel: default 'claude-3-5-sonnet-20241022'
 - localModel: model name for local endpoint (e.g., 'lmstudio-community/Meta-Llama-3-8B-Instruct')
 - temperature: default 0.2
*/

import type { Agent, AgentRegistry, Workflow } from '@orchestr8/schema'

import { OrchestrationEngine } from '@orchestr8/core'
import { createLoggerSync } from '@orchestr8/logger'
import { ReferenceResilienceAdapter } from '@orchestr8/resilience'
import { createExecutionError, ExecutionErrorCode } from '@orchestr8/schema'

// Minimal fetch signature to avoid DOM lib requirement
type Fetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean
  status: number
  statusText: string
  json: () => Promise<unknown>
  text: () => Promise<string>
}>
const fetchFn: Fetch = (() => {
  const f = (globalThis as unknown as { fetch?: unknown }).fetch
  if (typeof f === 'function') return f as Fetch
  throw new Error(
    'global fetch is not available. Use Node >= 18 or polyfill fetch.',
  )
})()

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type OpenAIChatRequest = {
  model: string
  messages: Array<ChatMessage>
  temperature?: number
  max_tokens?: number
}

type OpenAIChatChoice = {
  index: number
  message: ChatMessage
}

type OpenAIChatResponse = {
  id?: string
  choices: Array<OpenAIChatChoice>
}

type AnthropicMessageContent = { type: 'text'; text: string }

type AnthropicMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<AnthropicMessageContent>
}

type AnthropicRequest = {
  model: string
  max_tokens: number
  temperature?: number
  messages: Array<AnthropicMessage>
}

type AnthropicResponse = {
  id?: string
  content: Array<{ type: 'text'; text: string }>
}

class InMemoryAgentRegistry implements AgentRegistry {
  private agents = new Map<string, Agent>()
  async getAgent(agentId: string): Promise<Agent> {
    const a = this.agents.get(agentId)
    if (!a) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        `Agent not found: ${agentId}`,
      )
    }
    return a
  }
  async hasAgent(agentId: string): Promise<boolean> {
    return this.agents.has(agentId)
  }
  async registerAgent(agent: Agent): Promise<void> {
    this.agents.set(agent.id, agent)
  }
}

async function httpJson(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<unknown> {
  const res = await fetchFn(url, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw createExecutionError(
      ExecutionErrorCode.UNKNOWN,
      `HTTP ${res.status} ${res.statusText}: ${text.slice(0, 500)}`,
    )
  }
  return (await res.json()) as unknown
}

const openaiChat: Agent = {
  id: 'openai.chat',
  name: 'OpenAI Chat Completions',
  async execute(input) {
    const { prompt, model, temperature, token } = (input || {}) as {
      prompt: string
      model: string
      temperature?: number
      token?: string
    }
    if (!prompt) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        'openai.chat requires { prompt }',
      )
    }
    const body: OpenAIChatRequest = {
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: temperature ?? 0.2,
      max_tokens: 800,
    }
    const data = (await httpJson('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token ?? ''}`,
      },
      body: JSON.stringify(body),
    })) as OpenAIChatResponse

    const text = data.choices?.[0]?.message?.content || ''
    return { provider: 'openai', model, text }
  },
}

const anthropicMessages: Agent = {
  id: 'anthropic.messages',
  name: 'Anthropic Claude Messages',
  async execute(input) {
    const { prompt, model, temperature, token } = (input || {}) as {
      prompt: string
      model: string
      temperature?: number
      token?: string
    }
    if (!prompt) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        'anthropic.messages requires { prompt }',
      )
    }
    const body: AnthropicRequest = {
      model,
      max_tokens: 800,
      temperature: temperature ?? 0.2,
      messages: [{ role: 'user', content: prompt }],
    }
    const data = (await httpJson('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': token ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })) as AnthropicResponse

    const text = data.content?.[0]?.text || ''
    return { provider: 'anthropic', model, text }
  },
}

const localChat: Agent = {
  id: 'local.chat',
  name: 'Local OpenAI-compatible Chat',
  async execute(input) {
    const { prompt, model, temperature, baseUrl, token } = (input || {}) as {
      prompt: string
      model: string
      temperature?: number
      baseUrl: string
      token?: string
    }
    if (!prompt || !baseUrl) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        'local.chat requires { prompt, baseUrl }',
      )
    }
    const body: OpenAIChatRequest = {
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: temperature ?? 0.2,
      max_tokens: 800,
    }
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
    const data = (await httpJson(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })) as OpenAIChatResponse

    const text = data.choices?.[0]?.message?.content || ''
    return { provider: 'local', model, text }
  },
}

const grokAggregate: Agent = {
  id: 'grok.aggregate',
  name: 'Grok Summarize/Aggregate',
  async execute(input) {
    const { prompt, openai, anthropic, local, model, token } = (input ||
      {}) as {
      prompt: string
      openai: { provider: string; model: string; text: string }
      anthropic: { provider: string; model: string; text: string }
      local: { provider: string; model: string; text: string }
      model: string
      token?: string
    }
    const system =
      'You are an expert adjudicator. Read multiple model answers and produce a concise, factual synthesis. ' +
      'Return strict JSON: {"final": string, "sources": [{"provider": string, "model": string, "note": string}]}. ' +
      'Prefer grounded, overlapping points; if conflicts exist, note them briefly.'

    const body: OpenAIChatRequest = {
      model,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Task: ${prompt}\n\nOpenAI: ${openai.text}\n\nClaude: ${anthropic.text}\n\nLocal: ${local.text}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 600,
    }

    const data = (await httpJson('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token ?? ''}`,
      },
      body: JSON.stringify(body),
    })) as OpenAIChatResponse

    const raw = data.choices?.[0]?.message?.content?.trim() || ''
    let parsed: unknown = raw
    try {
      parsed = JSON.parse(raw)
    } catch {
      // If not JSON, wrap as best-effort
      parsed = { final: raw, sources: [] }
    }
    return parsed
  },
}

const notifyEcho: Agent = {
  id: 'notify.echo',
  name: 'Notify (echo)',
  async execute(input) {
    const { message } = (input || {}) as { message: string }
    console.log(message)
    return { delivered: true }
  },
}

function buildWorkflow(): Workflow {
  return {
    id: 'multi-llm-fanout-aggregate',
    version: '0.1.0',
    name: 'Multi LLM fan-out with Grok aggregation',
    description:
      'Call OpenAI, Anthropic, and a local LLM concurrently; aggregate with Grok',
    allowedEnvVars: [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'XAI_API_KEY',
      'LOCAL_OPENAI_BASE_URL',
      'LOCAL_OPENAI_API_KEY',
    ],
    steps: [
      {
        type: 'agent',
        id: 'openai',
        name: 'OpenAI chat',
        agentId: 'openai.chat',
        input: {
          prompt: '${variables.prompt}',
          model: '${variables.openaiModel ?? "gpt-4o-mini"}',
          temperature: '${variables.temperature ?? 0.2}',
          token: '${env.OPENAI_API_KEY ?? ""}',
        },
        resilience: {
          retry: {
            maxAttempts: 2,
            backoffStrategy: 'exponential',
            jitterStrategy: 'full-jitter',
            initialDelay: 500,
            maxDelay: 3000,
          },
          timeout: 30_000,
        },
      },
      {
        type: 'agent',
        id: 'claude',
        name: 'Anthropic Claude',
        agentId: 'anthropic.messages',
        input: {
          prompt: '${variables.prompt}',
          model: '${variables.claudeModel ?? "claude-3-5-sonnet-20241022"}',
          temperature: '${variables.temperature ?? 0.2}',
          token: '${env.ANTHROPIC_API_KEY ?? ""}',
        },
        resilience: {
          retry: {
            maxAttempts: 2,
            backoffStrategy: 'exponential',
            jitterStrategy: 'full-jitter',
            initialDelay: 500,
            maxDelay: 3000,
          },
          timeout: 30_000,
        },
      },
      {
        type: 'agent',
        id: 'local',
        name: 'Local Chat (OpenAI-compatible)',
        agentId: 'local.chat',
        input: {
          prompt: '${variables.prompt}',
          model: '${variables.localModel ?? "local-model"}',
          baseUrl: '${env.LOCAL_OPENAI_BASE_URL ?? "http://localhost:1234/v1"}',
          temperature: '${variables.temperature ?? 0.2}',
          token: '${env.LOCAL_OPENAI_API_KEY ?? ""}',
        },
        resilience: {
          retry: {
            maxAttempts: 2,
            backoffStrategy: 'exponential',
            jitterStrategy: 'full-jitter',
            initialDelay: 500,
            maxDelay: 3000,
          },
          timeout: 30_000,
        },
      },
      {
        type: 'agent',
        id: 'aggregate',
        name: 'Aggregate with Grok',
        agentId: 'grok.aggregate',
        dependsOn: ['openai', 'claude', 'local'],
        input: {
          prompt: '${variables.prompt}',
          openai: '${steps.openai.output}',
          anthropic: '${steps.claude.output}',
          local: '${steps.local.output}',
          model: '${variables.grokModel ?? "grok-beta"}',
          token: '${env.XAI_API_KEY ?? ""}',
        },
        resilience: { timeout: 60_000 },
      },
      {
        type: 'agent',
        id: 'notify',
        name: 'Notify summary',
        agentId: 'notify.echo',
        dependsOn: ['aggregate'],
        input: {
          message:
            'Final: ${steps.aggregate.output.final ?? steps.aggregate.output}',
        },
      },
    ],
  }
}

async function main(): Promise<void> {
  const logger = createLoggerSync({ level: 'info', pretty: true })
  const registry = new InMemoryAgentRegistry()
  await registry.registerAgent(openaiChat)
  await registry.registerAgent(anthropicMessages)
  await registry.registerAgent(localChat)
  await registry.registerAgent(grokAggregate)
  await registry.registerAgent(notifyEcho)

  const workflow = buildWorkflow()

  const prompt =
    process.env.PROMPT ||
    'Compare and summarize pros/cons of TypeScript vs Flow.'
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const claudeModel = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'
  const localModel = process.env.LOCAL_MODEL || 'local-model'
  const grokModel = process.env.GROK_MODEL || 'grok-beta'
  const temperature = Number(process.env.TEMPERATURE || '0.2')

  const engine = new OrchestrationEngine({
    agentRegistry: registry,
    resilienceAdapter: new ReferenceResilienceAdapter(),
    logger,
    maxConcurrency: 4,
  })

  const result = await engine.execute(workflow, {
    prompt,
    openaiModel,
    claudeModel,
    localModel,
    grokModel,
    temperature,
  })

  const finalOut = result.steps['aggregate']?.output as
    | { final?: string }
    | string
  const final = typeof finalOut === 'string' ? finalOut : finalOut?.final
  console.log(final ? `Aggregate: ${final}` : 'No aggregate output')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
