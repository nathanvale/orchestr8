import { Command } from 'commander'
import fs from 'fs/promises'
import path from 'path'

const defaultConfig = {
  version: '1.0.0',
  workflows: {
    directory: './workflows',
    watch: false,
  },
  agents: {
    directory: './agents',
    registry: 'local',
  },
  resilience: {
    defaultRetryPolicy: {
      maxAttempts: 3,
      delay: '1s',
      backoff: 'exponential',
    },
    defaultTimeoutPolicy: {
      duration: '30s',
    },
  },
  logging: {
    level: 'info',
    format: 'json',
  },
  server: {
    port: 8088,
    host: '127.0.0.1',
  },
}

export const initCommand = new Command('init')
  .description('Initialize a new Orchestr8 project')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (options) => {
    const configPath = path.join(process.cwd(), 'orchestr8.config.json')

    try {
      await fs.access(configPath)
      if (!options.force) {
        console.log(
          '⚠️  orchestr8.config.json already exists. Use --force to overwrite.',
        )
        return
      }
    } catch {
      // File doesn't exist, proceed with creation
    }

    const configContent = JSON.stringify(defaultConfig, null, 2)
    await fs.writeFile(configPath, configContent, 'utf-8')

    if (options.force) {
      console.log('✅ Overwritten orchestr8.config.json')
    } else {
      console.log('✅ Created orchestr8.config.json')
    }

    console.log('\nNext steps:')
    console.log(
      '  1. Create your first workflow: o8 create:workflow my-workflow',
    )
    console.log('  2. Create an agent: o8 create:agent my-agent')
    console.log('  3. Run your workflow: o8 run ./workflows/my-workflow.json')
  })
