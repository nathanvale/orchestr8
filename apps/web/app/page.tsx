import { formatNumber, normalizeOsPath } from '@bun-template/utils'
import React from 'react'

export default function Home(): React.JSX.Element {
  const formattedNumber = formatNumber(1234567.89)
  const normalizedPath = normalizeOsPath('/Users/test/project')

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Next.js + pnpm Monorepo</h1>
      <p>Welcome to your modern monorepo template!</p>
      
      <section style={{ marginTop: '2rem' }}>
        <h2>Utils Package Demo</h2>
        <p>
          <strong>Formatted Number:</strong> {formattedNumber}
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
        </ul>
      </section>
    </main>
  )
}