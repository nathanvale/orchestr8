import type { Runtime, RuntimeServer } from './types'

/**
 * Bun runtime adapter that wraps Bun.serve for production use
 */
export function bunRuntime(): Runtime {
  return {
    serve({ port, fetch }) {
      // Use Bun.serve directly for production performance
      const server = Bun.serve({
        port: Number(port),
        fetch,
      })

      return {
        port: server.port,
        hostname: 'localhost',
        stop: () => server.stop(),
      } satisfies RuntimeServer
    },
  }
}
