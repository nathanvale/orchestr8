import { describe, it, expect } from 'vitest'
import { normalize, normalizeParts } from '../normalize.js'

describe('Debug normalization', () => {
  it('should normalize command parts correctly', () => {
    // Test what happens with spawn('echo', ['hello'])
    const cmd = 'echo'
    const args = ['hello']

    const fullCommand = normalizeParts(cmd, args)
    console.log('normalizeParts("echo", ["hello"]) =', fullCommand)

    // Test direct normalization
    const direct = normalize('echo hello')
    console.log('normalize("echo hello") =', direct)

    // Should be the same
    expect(fullCommand).toBe(direct)
    expect(fullCommand).toBe('echo hello')
  })
})
