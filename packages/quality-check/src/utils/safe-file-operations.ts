/**
 * Atomic file operations with backup/restore capability
 */

import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'

import * as lockfile from 'proper-lockfile'
import writeFileAtomic from 'write-file-atomic'

import type { Logger } from '@orchestr8/logger'

import type { FileBackup } from '../types.js'

export class SafeFileOperations {
  private readonly backupDir: string
  private readonly backups = new Map<string, FileBackup>()

  constructor(
    projectRoot: string,
    private readonly logger: Logger,
  ) {
    // projectRoot is available for future use
    void projectRoot
    this.backupDir = path.join(tmpdir(), 'quality-check', 'backups', Date.now().toString())
  }

  /**
   * Safely write content to a file with atomic operations and backup
   */
  async safeWrite(filepath: string, content: string): Promise<void> {
    const normalizedPath = path.resolve(filepath)

    // Create backup first
    const backup = await this.createBackup(normalizedPath)

    try {
      // Acquire file lock
      const release = await this.acquireLock(normalizedPath)

      try {
        // Atomic write with fsync
        await writeFileAtomic(normalizedPath, content, {
          fsync: true,
          mode: await this.getFileMode(normalizedPath),
        })

        // Verify write succeeded
        const written = await fs.readFile(normalizedPath, 'utf-8')
        if (written !== content) {
          throw new Error('Write verification failed')
        }

        this.logger.debug('File written successfully', { filepath: normalizedPath })

        // Clean up backup on success
        await this.removeBackup(backup)
      } finally {
        await release()
      }
    } catch (error) {
      // Restore from backup on failure
      this.logger.error('Write failed, restoring backup', { filepath: normalizedPath, error })
      await this.restoreBackup(backup)
      throw error
    }
  }

  /**
   * Create a backup of a file
   */
  private async createBackup(filepath: string): Promise<FileBackup> {
    await fs.mkdir(this.backupDir, { recursive: true })

    const content = await fs.readFile(filepath, 'utf-8')
    const hash = createHash('sha256').update(content).digest('hex')
    const timestamp = Date.now()
    const backupName = `${path.basename(filepath)}-${timestamp}-${hash.slice(0, 8)}.backup`
    const backupPath = path.join(this.backupDir, backupName)

    await fs.copyFile(filepath, backupPath)

    const backup: FileBackup = {
      originalPath: filepath,
      backupPath,
      hash,
      timestamp,
    }

    this.backups.set(filepath, backup)
    this.logger.debug('Backup created', { filepath, backupPath })

    return backup
  }

  /**
   * Restore a file from backup
   */
  private async restoreBackup(backup: FileBackup): Promise<void> {
    await fs.copyFile(backup.backupPath, backup.originalPath)
    this.logger.info('File restored from backup', { filepath: backup.originalPath })
    await this.removeBackup(backup)
  }

  /**
   * Remove a backup file
   */
  private async removeBackup(backup: FileBackup): Promise<void> {
    try {
      await fs.unlink(backup.backupPath)
      this.backups.delete(backup.originalPath)
      this.logger.debug('Backup removed', { backupPath: backup.backupPath })
    } catch (error) {
      // Ignore cleanup errors
      this.logger.debug('Failed to remove backup', { backupPath: backup.backupPath, error })
    }
  }

  /**
   * Acquire an exclusive lock on a file
   */
  private async acquireLock(filepath: string): Promise<() => Promise<void>> {
    return lockfile.lock(filepath, {
      stale: 10000,
      retries: {
        retries: 3,
        minTimeout: 100,
        maxTimeout: 1000,
      },
    })
  }

  /**
   * Get file mode for preserving permissions
   */
  private async getFileMode(filepath: string): Promise<number> {
    try {
      const stats = await fs.stat(filepath)
      return stats.mode
    } catch {
      // Default to standard file permissions
      return 0o644
    }
  }

  /**
   * Clean up all backups
   */
  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.backupDir, { recursive: true, force: true })
      this.backups.clear()
      this.logger.debug('Cleanup completed')
    } catch (error) {
      this.logger.debug('Cleanup failed', { error })
    }
  }
}

/**
 * File lock manager for coordinating concurrent access
 */
export class FileLockManager {
  private readonly locks = new Map<string, Promise<void>>()

  async withLock<T>(filepath: string, operation: () => Promise<T>): Promise<T> {
    const normalizedPath = path.resolve(filepath)

    // Wait for any existing operations on this file
    const existingLock = this.locks.get(normalizedPath)
    if (existingLock) {
      await existingLock
    }

    // Create new lock promise
    let resolve: () => void
    const lockPromise = new Promise<void>((r) => {
      resolve = r
    })
    this.locks.set(normalizedPath, lockPromise)

    try {
      return await operation()
    } finally {
      this.locks.delete(normalizedPath)
      resolve!()
    }
  }
}
