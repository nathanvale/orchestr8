import fs from 'fs/promises'
import path from 'path'

import { describe, expect, it, vi } from 'vitest'

import { initCommand } from './init.js'

vi.mock('fs/promises')

describe('init command', () => {
  it('creates orchestr8.config.json with default configuration', async () => {
    const mockWriteFile = vi.mocked(fs.writeFile)
    mockWriteFile.mockImplementation(() => Promise.resolve())

    const mockAccess = vi.mocked(fs.access)
    mockAccess.mockImplementation(() =>
      Promise.reject(new Error('File not found')),
    )

    const consoleSpy = vi.spyOn(console, 'log')
    consoleSpy.mockImplementation(() => {})

    await initCommand.parseAsync(['node', 'test'])

    expect(mockWriteFile).toHaveBeenCalledWith(
      path.join(process.cwd(), 'orchestr8.config.json'),
      expect.stringContaining('"version": "1.0.0"'),
      'utf-8',
    )

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ Created orchestr8.config.json'),
    )
  })

  it('does not overwrite existing config without force flag', async () => {
    const mockAccess = vi.mocked(fs.access)
    mockAccess.mockImplementation(() => Promise.resolve())

    const consoleSpy = vi.spyOn(console, 'log')
    consoleSpy.mockImplementation(() => {})

    await initCommand.parseAsync(['node', 'test'])

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('orchestr8.config.json already exists'),
    )
  })

  it('overwrites existing config with force flag', async () => {
    const mockWriteFile = vi.mocked(fs.writeFile)
    mockWriteFile.mockImplementation(() => Promise.resolve())

    const mockAccess = vi.mocked(fs.access)
    mockAccess.mockImplementation(() => Promise.resolve())

    const consoleSpy = vi.spyOn(console, 'log')
    consoleSpy.mockImplementation(() => {})

    await initCommand.parseAsync(['node', 'test', '--force'])

    expect(mockWriteFile).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ Overwritten orchestr8.config.json'),
    )
  })
})
