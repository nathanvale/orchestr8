import { defineWorkspace } from 'vitest/config'
import { getVitestProjects } from './vitest.projects'

// Thin wrapper to maintain backward compatibility with tooling that references
// vitest.workspace.ts, while centralizing projects in vitest.projects.ts
export default defineWorkspace(getVitestProjects())
