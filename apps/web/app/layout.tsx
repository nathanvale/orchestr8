import type { Metadata } from 'next'
import React from 'react'

export const metadata: Metadata = {
  title: 'Bun Template',
  description: 'Node.js + pnpm monorepo with Next.js',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}