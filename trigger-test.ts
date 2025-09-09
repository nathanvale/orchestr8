// File to trigger quality-check-fixer agent via error 2

function badCode() {
  var x: number = 'string' // Type error
  console.log(x.nonExistent) // Property error
  // Missing return
}

const unused = 42 // Unused variable
export { badCode }
