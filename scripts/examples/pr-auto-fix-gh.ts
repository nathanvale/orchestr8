/*
 PR Auto-fix pipeline using orchestr8 + gh CLI

 Inputs (variables):
 - repo: string (path to local git repo)
 - branch: string (feature branch name)
 - plan: string (textual plan of changes)
 - analysisSummary?: string
 - base?: string (default: 'main')
 - testCommand?: string (default: 'pnpm -s check')
 - dryRun?: boolean | string ('true'|'false'), default: true (no side effects)

 Steps:
 - patch (code.gen): create branch, write plan file, commit, push (retry policy)
 - tests (shell.exec): run CI/tests (timeout policy)
 - pr.open (github.pr): create PR via gh CLI (circuit breaker)

 Output: prUrl from 'pr.open' step output
*/

import type { Agent, AgentRegistry, Workflow } from '@orchestr8/schema'

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { OrchestrationEngine } from '@orchestr8/core'
import { createLoggerSync } from '@orchestr8/logger'
import { ReferenceResilienceAdapter } from '@orchestr8/resilience'
import { createExecutionError, ExecutionErrorCode } from '@orchestr8/schema'

type StringMap = Record<string, string>

function getBool(input: unknown, fallback = false): boolean {
  if (typeof input === 'boolean') return input
  if (typeof input === 'string') return input.toLowerCase() === 'true'
  return fallback
}

// Minimal in-memory AgentRegistry
class InMemoryAgentRegistry implements AgentRegistry {
  private agents = new Map<string, Agent>()

  async getAgent(agentId: string): Promise<Agent> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        `Agent not found: ${agentId}`,
      )
    }
    return agent
  }

  async hasAgent(agentId: string): Promise<boolean> {
    return this.agents.has(agentId)
  }

  async registerAgent(agent: Agent): Promise<void> {
    this.agents.set(agent.id, agent)
  }
}

// Helper to spawn a process with AbortSignal support and capture output
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

// Agent: Generic shell executor
const shellExecAgent: Agent = {
  id: 'shell.exec',
  name: 'Shell Exec',
  async execute(input, _context, signal) {
    const { command, args, cwd, env } = (input || {}) as {
      command: string
      args?: Array<string>
      cwd?: string
      env?: StringMap
    }

    if (!command) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        'shell.exec requires { command }',
      )
    }

    const result = await execCommand({
      command,
      args: Array.isArray(args) ? args : [],
      cwd,
      env,
      signal,
    })

    if (result.exitCode !== 0) {
      throw createExecutionError(
        ExecutionErrorCode.UNKNOWN,
        `Command failed (${command} ${Array.isArray(args) ? args.join(' ') : ''}) with code ${result.exitCode}: ${result.stderr.trim()}`,
      )
    }

    return { ...result, output: result.stdout.trim() }
  },
}

// Agent: Apply patch via git + push
const codeGenAgent: Agent = {
  id: 'code.gen',
  name: 'Code Generation/Patch',
  async execute(input, _context, signal) {
    const {
      repo,
      branch,
      plan,
      analysisSummary,
      dryRun: dryRunRaw,
    } = (input || {}) as {
      repo: string
      branch: string
      plan: string
      analysisSummary?: string
      dryRun?: boolean | string
    }

    if (!repo || !branch || !plan) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        'code.gen requires { repo, branch, plan }',
      )
    }

    const dryRun = getBool(dryRunRaw, true)

    // Ensure repo is a git repository
    const revParse = await execCommand({
      command: 'git',
      args: ['rev-parse', '--is-inside-work-tree'],
      cwd: repo,
      signal,
    })
    if (revParse.exitCode !== 0 || !revParse.stdout.includes('true')) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        `Not a git repository: ${repo}`,
      )
    }

    // Create/checkout branch
    if (dryRun) {
      // no-op
    } else {
      const checkout = await execCommand({
        command: 'git',
        args: ['checkout', '-B', branch],
        cwd: repo,
        signal,
      })
      if (checkout.exitCode !== 0) {
        throw createExecutionError(
          ExecutionErrorCode.UNKNOWN,
          `git checkout failed: ${checkout.stderr}`,
        )
      }
    }

    // Write a plan file (simple, deterministic change for demo)
    const dir = join(repo, '.autofix')
    const file = join(dir, 'plan.md')
    const content = `# Auto-fix Plan\n\nBranch: ${branch}\n\nSummary:\n${analysisSummary || 'n/a'}\n\nPlan:\n${plan}\n`
    if (!dryRun) {
      mkdirSync(dir, { recursive: true })
      writeFileSync(file, content, { encoding: 'utf8' })
    }

    if (!dryRun) {
      const add = await execCommand({
        command: 'git',
        args: ['add', '-A'],
        cwd: repo,
        signal,
      })
      if (add.exitCode !== 0) {
        throw createExecutionError(
          ExecutionErrorCode.UNKNOWN,
          `git add failed: ${add.stderr}`,
        )
      }

      const commit = await execCommand({
        command: 'git',
        args: [
          'commit',
          '-m',
          `chore: auto-fix: apply plan to ${branch}`,
          '--allow-empty',
        ],
        cwd: repo,
        signal,
      })
      if (commit.exitCode !== 0) {
        throw createExecutionError(
          ExecutionErrorCode.UNKNOWN,
          `git commit failed: ${commit.stderr}`,
        )
      }

      const push = await execCommand({
        command: 'git',
        args: ['push', '-u', 'origin', branch],
        cwd: repo,
        signal,
      })
      if (push.exitCode !== 0) {
        throw createExecutionError(
          ExecutionErrorCode.UNKNOWN,
          `git push failed: ${push.stderr}`,
        )
      }
    }

    // Return branch and head commit
    const head = await execCommand({
      command: 'git',
      args: ['rev-parse', 'HEAD'],
      cwd: repo,
      signal,
    })
    return { branch, commit: head.stdout.trim(), dryRun }
  },
}

// Agent: Open PR using gh CLI (expects GITHUB_TOKEN in env)
const githubPrAgent: Agent = {
  id: 'github.pr',
  name: 'GitHub PR (gh)',
  async execute(input, _context, signal) {
    const {
      repo,
      branch,
      base = 'main',
      title,
      body,
      token,
      dryRun: dryRunRaw,
    } = (input || {}) as {
      repo: string
      branch: string
      base?: string
      title: string
      body?: string
      token?: string
      dryRun?: boolean | string
    }

    if (!repo || !branch || !title) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        'github.pr requires { repo, branch, title }',
      )
    }

    const dryRun = getBool(dryRunRaw, true)

    if (dryRun) {
      return { prUrl: 'dry-run://no-pr-created', branch, base }
    }

    const env: StringMap = {}
    if (token) env.GITHUB_TOKEN = token

    // Ensure gh is available
    const ghVersion = await execCommand({
      command: 'gh',
      args: ['--version'],
      cwd: repo,
      env,
      signal,
    })
    if (ghVersion.exitCode !== 0) {
      throw createExecutionError(
        ExecutionErrorCode.UNKNOWN,
        `gh CLI not available: ${ghVersion.stderr}`,
      )
    }

    // Create PR; run in repo cwd so gh detects repo/remote
    const args = [
      'pr',
      'create',
      '--head',
      branch,
      '--base',
      base,
      '--title',
      title,
      '--body',
      body || 'Automated PR created by orchestr8',
    ]

    const created = await execCommand({
      command: 'gh',
      args,
      cwd: repo,
      env,
      signal,
    })
    if (created.exitCode !== 0) {
      throw createExecutionError(
        ExecutionErrorCode.UNKNOWN,
        `gh pr create failed: ${created.stderr}`,
      )
    }

    const output = `${created.stdout}\n${created.stderr}`
    const match = output.match(/https?:\/\/\S+/)
    const prUrl = match?.[0]?.trim()
    if (!prUrl) {
      throw createExecutionError(
        ExecutionErrorCode.UNKNOWN,
        `Could not parse PR URL from gh output`,
      )
    }
    return { prUrl, branch, base }
  },
}

// Build workflow definition
function buildWorkflow(): Workflow {
  return {
    id: 'pr-auto-fix-gh',
    version: '0.1.0',
    name: 'PR Auto Fix (gh CLI)',
    description: 'Apply patch, run tests, open PR using gh with resilience',
    allowedEnvVars: ['GITHUB_TOKEN'],
    steps: [
      {
        type: 'agent',
        id: 'patch',
        name: 'Apply patch',
        agentId: 'code.gen',
        input: {
          repo: '${variables.repo}',
          branch: '${variables.branch}',
          plan: '${variables.plan}',
          analysisSummary: '${variables.analysisSummary ?? ""}',
          dryRun: '${variables.dryRun ?? "true"}',
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
        id: 'tests',
        name: 'Run tests',
        agentId: 'shell.exec',
        dependsOn: ['patch'],
        input: {
          command: 'bash',
          args: ['-lc', '${variables.testCommand ?? "pnpm -s check"}'],
          cwd: '${variables.repo}',
          env: {
            GITHUB_TOKEN: '${env.GITHUB_TOKEN ?? ""}',
          },
        },
        resilience: {
          timeout: 15 * 60 * 1000, // 15 minutes
        },
      },
      {
        type: 'agent',
        id: 'pr.open',
        name: 'Open PR',
        agentId: 'github.pr',
        dependsOn: ['tests'],
        input: {
          repo: '${variables.repo}',
          branch: '${variables.branch}',
          base: '${variables.base ?? "main"}',
          title: 'chore: auto-fix (${variables.branch})',
          body: 'Auto-fix plan: ${variables.plan}',
          token: '${env.GITHUB_TOKEN ?? ""}',
          dryRun: '${variables.dryRun ?? "true"}',
        },
        resilience: {
          circuitBreaker: {
            failureThreshold: 3,
            sampleSize: 5,
            recoveryTime: 60_000,
            halfOpenPolicy: 'single-probe',
          },
        },
      },
    ],
  }
}

// Runner
async function main(): Promise<void> {
  const logger = createLoggerSync({ level: 'info', pretty: true })
  const registry = new InMemoryAgentRegistry()
  await registry.registerAgent(shellExecAgent)
  await registry.registerAgent(codeGenAgent)
  await registry.registerAgent(githubPrAgent)

  const workflow = buildWorkflow()

  // Collect variables from env/argv for demo
  const repo = process.env.REPO || process.cwd()
  const branch =
    process.env.BRANCH || `auto-fix/${new Date().toISOString().slice(0, 10)}`
  const plan = process.env.PLAN || 'Create .autofix/plan.md with details'
  const analysisSummary = process.env.SUMMARY || ''
  const base = process.env.BASE || 'main'
  const testCommand = process.env.TEST_CMD || 'pnpm -s check'
  const dryRun = (process.env.DRY_RUN ?? 'true').toString()

  const engine = new OrchestrationEngine({
    agentRegistry: registry,
    resilienceAdapter: new ReferenceResilienceAdapter(),
    logger,
    maxConcurrency: 3,
  })

  const result = await engine.execute(workflow, {
    repo,
    branch,
    plan,
    analysisSummary,
    base,
    testCommand,
    dryRun,
  })

  const pr = result.steps['pr.open']?.output as { prUrl?: string } | undefined
  if (pr?.prUrl) {
    console.log(`PR URL: ${pr.prUrl}`)
  } else {
    console.log('PR not created')
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
