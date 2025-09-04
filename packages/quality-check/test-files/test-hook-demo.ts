// Test file with intentional quality issues to demonstrate hook behavior

// TypeScript error - undefined variable (not auto-fixable)
const user = unknownVariable

// ESLint error - unused variable (not auto-fixable)
const unusedVar = "I'm not used anywhere"

// Prettier formatting issues (auto-fixable)
const messySpacing = 'bad formatting'
const noSemicolon = 'missing semicolon'

// TypeScript error - type mismatch (not auto-fixable)
const numberValue: number = 'this is a string'

// ESLint prefer-const (potentially auto-fixable)
const shouldBeConst = 42

// Multiple issues on one line
const badIndent = 'wrong indent and spacing'

// Function with issues
function processData(data) {
  // Missing type annotations
  console.log(data) // Missing semicolon
  return data.length // Implicit any
}

// Use variables to avoid lint errors
console.log(user, unusedVar, messySpacing, noSemicolon, numberValue, shouldBeConst, badIndent)

export { processData }
