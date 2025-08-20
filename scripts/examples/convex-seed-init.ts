/*
 Convex Data Seed/Init workflow using orchestr8

 Steps:
 - seed: run a Node/TS seed script that calls Convex actions (idempotent, continue-on-error inside script)
 - verify: run a verification script that prints JSON { ok: boolean, counts: {...}, message?: string }
 - notify: echo a summary notification based on verify result

 Resilience:
 - seed: retry (3x exponential, full-jitter)
 - verify: timeout (10m)
 - notify: none (best-effort)

 Inputs (variables):
 - repo: string (path to project repository)
 - seedScript: string (path to seed script, e.g., scripts/seed.ts)
 - seedArgs?: string (optional args passed to seed script)
 - verifyScript: string (path to verification script, e.g., scripts/verify.ts)
 - verifyArgs?: string (optional args)
 - noteChannel?: string (for future integrations)

 Env (whitelisted):
 - CONVEX_DEPLOY_KEY, CONVEX_URL, CONVEX_DEPLOYMENT, CONVEX_ADMIN_KEY (if your scripts require them)
*/

import type { Agent, AgentRegistry, Workflow } from '@orchestr8/schema'

import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

import { OrchestrationEngine } from '@orchestr8/core'
import { createLoggerSync } from '@orchestr8/logger'
import { ReferenceResilienceAdapter } from '@orchestr8/resilience'
import { createExecutionError, ExecutionErrorCode } from '@orchestr8/schema'

type StringMap = Record<string, string>

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

async function execCommand(options: {
  command: string
  args: Array<string>
  cwd?: string
  env?: StringMap
  signal?: AbortSignal
}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { command, args, cwd, env, signal } = options
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...(env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
      signal,
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => (stdout += d.toString()))
    child.stderr?.on('data', (d) => (stderr += d.toString()))
    child.on('error', (err) => {
      reject(
        createExecutionError(
          ExecutionErrorCode.UNKNOWN,
          `Failed to start '${command}': ${err instanceof Error ? err.message : String(err)}`,
        ),
      )
    })
    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? -1 })
    })
  })
}

// Shell exec that tries to JSON.parse stdout for structured outputs
const shellExecJson: Agent = {
  id: 'shell.exec.json',
  name: 'Shell Exec (JSON-aware)',
  async execute(input, _ctx, signal) {
    const { command, args, cwd, env } = (input || {}) as {
      command: string
      args?: Array<string>
      cwd?: string
      env?: StringMap
    }
    if (!command) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        'shell.exec.json requires { command }',
      )
    }
    const res = await execCommand({
      command,
      args: Array.isArray(args) ? args : [],
      cwd,
      env,
      signal,
    })
    if (res.exitCode !== 0) {
      throw createExecutionError(
        ExecutionErrorCode.UNKNOWN,
        `Command failed (${command} ${(args || []).join(' ')}) code ${res.exitCode}: ${res.stderr.trim()}`,
      )
    }
    const text = res.stdout.trim()
    let parsed: unknown = text
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        parsed = JSON.parse(text)
      } catch {
        // leave as string
      }
    }
    return { ...res, output: parsed }
  },
}

// Simple notifier that echoes a summary
const notifyEcho: Agent = {
  id: 'notify.echo',
  name: 'Notify (echo)',
  async execute(input) {
    const { message, dir } = (input || {}) as {
      message: string
      dir?: string
    }
    if (dir) mkdirSync(dir, { recursive: true })
    // print to stdout for now
    console.log(message)
    return { delivered: true, message }
  },
}

function buildWorkflow(): Workflow {
  return {
    id: 'convex-seed-init',
    version: '0.1.0',
    name: 'Convex Seed/Init',
    description: 'Seed data via Convex actions, verify counts, and notify',
    allowedEnvVars: [
      'CONVEX_DEPLOY_KEY',
      'CONVEX_URL',
      'CONVEX_DEPLOYMENT',
      'CONVEX_ADMIN_KEY',
    ],
    steps: [
      {
        type: 'agent',
        id: 'seed',
        name: 'Seed data',
        agentId: 'shell.exec.json',
        input: {
          command: 'bash',
          args: [
            '-lc',
            'pnpm -s tsx ${variables.seedScript} ${variables.seedArgs ?? ""}',
          ],
          cwd: '${variables.repo}',
          env: {
            CONVEX_DEPLOY_KEY: '${env.CONVEX_DEPLOY_KEY ?? ""}',
            CONVEX_URL: '${env.CONVEX_URL ?? ""}',
            CONVEX_DEPLOYMENT: '${env.CONVEX_DEPLOYMENT ?? ""}',
            CONVEX_ADMIN_KEY: '${env.CONVEX_ADMIN_KEY ?? ""}',
          },
        },
        resilience: {
          retry: {
            maxAttempts: 3,
            backoffStrategy: 'exponential',
            jitterStrategy: 'full-jitter',
            initialDelay: 1000,
            maxDelay: 8000,
          },
        },
      },
      {
        type: 'agent',
        id: 'verify',
        name: 'Verify counts',
        agentId: 'shell.exec.json',
        dependsOn: ['seed'],
        input: {
          command: 'bash',
          args: [
            '-lc',
            'pnpm -s tsx ${variables.verifyScript} ${variables.verifyArgs ?? ""}',
          ],
          cwd: '${variables.repo}',
          env: {
            CONVEX_DEPLOY_KEY: '${env.CONVEX_DEPLOY_KEY ?? ""}',
            CONVEX_URL: '${env.CONVEX_URL ?? ""}',
            CONVEX_DEPLOYMENT: '${env.CONVEX_DEPLOYMENT ?? ""}',
            CONVEX_ADMIN_KEY: '${env.CONVEX_ADMIN_KEY ?? ""}',
          },
        },
        resilience: {
          timeout: 10 * 60 * 1000,
        },
      },
      {
        type: 'agent',
        id: 'notify',
        name: 'Notify summary',
        agentId: 'notify.echo',
        dependsOn: ['verify'],
        // Only run if verify says ok
        if: 'steps.verify.output.ok == `true` || steps.verify.output.ok == true',
        input: {
          message:
            'Seed OK. Counts: ${steps.verify.output.counts ?? steps.verify.output}',
        },
      },
      {
        type: 'agent',
        id: 'notify-fail',
        name: 'Notify failure',
        agentId: 'notify.echo',
        dependsOn: ['verify'],
        // Run on failure case (unless ok)
        unless:
          'steps.verify.output.ok == `true` || steps.verify.output.ok == true',
        input: {
          message:
            'Seed/Verify issue. Details: ${steps.verify.output.message ?? steps.verify.output}',
        },
      },
    ],
  }
}

async function main(): Promise<void> {
  const logger = createLoggerSync({ level: 'info', pretty: true })
  const registry = new InMemoryAgentRegistry()
  await registry.registerAgent(shellExecJson)
  await registry.registerAgent(notifyEcho)

  const workflow = buildWorkflow()

  const repo = process.env.REPO || process.cwd()
  const seedScript = process.env.SEED_SCRIPT || 'scripts/seed.ts'
  const seedArgs = process.env.SEED_ARGS || ''
  const verifyScript = process.env.VERIFY_SCRIPT || 'scripts/verify.ts'
  const verifyArgs = process.env.VERIFY_ARGS || ''

  const engine = new OrchestrationEngine({
    agentRegistry: registry,
    resilienceAdapter: new ReferenceResilienceAdapter(),
    logger,
    maxConcurrency: 3,
  })

  const result = await engine.execute(workflow, {
    repo,
    seedScript,
    seedArgs,
    verifyScript,
    verifyArgs,
  })

  type VerifyOutput = {
    ok?: boolean
    counts?: Record<string, number>
    message?: string
  }
  const ok = (result.steps['verify']?.output as VerifyOutput | undefined)?.ok
  console.log(ok ? 'Seed/Verify: OK' : 'Seed/Verify: FAILED')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
