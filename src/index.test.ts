import { expect, test } from 'bun:test';
import { hello } from './index';

test('hello function', () => {
  expect(hello()).toBe('Hello world!');
});
