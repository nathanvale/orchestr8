import { describe, expect, test, vi } from 'vitest';

describe('Vitest Setup Verification', () => {
  test('should run a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should support mocking with vi', () => {
    const mockFn = vi.fn();
    mockFn('test');

    expect(mockFn).toHaveBeenCalledWith('test');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  test('should support async tests', async () => {
    const promise = Promise.resolve('success');
    await expect(promise).resolves.toBe('success');
  });

  test('should support timers', () => {
    vi.useFakeTimers();

    const callback = vi.fn();
    setTimeout(() => callback(), 1000);

    vi.advanceTimersByTime(1000);

    expect(callback).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
