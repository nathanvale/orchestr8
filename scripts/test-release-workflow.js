#!/usr/bin/env node

/**
 * Test Release Workflow
 *
 * This script simulates the GitHub Actions release workflow locally
 * to validate that all steps work correctly before pushing to main.
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function runCommand(command, description) {
  log(`\n${colors.blue}${colors.bold}${description}${colors.reset}`)
  log(`Running: ${colors.yellow}${command}${colors.reset}`)

  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: process.cwd(),
    })
    log(`${colors.green}✓ Success${colors.reset}`)
    if (output.trim()) {
      console.log(output.trim())
    }
    return true
  } catch (error) {
    log(`${colors.red}✗ Failed${colors.reset}`)
    console.error(error.stdout?.toString() || error.message)
    return false
  }
}

function checkPrerequisites() {
  log(`${colors.bold}Checking Prerequisites...${colors.reset}`)

  // Check if we're in the right directory
  const packageJsonPath = join(process.cwd(), 'package.json')
  if (!existsSync(packageJsonPath)) {
    log(
      `${colors.red}Error: package.json not found. Run this from the repository root.${colors.reset}`,
    )
    process.exit(1)
  }

  // Check if changeset config exists
  const changesetConfigPath = join(process.cwd(), '.changeset', 'config.json')
  if (!existsSync(changesetConfigPath)) {
    log(`${colors.red}Error: Changeset configuration not found.${colors.reset}`)
    process.exit(1)
  }

  log(`${colors.green}✓ Prerequisites check passed${colors.reset}`)
}

function simulateWorkflowSteps() {
  log(
    `\n${colors.bold}Simulating GitHub Actions Release Workflow...${colors.reset}`,
  )

  const steps = [
    {
      name: 'Install dependencies',
      command: 'pnpm install --frozen-lockfile',
    },
    {
      name: 'Build packages',
      command: 'pnpm build',
    },
    {
      name: 'Run tests',
      command: 'pnpm test:ci',
    },
    {
      name: 'Check changeset status',
      command: 'pnpm changeset status',
    },
    {
      name: 'Test dry-run publishing',
      command: 'pnpm changeset publish --dry-run',
    },
  ]

  let allPassed = true

  for (const step of steps) {
    const success = runCommand(step.command, step.name)
    if (!success) {
      allPassed = false
      break
    }
  }

  return allPassed
}

function testChangesetCommands() {
  log(`\n${colors.bold}Testing Changeset Commands...${colors.reset}`)

  const changesetTests = [
    {
      name: 'List changeset files',
      command: 'find .changeset -name "*.md" -not -name "README.md" | head -5',
    },
    {
      name: 'Validate changeset format',
      command: 'pnpm changeset status --verbose',
    },
  ]

  let allPassed = true

  for (const test of changesetTests) {
    const success = runCommand(test.command, test.name)
    if (!success) {
      allPassed = false
    }
  }

  return allPassed
}

function validatePackageStructure() {
  log(`\n${colors.bold}Validating Package Structure...${colors.reset}`)

  const packages = [
    'schema',
    'logger',
    'resilience',
    'core',
    'cli',
    'agent-base',
    'testing',
  ]
  let allValid = true

  for (const pkg of packages) {
    const packageDir = join(process.cwd(), 'packages', pkg)
    const packageJsonPath = join(packageDir, 'package.json')

    if (!existsSync(packageJsonPath)) {
      log(`${colors.red}✗ Package ${pkg} missing package.json${colors.reset}`)
      allValid = false
      continue
    }

    log(`${colors.green}✓ Package ${pkg} structure valid${colors.reset}`)
  }

  return allValid
}

async function main() {
  log(
    `${colors.bold}${colors.blue}@orchestr8 Release Workflow Test${colors.reset}\n`,
  )

  try {
    // Step 1: Check prerequisites
    checkPrerequisites()

    // Step 2: Validate package structure
    const structureValid = validatePackageStructure()
    if (!structureValid) {
      log(`${colors.red}Package structure validation failed${colors.reset}`)
      process.exit(1)
    }

    // Step 3: Test changeset commands
    const changesetTestsPassed = testChangesetCommands()
    if (!changesetTestsPassed) {
      log(`${colors.red}Changeset tests failed${colors.reset}`)
      process.exit(1)
    }

    // Step 4: Simulate workflow steps
    const workflowPassed = simulateWorkflowSteps()

    if (workflowPassed) {
      log(
        `\n${colors.green}${colors.bold}✅ All tests passed! Release workflow is ready.${colors.reset}`,
      )
      log(
        `${colors.green}The repository is ready for automated publishing.${colors.reset}`,
      )
    } else {
      log(`\n${colors.red}${colors.bold}❌ Some tests failed.${colors.reset}`)
      log(
        `${colors.red}Fix the issues above before enabling automated publishing.${colors.reset}`,
      )
      process.exit(1)
    }
  } catch (error) {
    log(`${colors.red}Unexpected error: ${error.message}${colors.reset}`)
    process.exit(1)
  }
}

// Run the script
main().catch(console.error)
