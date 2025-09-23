/**
 * File-based SQLite helpers with managed temp directories
 */

import { createManagedTempDirectory, type TempDirectory } from '../fs/index.js'

export interface FileDatabase {
  url: string
  dir: string
  path: string
  cleanup: () => Promise<void>
}

/**
 * Create a file-backed SQLite database in a managed temp directory.
 * The returned cleanup delegates to the underlying TempDirectory cleanup.
 */
export async function createFileDatabase(name = 'db.sqlite'): Promise<FileDatabase> {
  const temp: TempDirectory = await createManagedTempDirectory({ prefix: 'sqlite-' })
  const dbPath = temp.getPath(name)
  const url = `file:${dbPath}`

  return {
    url,
    dir: temp.path,
    path: dbPath,
    cleanup: async () => {
      await temp.cleanup()
    },
  }
}
