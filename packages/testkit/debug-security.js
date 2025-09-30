#!/usr/bin/env node

import { validatePath } from './src/security/index.js'

console.log('Testing security validation...')

try {
  const result = validatePath('/tmp/test', '/etc/passwd')
  console.log('Result:', result)
} catch (error) {
  console.log('Error caught:', error.message)
}

try {
  const result2 = validatePath('/tmp/test', '../../../etc/passwd')
  console.log('Result2:', result2)
} catch (error) {
  console.log('Error2 caught:', error.message)
}

try {
  const result3 = validatePath('/tmp/test', '~/sensitive.txt')
  console.log('Result3:', result3)
} catch (error) {
  console.log('Error3 caught:', error.message)
}
