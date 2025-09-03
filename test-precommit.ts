// Test file - now fixed to pass pre-commit hook

export function goodFunction(x: number): number {
  console.log('Processing:', x)
  return x + 1
}

// Test the function
const result = goodFunction(5)
console.log('Result:', result)
