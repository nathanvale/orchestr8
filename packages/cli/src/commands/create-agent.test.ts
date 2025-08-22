import fs from 'fs/promises'
import path from 'path'

import { describe, expect, it, vi } from 'vitest'

import { createAgentCommand } from './create-agent.js'

vi.mock('fs/promises')

describe('create:agent command', () => {
  it('creates agent JSON file with minimal template', async () => {
    const mockWriteFile = vi.mocked(fs.writeFile)
    mockWriteFile.mockImplementation(() => Promise.resolve())

    const mockMkdir = vi.mocked(fs.mkdir)
    mockMkdir.mockImplementation(() => Promise.resolve(undefined))

    const mockAccess = vi.mocked(fs.access)
    mockAccess.mockImplementation(() => Promise.reject(new Error('Not found')))

    const consoleSpy = vi.spyOn(console, 'log')
    consoleSpy.mockImplementation(() => {})

    await createAgentCommand.parseAsync(['node', 'test', 'my-agent'])

    expect(mockMkdir).toHaveBeenCalledWith(path.join(process.cwd(), 'agents'), {
      recursive: true,
    })

    expect(mockWriteFile).toHaveBeenCalledWith(
      path.join(process.cwd(), 'agents', 'my-agent.json'),
      expect.stringContaining('"id": "my-agent"'),
      'utf-8',
    )

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ Created agent: agents/my-agent.json'),
    )
  })

  it('creates agent with custom description', async () => {
    const mockWriteFile = vi.mocked(fs.writeFile)
    mockWriteFile.mockImplementation(() => Promise.resolve())

    const mockMkdir = vi.mocked(fs.mkdir)
    mockMkdir.mockImplementation(() => Promise.resolve(undefined))

    const mockAccess = vi.mocked(fs.access)
    mockAccess.mockImplementation(() => Promise.reject(new Error('Not found')))

    await createAgentCommand.parseAsync([
      'node',
      'test',
      'my-agent',
      '--description',
      'My custom agent',
    ])

    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"description": "My custom agent"'),
      'utf-8',
    )
  })

  it('creates HTTP agent with template', async () => {
    const mockWriteFile = vi.mocked(fs.writeFile)
    mockWriteFile.mockImplementation(() => Promise.resolve())

    const mockMkdir = vi.mocked(fs.mkdir)
    mockMkdir.mockImplementation(() => Promise.resolve(undefined))

    const mockAccess = vi.mocked(fs.access)
    mockAccess.mockImplementation(() => Promise.reject(new Error('Not found')))

    await createAgentCommand.parseAsync([
      'node',
      'test',
      'my-agent',
      '--template',
      'http',
    ])

    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"type": "http"'),
      'utf-8',
    )
  })

  it('does not overwrite existing agent without force', async () => {
    const mockAccess = vi.mocked(fs.access)
    mockAccess.mockImplementation(() => Promise.resolve())

    const consoleSpy = vi.spyOn(console, 'log')
    consoleSpy.mockImplementation(() => {})

    await createAgentCommand.parseAsync(['node', 'test', 'existing-agent'])

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('already exists'),
    )
  })
})
