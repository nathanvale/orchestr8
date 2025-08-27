import { describe, expect, test } from 'vitest';
import { hello } from './index';

describe('hello function', () => {
  test('should return Hello world!', () => {
    expect(hello()).toBe('Hello world!');
  });
});
