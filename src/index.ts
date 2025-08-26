export function hello(): string {
  return 'Hello world!';
}

// Only start server if this is the main module (not being imported for tests)
if (import.meta.main) {
  // Conditionally import Bun only in production to avoid test environment conflicts
  if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
    // Use string-based import to prevent Vite's static analysis from failing
    // This avoids "Failed to resolve import 'bun'" errors during testing
    const bunModule = 'bun';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { serve } = await import(bunModule);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    serve({
      port: 3000,
      fetch(_req: Request) {
        return new Response('👋 Hello from Bun + Changesets + Commitizen template!', {
          headers: { 'Content-Type': 'text/plain' },
        });
      },
    });

    console.info('🚀 Server running at http://localhost:3000');
  }
}
