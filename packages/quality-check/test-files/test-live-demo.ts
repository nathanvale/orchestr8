// This file has various quality issues to demonstrate the hook

// TypeScript error - undefined variable (NOT auto-fixable)
const user = unknownUser

// Type error (NOT auto-fixable)
const count: number = 'not a number'

// Unused variables (ESLint warning)
const unused1 = "I'm never used"
const unused2 = 42

// Formatting issues (Prettier CAN fix these)
const messySpacing = 'bad'
const noSemi = 'missing semicolon'
const badIndent = 'wrong indent'

// Missing type annotation
function processData(data) {
  console.log(data)
  return data.length
}

// More type errors
const result: string = 123
const items: number[] = ['one', 'two', 'three']

export { processData }
