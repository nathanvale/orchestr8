#!/usr/bin/env node
import { Command } from 'commander'

const program = new Command()

program
  .name('orchestr8')
  .description('Agent orchestration CLI')
  .version('0.1.0')

program
  .command('init')
  .description('Initialize a new orchestr8 project')
  .action(() => {
    console.log('Initializing orchestr8 project...')
  })

program
  .command('create')
  .description('Create a new agent')
  .argument('<name>', 'Agent name')
  .action((name) => {
    console.log(`Creating agent: ${name}`)
  })

program
  .command('run')
  .description('Run a workflow')
  .argument('<workflow>', 'Workflow file path')
  .action((workflow) => {
    console.log(`Running workflow: ${workflow}`)
  })

program.parse()
