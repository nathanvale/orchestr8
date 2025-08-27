export function hello(): string {
  return 'Hello world!';
}

/**
 * Internal server creation logic (factored for testability).
 * Returns the mock server object when Bun is mocked in tests.
 */
interface BunLikeServer {
  port: number;
  hostname?: string;
  stop?: () => void;
}

type ServeFn = (options: { port: number; fetch: (req: Request) => Response }) => BunLikeServer;

export async function startServer(options: { port?: number } = {}): Promise<BunLikeServer> {
  const bunModule = 'bun';
  const imported: { serve: ServeFn } = (await import(bunModule)) as unknown as { serve: ServeFn };
  const server = imported.serve({
    port: options.port ?? 3000,
    fetch(_req: Request) {
      return new Response('👋 Hello from Bun + Changesets + Commitizen template!', {
        headers: { 'Content-Type': 'text/plain' },
      });
    },
  });
  console.info('🚀 Server running at http://localhost:3000');
  return server;
}

/** Decide whether we should auto-start the server (avoids doing so under test). */
export function shouldAutoStart(nodeEnv: string | undefined, isMain: boolean): boolean {
  if (!isMain) return false;
  // Don't auto start during tests
  if (nodeEnv === 'test') return false;
  return true;
}

// Only start automatically when this is the entrypoint and not in test env
if (
  shouldAutoStart(
    typeof process !== 'undefined' ? process.env.NODE_ENV : undefined,
    import.meta.main,
  )
) {
  await startServer();
}
