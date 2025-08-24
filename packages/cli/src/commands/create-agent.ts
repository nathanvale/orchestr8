import fs from 'fs/promises'
import path from 'path'

import { Command } from 'commander'

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

/**
 * Validates agent name to ensure it's safe for file system and follows naming conventions
 * @param name The agent name to validate
 * @returns The validated and trimmed agent name
 * @throws Error if the name is invalid
 */
function validateAgentName(name: string): string {
  // Check for empty or whitespace-only names
  if (!name || name.trim().length === 0) {
    throw new Error('Agent name cannot be empty')
  }

  const trimmedName = name.trim()

  // SECURITY: Prevent path traversal attacks
  if (trimmedName.includes('..')) {
    throw new Error(
      'Agent name cannot contain ".." (directory traversal attempt)',
    )
  }

  if (trimmedName.includes('/') || trimmedName.includes('\\')) {
    throw new Error('Agent name cannot contain path separators')
  }

  if (path.isAbsolute(trimmedName)) {
    throw new Error('Agent name cannot be an absolute path')
  }

  // Additional check: ensure resolved path stays in project
  const agentsDir = path.join(process.cwd(), 'agents')
  const resolvedPath = path.resolve(agentsDir, `${trimmedName}.json`)

  if (!resolvedPath.startsWith(path.resolve(agentsDir))) {
    throw new Error('Agent name would create file outside agents directory')
  }

  // Check length
  if (trimmedName.length < 2 || trimmedName.length > 64) {
    throw new Error('Agent name must be between 2 and 64 characters')
  }

  // Check for valid characters (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
    throw new Error(
      'Agent name can only contain letters, numbers, hyphens, and underscores',
    )
  }

  // Check that it doesn't start or end with special characters
  if (/^[-_]|[-_]$/.test(trimmedName)) {
    throw new Error(
      'Agent name cannot start or end with hyphens or underscores',
    )
  }

  return trimmedName
}

export const createAgentCommand = new Command('create:agent')
  .description('Create a new agent definition')
  .argument('<name>', 'Agent name (alphanumeric, hyphens, underscores only)')
  .option('-d, --description <desc>', 'Agent description')
  .option(
    '-t, --template <type>',
    'Agent template (local, http, lambda, container)',
    'local',
  )
  .option('-f, --force', 'Overwrite existing agent')
  .option('-v, --verbose', 'Verbose output')
  .action(async (name: string, options) => {
    try {
      // Validate agent name
      const validatedName = validateAgentName(name)

      // Validate template
      const availableTemplates = Object.keys(templates)
      if (!availableTemplates.includes(options.template)) {
        console.error(`❌ Unknown template: ${options.template}`)
        console.error(`Available templates: ${availableTemplates.join(', ')}`)
        process.exitCode = 1
        return
      }

      const agentsDir = path.join(process.cwd(), 'agents')
      const agentPath = path.join(agentsDir, `${validatedName}.json`)

      // SECURITY: Atomic file creation to prevent TOCTOU race conditions

      // Create agents directory if it doesn't exist
      try {
        await fs.mkdir(agentsDir, { recursive: true })
      } catch (error) {
        const code = (error as { code?: string }).code
        if (code === 'EACCES') {
          throw new Error('Permission denied: Cannot create agents directory')
        }
        throw error
      }

      // Get template (we already validated it exists above)
      const template = templates[options.template]!

      // Validate description if provided
      if (options.description && options.description.length > 500) {
        throw new Error('Description must be less than 500 characters')
      }

      // Create agent definition
      const agent: AgentTemplate = {
        id: validatedName,
        name:
          validatedName.charAt(0).toUpperCase() +
          validatedName.slice(1).replace(/-/g, ' '),
        description:
          options.description || `${validatedName} agent for orchestr8`,
        type: template.type!,
        version: '1.0.0',
        config: JSON.parse(
          JSON.stringify(template.config).replace(/{{name}}/g, validatedName),
        ),
        capabilities: template.capabilities || [],
      }

      // SECURITY: Atomic file operations to prevent TOCTOU race conditions
      if (!options.force) {
        try {
          // Atomic operation: write only if file doesn't exist
          await fs.writeFile(agentPath, JSON.stringify(agent, null, 2), {
            flag: 'wx', // Write, fail if exists
            encoding: 'utf-8',
          })
        } catch (error) {
          const code = (error as { code?: string }).code
          if (code === 'EEXIST') {
            console.log(
              `⚠️  Agent ${validatedName} already exists. Use --force to overwrite.`,
            )
            return
          }
          if (code === 'EACCES') {
            throw new Error(`Permission denied: Cannot write to ${agentPath}`)
          } else if (code === 'ENOSPC') {
            throw new Error('No space left on device')
          }
          throw error
        }
      } else {
        // Force overwrite
        try {
          await fs.writeFile(agentPath, JSON.stringify(agent, null, 2), 'utf-8')
        } catch (error) {
          const code = (error as { code?: string }).code
          if (code === 'EACCES') {
            throw new Error(`Permission denied: Cannot write to ${agentPath}`)
          } else if (code === 'ENOSPC') {
            throw new Error('No space left on device')
          }
          throw error
        }
      }

      console.log(`✅ Created agent: agents/${validatedName}.json`)
      console.log(`\nAgent configuration:`)
      console.log(`  ID: ${agent.id}`)
      console.log(`  Name: ${agent.name}`)
      console.log(`  Type: ${agent.type}`)
      console.log(`  Capabilities: ${agent.capabilities.join(', ')}`)

      if (options.verbose) {
        console.log(`  Description: ${agent.description}`)
        console.log(`  Version: ${agent.version}`)
        console.log(`  Config: ${JSON.stringify(agent.config, null, 2)}`)
      }

      // Provide next steps based on template type
      if (agent.type === 'local') {
        console.log(
          `\nNext step: Implement your agent logic in agents/${validatedName}.js`,
        )
      } else if (agent.type === 'http') {
        console.log(
          `\nNext step: Implement your HTTP endpoint at ${(agent.config as Record<string, unknown>).endpoint}`,
        )
      } else if (agent.type === 'lambda') {
        console.log(
          `\nNext step: Deploy your Lambda function with name: ${(agent.config as Record<string, unknown>).functionName}`,
        )
      } else if (agent.type === 'container') {
        console.log(
          `\nNext step: Build and publish your container image: ${(agent.config as Record<string, unknown>).image}`,
        )
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(`❌ Failed to create agent: ${errorMessage}`)

      if (options.verbose && error instanceof Error && error.stack) {
        console.error(error.stack)
      }

      process.exitCode = 1
    }
  })
