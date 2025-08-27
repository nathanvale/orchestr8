import { describe, expect, test } from 'vitest';
import { average, isApproximately, median, percentile, sum, summarize } from './number-utils';

// Minimal targeted suite to exercise key branches for coverage (median even, percentile single & interpolation, clamps, empty cases, summarize, tolerance)
describe('number-utils', () => {
  test('median even branch with numeric guards', () => {
    expect(median([4, 2, 8, 6])).toBe((4 + 6) / 2);
  });

  test('percentile single value path (low === high)', () => {
    const data = [5, 10, 15, 20, 25];
    expect(percentile(data, 25)).toBe(10);
  });

  test('percentile interpolation path', () => {
    const data = [10, 40, 70, 100];
    expect(percentile(data, 50)).toBe(55);
  });

  test('percentile clamps lower & upper', () => {
    const data = [3, 9, 12];
    expect(percentile(data, -1)).toBe(3);
    expect(percentile(data, 101)).toBe(12);
  });

  test('empty inputs return 0 (median/percentile/average)', () => {
    expect(median([])).toBe(0);
    expect(percentile([], 50)).toBe(0);
    expect(average([])).toBe(0);
  });

  test('sum & summarize basic stats', () => {
    const nums = [1, 2, 3];
    expect(sum(nums)).toBe(6);
    const stats = summarize(nums);
    expect(stats).toMatchObject({ count: 3, sum: 6, average: 2, median: 2 });
  });

  test('isApproximately tolerance boundary', () => {
    expect(isApproximately(1, 1.000001, 0.000001)).toBe(true);
    expect(isApproximately(1, 1.000002, 0.000001)).toBe(false);
  });
});
