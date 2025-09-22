import { defineConfig } from 'vitest/config'
import { getVitestProjects } from './vitest.projects'

/**
 * Root Vitest config using projects (workspace is deprecated).
 * Single source of truth lives in vitest.projects.ts
 */
export default defineConfig({
  test: {
    projects: getVitestProjects(),
  },
})
