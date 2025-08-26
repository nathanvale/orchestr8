import { describe, expect, it } from 'vitest';
import { hello } from './index';

describe('hello function', () => {
  it('should return Hello world!', () => {
    expect(hello()).toBe('Hello world!');
  });
});
