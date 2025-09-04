// Test file for three-tier quality system
// This file intentionally has multiple issues

// Issue 1: Using 'any' type
const badVariable: any = 'should not use any'

// Issue 2: Formatting issues
const poorlyFormatted = true
console.log(poorlyFormatted)

// Issue 3: Missing semicolons
const needsSemicolon = 'missing'
console.log(needsSemicolon)

// Issue 4: Unused variable
const unusedVariable = 'I am never used'

// Issue 5: Function with implicit any parameter
function processData(data) {
  return data.toString()
}

// Issue 6: TypeScript error - type mismatch
const numberVar: number = 'this is a string'

// Issue 7: Complex formatting
const obj = { a: 1, b: 2, c: { nested: true, value: 'test' } }

export { processData, badVariable, numberVar, obj }
