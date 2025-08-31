export function sum(numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0)
}

export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0
  return sum(numbers) / numbers.length
}

export function isApproximately(a: number, b: number, tolerance = 1e-6): boolean {
  return Math.abs(a - b) <= tolerance
}

export function median(numbers: number[]): number {
  if (numbers.length === 0) return 0
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  // Numeric index access is safe after explicit bounds validation.
  if (sorted.length % 2 === 0) {
    const leftIndex = mid - 1
    // Defensive guard - unreachable with current logic (leftIndex always >=0 and mid < length for even arrays)
    // c8 ignore next
    if (leftIndex < 0 || mid >= sorted.length) return 0
    const left = sorted[leftIndex]
    const right = sorted[mid]
    // Defensive type guard - elements are always numbers after numeric sort
    // c8 ignore next
    if (typeof left !== 'number' || typeof right !== 'number') return 0
    return (left + right) / 2
  }
  return sorted[mid] ?? 0
}

export function percentile(numbers: number[], p: number): number {
  if (numbers.length === 0) return 0
  if (p <= 0) return Math.min(...numbers)
  if (p >= 100) return Math.max(...numbers)
  const sorted = [...numbers].sort((a, b) => a - b)
  const rank = (p / 100) * (sorted.length - 1)
  const low = Math.floor(rank)
  const high = Math.ceil(rank)
  if (low === high) {
    return sorted[low] ?? 0
  }
  // Defensive bounds guard - rank computation guarantees 0 <= low < sorted.length and high within bounds
  // c8 ignore next
  if (low < 0 || high >= sorted.length) return 0
  return interpolateSorted(sorted, low, high, rank - low)
}

function interpolateSorted(sorted: number[], low: number, high: number, weight: number): number {
  const lowVal = sorted[low]
  const highVal = sorted[high]
  // Defensive type guard - sorted array elements are numbers
  // c8 ignore next
  if (typeof lowVal !== 'number' || typeof highVal !== 'number') return 0
  return lowVal * (1 - weight) + highVal * weight
}

export interface NumberSummary {
  count: number
  sum: number
  average: number
  median: number
  p90: number
}

export function summarize(numbers: number[]): NumberSummary {
  return {
    count: numbers.length,
    sum: sum(numbers),
    average: average(numbers),
    median: median(numbers),
    p90: percentile(numbers, 90),
  }
}
