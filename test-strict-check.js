#!/usr/bin/env node

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

async function test() {
  // Create temp dir
  const tempDir = path.join(__dirname, 'test-temp-debug')
  fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })

  // Create tsconfig
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'bundler',
      esModuleInterop: true,
      skipLibCheck: true,
      strict: true,
      strictNullChecks: true,
      strictFunctionTypes: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  }

  fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))

  // Create package.json
  const packageJson = {
    name: 'test-project',
    version: '1.0.0',
    type: 'module',
  }

  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2))

  // Create test file with strict errors
  const testCode = `interface User {
  id: number
  name: string
  email?: string
}

export function getUserEmail(user: User | null): string {
  // This should trigger strict null check issues
  return user.email
}`

  const filePath = path.join(tempDir, 'src', 'test-strict.ts')
  fs.writeFileSync(filePath, testCode)

  // Create payload
  const payload = {
    tool_name: 'Write',
    tool_input: {
      file_path: filePath,
      content: testCode,
    },
  }

  // Run claude-hook
  const hookPath = path.join(__dirname, 'packages/quality-check/bin/claude-hook')

  console.log('Running claude-hook with payload:', JSON.stringify(payload))
  console.log('Working directory:', tempDir)

  const child = spawn('node', [hookPath], {
    cwd: tempDir,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  child.stdin.write(JSON.stringify(payload))
  child.stdin.end()

  let stdout = ''
  let stderr = ''

  child.stdout.on('data', (data) => {
    stdout += data.toString()
  })

  child.stderr.on('data', (data) => {
    stderr += data.toString()
  })

  child.on('close', (code) => {
    console.log('\n=== Results ===')
    console.log('Exit code:', code)
    console.log('\nStdout:', stdout)
    console.log('\nStderr:', stderr)

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true })
  })
}

test().catch(console.error)
