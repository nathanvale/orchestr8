import { Command } from 'commander'
import fs from 'fs/promises'
import path from 'path'

interface AgentTemplate {
  id: string
  name: string
  description: string
  type: 'local' | 'http' | 'lambda' | 'container'
  version: string
  config: Record<string, unknown>
  capabilities: string[]
}

const templates: Record<string, Partial<AgentTemplate>> = {
  local: {
    type: 'local',
    config: {
      command: 'node',
      args: ['./agents/{{name}}.js'],
      env: {},
    },
    capabilities: ['execute', 'query'],
  },
  http: {
    type: 'http',
    config: {
      endpoint: 'http://localhost:3000/agents/{{name}}',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: '30s',
    },
    capabilities: ['execute', 'query', 'stream'],
  },
  lambda: {
    type: 'lambda',
    config: {
      functionName: '{{name}}-agent',
      region: 'us-east-1',
      timeout: '30s',
    },
    capabilities: ['execute', 'query'],
  },
  container: {
    type: 'container',
    config: {
      image: 'orchestr8/{{name}}:latest',
      port: 8080,
      environment: {},
    },
    capabilities: ['execute', 'query', 'stream', 'batch'],
  },
}

export const createAgentCommand = new Command('create:agent')
  .description('Create a new agent definition')
  .argument('<name>', 'Agent name')
  .option('-d, --description <desc>', 'Agent description')
  .option(
    '-t, --template <type>',
    'Agent template (local, http, lambda, container)',
    'local',
  )
  .option('-f, --force', 'Overwrite existing agent')
  .action(async (name: string, options) => {
    const agentsDir = path.join(process.cwd(), 'agents')
    const agentPath = path.join(agentsDir, `${name}.json`)

    // Check if agent already exists
    if (!options.force) {
      try {
        await fs.access(agentPath)
        console.log(
          `⚠️  Agent ${name} already exists. Use --force to overwrite.`,
        )
        return
      } catch {
        // File doesn't exist, proceed
      }
    }

    // Create agents directory if it doesn't exist
    await fs.mkdir(agentsDir, { recursive: true })

    // Get template
    const template = templates[options.template] || templates.local
    if (!template) {
      console.error(`❌ Unknown template: ${options.template}`)
      return
    }

    // Create agent definition
    const agent: AgentTemplate = {
      id: name,
      name: name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' '),
      description: options.description || `${name} agent for orchestr8`,
      type: template.type!,
      version: '1.0.0',
      config: JSON.parse(
        JSON.stringify(template.config).replace(/{{name}}/g, name),
      ),
      capabilities: template.capabilities || [],
    }

    // Write agent file
    await fs.writeFile(agentPath, JSON.stringify(agent, null, 2), 'utf-8')

    console.log(`✅ Created agent: agents/${name}.json`)
    console.log(`\nAgent configuration:`)
    console.log(`  Type: ${agent.type}`)
    console.log(`  Capabilities: ${agent.capabilities.join(', ')}`)

    if (agent.type === 'local') {
      console.log(
        `\nNext step: Implement your agent logic in agents/${name}.js`,
      )
    } else if (agent.type === 'http') {
      console.log(
        `\nNext step: Implement your HTTP endpoint at ${(agent.config as any).endpoint}`,
      )
    }
  })
