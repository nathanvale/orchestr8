import { sum, average, normalizePath } from '@template/utils'
import React from 'react'

export default function Home(): React.JSX.Element {
  const total = sum([1, 2, 3, 4, 5])
  const avg = average([10, 20, 30, 40])
  const normalizedPath = normalizePath('/Users/test//project/../project')

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Next.js + pnpm Monorepo</h1>
      <p>Welcome to your modern monorepo template!</p>
      
      <section style={{ marginTop: '2rem' }}>
        <h2>Utils Package Demo</h2>
        <p>
          <strong>Sum of [1,2,3,4,5]:</strong> {total}
        </p>
        <p>
          <strong>Average of [10,20,30,40]:</strong> {avg}
        </p>
        <p>
          <strong>Normalized Path:</strong> <code>{normalizedPath}</code>
        </p>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Architecture</h2>
        <ul>
          <li>✅ Next.js 15 with App Router</li>
          <li>✅ pnpm Workspaces</li>
          <li>✅ Turborepo Orchestration</li>
          <li>✅ TypeScript Strict Mode</li>
          <li>✅ Vitest Testing</li>
          <li>✅ Next.js ESLint Rules</li>
        </ul>
      </section>
    </main>
  )
}