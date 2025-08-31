/**
 * Shared Git utilities for consistent branch detection across scripts
 */

import { execSync } from 'node:child_process'

/**
 * Detect the base branch (main, master, or HEAD~1)
 * Returns the appropriate base branch or merge base for comparisons
 */
export function getBaseBranch(): { branch: string; mergeBase: string } {
  let baseBranch = 'main'

  // Try to find main branch
  try {
    execSync('git rev-parse --verify main', { stdio: 'pipe' })
    baseBranch = 'main'
  } catch {
    // Try master branch
    try {
      execSync('git rev-parse --verify master', { stdio: 'pipe' })
      baseBranch = 'master'
    } catch {
      // Neither main nor master exists, fall back to HEAD~1
      baseBranch = 'HEAD~1'
    }
  }

  // Get the merge base for better diff in feature branches
  let mergeBase = baseBranch
  if (baseBranch !== 'HEAD~1') {
    try {
      const mb = execSync(`git merge-base HEAD ${baseBranch}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      }).trim()
      mergeBase = mb
    } catch {
      // Can't find merge base, use the branch directly
      mergeBase = baseBranch
    }
  }

  return { branch: baseBranch, mergeBase }
}

/**
 * Get git info for reporting
 */
export async function getGitInfo(): Promise<{
  branch: string
  baseBranch: string
  commitRange: string
}> {
  try {
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim()

    const { branch: baseBranch, mergeBase } = getBaseBranch()
    const commitRange = `${mergeBase.substring(0, 7)}..HEAD`

    return {
      branch: currentBranch,
      baseBranch,
      commitRange,
    }
  } catch {
    return {
      branch: 'unknown',
      baseBranch: 'main',
      commitRange: 'HEAD~1..HEAD',
    }
  }
}
