import { describe, it, expect } from 'vitest'
import { createCallback } from '../../src/index.ts'

describe('createCallback', () => {
  it('returns unsubscribe function', () => {
    const unsubscribe = createCallback(() => console.log('test'))
    expect(typeof unsubscribe).toBe('function')
  })

  it('unsubscribe function can be called without error', () => {
    const unsubscribe = createCallback(() => console.log('test'))
    expect(() => unsubscribe()).not.toThrow()
  })
})
