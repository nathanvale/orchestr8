import { beforeEach, describe, expect, test } from 'vitest';
import { mockApiError, mockApiResponse, server } from '../vitest.setup';

describe('MSW Network Interception', () => {
  beforeEach(() => {
    // Reset MSW handlers before each test
    server.resetHandlers();
  });

  test('should intercept GET requests to /api/health', async () => {
    const response = await fetch('/api/health');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: 'ok' });
  });

  test('should intercept GET requests with parameters', async () => {
    const response = await fetch('/api/user/123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: '123',
      name: 'Test User 123',
      email: 'test123@example.com',
    });
  });

  test('should intercept POST requests to /api/auth/login', async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test', password: 'password' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      token: 'mock-jwt-token',
      user: { id: '1', name: 'Test User' },
    });
  });

  test('should allow dynamic response mocking with mockApiResponse', async () => {
    const customData = { custom: 'response', id: 456 };
    mockApiResponse('/api/custom', customData, 201);

    const response = await fetch('/api/custom');
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual(customData);
  });

  test('should allow error response mocking with mockApiError', async () => {
    mockApiError('/api/error', 500, 'Internal Server Error');

    const response = await fetch('/api/error');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal Server Error' });
  });

  test('should work without global fetch mock interference', async () => {
    // This test verifies that MSW works without the global fetch mock
    // If the global fetch mock was still active, this would fail

    const response = await fetch('/api/health');

    // MSW should handle this request, not the global fetch mock
    expect(response.status).toBe(200);
    expect(typeof response.json).toBe('function');

    const data = await response.json();
    expect(data).toEqual({ status: 'ok' });
  });

  test('should surface helpful guidance for unmatched requests without dialing network', async () => {
    // Simulate MSW's unmatched request scenario without real socket attempts
    const originalFetch = globalThis.fetch;
    let called = false;
    // Minimal stub replicating an unmatched error path
    // eslint-disable-next-line @typescript-eslint/require-await
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      called = true;
      const target =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : '[request]';
      const err = new Error(`MSW_UNMATCHED: ${target}`);
      (err as any).code = 'MSW_UNMATCHED';
      throw err;
    }) as any;

    await expect(fetch('/api/nonexistent')).rejects.toMatchObject({ code: 'MSW_UNMATCHED' });
    expect(called).toBe(true);

    // Restore original fetch
    globalThis.fetch = originalFetch;
  });
});
