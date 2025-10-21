import { describe, it, expect } from 'vitest'
import { createInput, createComputed } from '../../src/index.js'

describe('createComputed', () => {
  it('creates computed value from input', () => {
    const [getter] = createInput(5)
    const double = createComputed(() => getter() * 2)
    expect(double()).toBe(10)
  })

  it('computes with initial value', () => {
    const computed = createComputed((x: number = 3) => x * 2)
    expect(computed()).toBe(6)
  })
})
