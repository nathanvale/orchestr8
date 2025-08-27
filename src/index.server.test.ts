import { describe, expect, test, vi } from 'vitest';
import { shouldAutoStart, startServer } from './index';

describe('server bootstrap logic', () => {
  test('shouldAutoStart returns false when not main', () => {
    expect(shouldAutoStart('production', false)).toBe(false);
  });

  test('shouldAutoStart returns false in test env even if main', () => {
    expect(shouldAutoStart('test', true)).toBe(false);
  });

  test('shouldAutoStart returns true in production when main', () => {
    expect(shouldAutoStart('production', true)).toBe(true);
  });

  test('startServer uses bun.serve (mocked) and returns server object', async () => {
    // bun module is mocked in vitest.setup.tsx; we just verify interaction
    const server = await startServer({ port: 3100 });
    expect(server).toBeDefined();
    // Mock always returns 3000 (see vitest.setup.tsx), ensure we document this behavior
    expect(server.port).toBe(3000);
  });

  test('startServer logs startup message', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await startServer({ port: 3200 });
    expect(infoSpy).toHaveBeenCalled();
    infoSpy.mockRestore();
  });
});
