import { vi } from 'vitest';

// Mock implementation of Bun's serve function
export const serve = vi.fn(() => {
  return {
    port: 3000,
    hostname: 'localhost',
    stop: vi.fn(),
  };
});

// Mock other Bun APIs as needed
export const file = vi.fn();
export const write = vi.fn();

// Export default object that mimics Bun's structure
export default {
  serve,
  file,
  write,
};