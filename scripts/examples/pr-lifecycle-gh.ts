/*
 PR lifecycle example (GitHub) using orchestr8

 Flow:
 - patch: create/update a branch and commit a trivial change (optional; skip with DRY_RUN=true)
 - pr.open: open a PR via gh CLI
 - wait.checks: poll PR checks until complete (success/failure)
 - gate.policy: evaluate gating rules (approvals, required contexts, changed files)
 - label: add labels reflecting outcome
 - merge or comment: auto-merge on pass; else comment with reasons
 - notify: echo a summary

 Env (whitelisted):
 - GITHUB_TOKEN (optional if gh auth is already set)

 Inputs (variables):
 - repo: string (path to repo; default cwd)
 - branch: string (feature branch name; default auto)
 - base: string (base branch; default main)
 - title: string (PR title)
 - body: string (PR body)
 - requiredContexts: string[] (status check contexts that must be success)
 - minApprovals: number (default 1)
 - maxChangedFiles: number (default 200)
 - mergeMethod: 'merge'|'squash'|'rebase' (default 'squash')
 - dryRun: 'true'|'false' (default 'true')
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

// Minimal shapes for gh JSON outputs
type GhStatusItem = {
  context?: string
  name?: string
  state?: string
  status?: string
  conclusion?: string
}

type GhReview = { state?: string }
type GhFile = { path?: string }

type GhPrView = {
  number: number
  url: string
  statusCheckRollup?: Array<GhStatusItem>
  reviews?: Array<GhReview>
  files?: Array<GhFile>
}

type WaitChecksOk = {
  number: number
  url: string
  success: boolean
  failedContexts: Array<string>
  contexts: Array<{ context?: string; state?: string; conclusion?: string }>
  reviews?: Array<GhReview>
  files?: Array<GhFile>
}
type WaitChecksResult = WaitChecksOk | { timeout: true }

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

// JSON-aware shell exec
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
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        return JSON.parse(text)
      } catch {
        // fall through
      }
    }
    return text
  },
}

// Create a trivial change and branch; push
const codeGen: Agent = {
  id: 'code.gen',
  name: 'Generate change (branch + commit + push)',
  async execute(input) {
    const { repo, branch, base, dryRun } = (input || {}) as {
      repo: string
      branch: string
      base: string
      dryRun?: string
    }
    if (!repo || !branch || !base) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        'code.gen requires { repo, branch, base }',
      )
    }
    const run = async (cmd: string) =>
      await execCommand({ command: 'bash', args: ['-lc', cmd], cwd: repo })

    await run('git fetch origin')
    await run(`git checkout -B ${branch} origin/${base}`)

    const autofixDir = join(repo, '.autofix')
    mkdirSync(autofixDir, { recursive: true })
    const stamp = new Date().toISOString()
    writeFileSync(
      join(autofixDir, 'touch.txt'),
      `Automated change at ${stamp}\n`,
      'utf8',
    )
    await run('git add .autofix/touch.txt')
    await run("git commit -m 'chore: automated change [skip ci]' || true")

    if ((dryRun || 'true') !== 'true') {
      await run(`git push -u origin ${branch}`)
    }

    return { branch, base, pushed: (dryRun || 'true') !== 'true' }
  },
}

// Open PR via gh
const githubPrCreate: Agent = {
  id: 'github.pr.create',
  name: 'GitHub PR Create',
  async execute(input) {
    const { repo, branch, base, title, body, token } = (input || {}) as {
      repo: string
      branch: string
      base: string
      title: string
      body?: string
      token?: string
    }
    const env: StringMap = {}
    if (token) env.GITHUB_TOKEN = token

    const res = await execCommand({
      command: 'bash',
      args: [
        '-lc',
        `gh pr create --title ${JSON.stringify(title)} ${
          body ? `--body ${JSON.stringify(body)}` : ''
        } --base ${base} --head ${branch} --repo $(git -C ${repo} config --get remote.origin.url) --json number,url,headRefName,baseRefName`,
      ],
      cwd: repo,
      env,
    })
    if (res.exitCode !== 0) {
      throw createExecutionError(
        ExecutionErrorCode.UNKNOWN,
        `gh pr create failed: ${res.stderr.trim()}`,
      )
    }
    let out: {
      number: number
      url: string
      headRefName: string
      baseRefName: string
    }
    try {
      out = JSON.parse(res.stdout)
    } catch {
      throw createExecutionError(
        ExecutionErrorCode.UNKNOWN,
        `Unexpected gh pr create output: ${res.stdout.slice(0, 200)}`,
      )
    }
    return out
  },
}

// Wait for checks to complete
const githubPrWaitChecks: Agent = {
  id: 'github.pr.waitChecks',
  name: 'GitHub PR Wait Checks',
  async execute(input) {
    const { repo, number, intervalSec, maxMinutes, token } = (input || {}) as {
      repo: string
      number: number
      intervalSec?: number
      maxMinutes?: number
      token?: string
    }
    const interval = Math.max(5, intervalSec ?? 10)
    const maxMs = Math.max(1, maxMinutes ?? 60) * 60 * 1000
    const started = Date.now()
    const env: StringMap = {}
    if (token) env.GITHUB_TOKEN = token

    const view = async (): Promise<GhPrView> => {
      const res = await execCommand({
        command: 'bash',
        args: [
          '-lc',
          `gh pr view ${number} --json number,url,mergeStateStatus,statusCheckRollup,reviews,files --repo $(git -C ${repo} config --get remote.origin.url)`.replace(
            /\n/g,
            ' ',
          ),
        ],
        cwd: repo,
        env,
      })
      if (res.exitCode !== 0) {
        throw createExecutionError(
          ExecutionErrorCode.UNKNOWN,
          `gh pr view failed: ${res.stderr.trim()}`,
        )
      }
      return JSON.parse(res.stdout) as GhPrView
    }

    while (Date.now() - started < maxMs) {
      const data = await view()
      const contexts: Array<GhStatusItem> = Array.isArray(
        data.statusCheckRollup,
      )
        ? data.statusCheckRollup!
        : []
      const pending = contexts.some((c) =>
        ['PENDING', 'QUEUED', 'IN_PROGRESS', 'EXPECTED'].includes(
          (c.state || c.status || '').toUpperCase(),
        ),
      )
      const failed = contexts.filter((c) =>
        ['FAILURE', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(
          (c.conclusion || c.state || '').toUpperCase(),
        ),
      )
      const success =
        contexts.length > 0 &&
        failed.length === 0 &&
        contexts.every((c) =>
          ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(
            (c.conclusion || c.state || '').toUpperCase(),
          ),
        )

      if (!pending) {
        return {
          number: data.number,
          url: data.url,
          success,
          failedContexts: failed.map((f) => f.context || f.name || 'unknown'),
          contexts: contexts.map((c) => ({
            context: c.context || c.name,
            state: c.state || c.status,
            conclusion: c.conclusion,
          })),
          reviews: data.reviews,
          files: data.files,
        } as WaitChecksOk
      }

      await new Promise((r) => setTimeout(r, interval * 1000))
    }

    return { timeout: true } as const
  },
}

// Evaluate simple gating rules using gh data
const policyEvaluate: Agent = {
  id: 'policy.evaluate',
  name: 'Policy Evaluate',
  async execute(input) {
    const { waitResult, requiredContexts, minApprovals, maxChangedFiles } =
      (input || {}) as {
        waitResult: WaitChecksResult
        requiredContexts?: Array<string>
        minApprovals?: number
        maxChangedFiles?: number
      }

    const required = requiredContexts || []
    const minAppr = Math.max(0, minApprovals ?? 1)
    const maxFiles = Math.max(1, maxChangedFiles ?? 200)

    const reasons: Array<string> = []

    const contexts:
      | Array<{ context?: string; state?: string; conclusion?: string }>
      | [] =
      'contexts' in waitResult && Array.isArray(waitResult.contexts)
        ? waitResult.contexts
        : []
    for (const rc of required) {
      const found = contexts.find(
        (c) => (c.context || '').toLowerCase() === rc.toLowerCase(),
      )
      if (!found) reasons.push(`missing required check: ${rc}`)
      else {
        const ok = ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(
          (found.conclusion || found.state || '').toUpperCase(),
        )
        if (!ok) reasons.push(`check failed: ${rc}`)
      }
    }

    const approvals =
      'reviews' in waitResult && Array.isArray(waitResult.reviews)
        ? waitResult.reviews.filter((r) => r.state === 'APPROVED').length
        : 0
    if (approvals < minAppr) reasons.push(`approvals ${approvals} < ${minAppr}`)

    const changedFiles =
      'files' in waitResult && Array.isArray(waitResult.files)
        ? waitResult.files.length
        : 0
    if (changedFiles > maxFiles)
      reasons.push(`changed files ${changedFiles} > ${maxFiles}`)

    const pass =
      reasons.length === 0 &&
      'success' in waitResult &&
      (waitResult as WaitChecksOk).success === true
    return { pass, reasons, approvals, changedFiles }
  },
}

const githubPrLabel: Agent = {
  id: 'github.pr.label',
  name: 'GitHub PR Label',
  async execute(input) {
    const { repo, number, labels, token } = (input || {}) as {
      repo: string
      number: number
      labels: Array<string>
      token?: string
    }
    const env: StringMap = {}
    if (token) env.GITHUB_TOKEN = token
    const args = labels.map((l) => `--add-label ${JSON.stringify(l)}`).join(' ')
    const res = await execCommand({
      command: 'bash',
      args: [
        '-lc',
        `gh pr edit ${number} ${args} --repo $(git -C ${repo} config --get remote.origin.url)`,
      ],
      cwd: repo,
      env,
    })
    if (res.exitCode !== 0) {
      throw createExecutionError(
        ExecutionErrorCode.UNKNOWN,
        `gh pr edit (label) failed: ${res.stderr}`,
      )
    }
    return { labeled: labels }
  },
}

const githubPrMerge: Agent = {
  id: 'github.pr.merge',
  name: 'GitHub PR Merge',
  async execute(input) {
    const { repo, number, method, token } = (input || {}) as {
      repo: string
      number: number
      method?: 'merge' | 'squash' | 'rebase'
      token?: string
    }
    const env: StringMap = {}
    if (token) env.GITHUB_TOKEN = token
    const flag =
      method === 'merge'
        ? '--merge'
        : method === 'rebase'
          ? '--rebase'
          : '--squash'
    const res = await execCommand({
      command: 'bash',
      args: [
        '-lc',
        `gh pr merge ${number} ${flag} --auto --delete-branch --repo $(git -C ${repo} config --get remote.origin.url)`,
      ],
      cwd: repo,
      env,
    })
    if (res.exitCode !== 0) {
      throw createExecutionError(
        ExecutionErrorCode.UNKNOWN,
        `gh pr merge failed: ${res.stderr}`,
      )
    }
    return { merged: true }
  },
}

const githubPrComment: Agent = {
  id: 'github.pr.comment',
  name: 'GitHub PR Comment',
  async execute(input) {
    const { repo, number, body, token } = (input || {}) as {
      repo: string
      number: number
      body: string
      token?: string
    }
    const env: StringMap = {}
    if (token) env.GITHUB_TOKEN = token
    const res = await execCommand({
      command: 'bash',
      args: [
        '-lc',
        `gh pr comment ${number} -b ${JSON.stringify(body)} --repo $(git -C ${repo} config --get remote.origin.url)`,
      ],
      cwd: repo,
      env,
    })
    if (res.exitCode !== 0) {
      throw createExecutionError(
        ExecutionErrorCode.UNKNOWN,
        `gh pr comment failed: ${res.stderr}`,
      )
    }
    return { commented: true }
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
    id: 'pr-lifecycle-gh',
    version: '0.1.0',
    name: 'PR Lifecycle (GitHub)',
    description: 'Open PR, wait for checks, gate, merge/comment, and notify',
    allowedEnvVars: ['GITHUB_TOKEN'],
    steps: [
      {
        type: 'agent',
        id: 'patch',
        name: 'Generate change',
        agentId: 'code.gen',
        input: {
          repo: '${variables.repo}',
          branch: '${variables.branch}',
          base: '${variables.base ?? "main"}',
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
        id: 'pr.open',
        name: 'Open PR',
        agentId: 'github.pr.create',
        dependsOn: ['patch'],
        input: {
          repo: '${variables.repo}',
          branch: '${variables.branch}',
          base: '${variables.base ?? "main"}',
          title: '${variables.title}',
          body: '${variables.body ?? "Automated PR"}',
          token: '${env.GITHUB_TOKEN ?? ""}',
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
        id: 'wait.checks',
        name: 'Wait for checks',
        agentId: 'github.pr.waitChecks',
        dependsOn: ['pr.open'],
        input: {
          repo: '${variables.repo}',
          number: '${steps.pr.open.output.number}',
          intervalSec: '${variables.intervalSec ?? 15}',
          maxMinutes: '${variables.maxMinutes ?? 60}',
          token: '${env.GITHUB_TOKEN ?? ""}',
        },
        resilience: { timeout: 60 * 60 * 1000 },
      },
      {
        type: 'agent',
        id: 'gate.policy',
        name: 'Evaluate policy',
        agentId: 'policy.evaluate',
        dependsOn: ['wait.checks'],
        input: {
          waitResult: '${steps.wait.checks.output}',
          requiredContexts: '${variables.requiredContexts ?? []}',
          minApprovals: '${variables.minApprovals ?? 1}',
          maxChangedFiles: '${variables.maxChangedFiles ?? 200}',
        },
      },
      {
        type: 'agent',
        id: 'label',
        name: 'Label PR',
        agentId: 'github.pr.label',
        dependsOn: ['gate.policy'],
        input: {
          repo: '${variables.repo}',
          number: '${steps.pr.open.output.number}',
          labels:
            '${steps.gate.policy.output.pass ? ["automerge-ready"] : ["needs-attention"]}',
          token: '${env.GITHUB_TOKEN ?? ""}',
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
        id: 'merge',
        name: 'Merge PR',
        agentId: 'github.pr.merge',
        dependsOn: ['label'],
        if: 'steps.gate.policy.output.pass == true',
        input: {
          repo: '${variables.repo}',
          number: '${steps.pr.open.output.number}',
          method: '${variables.mergeMethod ?? "squash"}',
          token: '${env.GITHUB_TOKEN ?? ""}',
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
        id: 'comment',
        name: 'Comment with reasons',
        agentId: 'github.pr.comment',
        dependsOn: ['label'],
        unless: 'steps.gate.policy.output.pass == true',
        input: {
          repo: '${variables.repo}',
          number: '${steps.pr.open.output.number}',
          body: 'Automated gate failed. Reasons: ${steps.gate.policy.output.reasons}',
          token: '${env.GITHUB_TOKEN ?? ""}',
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
        id: 'notify',
        name: 'Notify summary',
        agentId: 'notify.echo',
        dependsOn: ['merge', 'comment'],
        input: {
          message:
            'PR ${steps.pr.open.output.number} ${steps.gate.policy.output.pass ? "merged" : "not merged"}. URL: ${steps.pr.open.output.url}',
        },
      },
    ],
  }
}

async function main(): Promise<void> {
  const logger = createLoggerSync({ level: 'info', pretty: true })
  const registry = new InMemoryAgentRegistry()
  await registry.registerAgent(shellExecJson)
  await registry.registerAgent(codeGen)
  await registry.registerAgent(githubPrCreate)
  await registry.registerAgent(githubPrWaitChecks)
  await registry.registerAgent(policyEvaluate)
  await registry.registerAgent(githubPrLabel)
  await registry.registerAgent(githubPrMerge)
  await registry.registerAgent(githubPrComment)
  await registry.registerAgent(notifyEcho)

  const workflow = buildWorkflow()

  const repo = process.env.REPO || process.cwd()
  const base = process.env.BASE || 'main'
  const branch =
    process.env.BRANCH || `auto-pr/${new Date().toISOString().slice(0, 10)}`
  const title = process.env.TITLE || 'Automated PR'
  const body = process.env.BODY || 'Automated change for demonstration.'

  const requiredContexts = process.env.REQUIRED_CONTEXTS
    ? process.env.REQUIRED_CONTEXTS.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  const minApprovals = Number(process.env.MIN_APPROVALS || '1')
  const maxChangedFiles = Number(process.env.MAX_CHANGED_FILES || '200')
  const mergeMethod = (process.env.MERGE_METHOD || 'squash') as
    | 'merge'
    | 'squash'
    | 'rebase'
  const dryRun = process.env.DRY_RUN || 'true'

  const engine = new OrchestrationEngine({
    agentRegistry: registry,
    resilienceAdapter: new ReferenceResilienceAdapter(),
    logger,
    maxConcurrency: 3,
  })

  const result = await engine.execute(workflow, {
    repo,
    base,
    branch,
    title,
    body,
    requiredContexts,
    minApprovals,
    maxChangedFiles,
    mergeMethod,
    dryRun,
  })

  const merged = result.steps['merge']?.status === 'completed'
  console.log(merged ? 'PR merged' : 'PR not merged')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
