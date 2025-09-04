// Sample TypeScript file with some fixable and unfixable issues
const message = 'hello world' // Missing space around = and ;
const unused = 42 // Unused variable

// This will cause a TypeScript error
const someObject = { name: 'test' }
console.log(someObject.nonExistentProperty) // TypeScript error

export function testFunction() {
  // Use unused variable to avoid lint error
  console.log(unused)
  return message
}
