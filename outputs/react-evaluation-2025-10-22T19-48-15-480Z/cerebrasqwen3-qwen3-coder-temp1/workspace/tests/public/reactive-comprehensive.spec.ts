import { describe, it, expect } from 'vitest'
import { createInput, createComputed, createCallback } from '../../src/index.js'

describe('Reactive Programming - Additional Exercism Tests', () => {
  // Key tests from Exercism that will guide models toward proper implementation
  
  it('compute cells can depend on other compute cells', () => {
    const [input, setInput] = createInput(1)
    const timesTwo = createComputed(() => input() * 2)
    const timesThirty = createComputed(() => input() * 30)
    const sum = createComputed(() => timesTwo() + timesThirty())
    expect(sum()).toEqual(32)
    setInput(3)
    expect(sum()).toEqual(96)
  })

  it('compute cells fire callbacks', () => {
    const [input, setInput] = createInput(1)
    const output = createComputed(() => input() + 1)
    let value = 0
    createCallback(() => (value = output()))
    setInput(3)
    expect(value).toEqual(4)
  })

  it('callbacks can be added and removed', () => {
    const [input, setInput] = createInput(11)
    const output = createComputed(() => input() + 1)

    const values1: number[] = []
    const unsubscribe1 = createCallback(() => values1.push(output()))
    const values2: number[] = []
    createCallback(() => values2.push(output()))

    setInput(31)
    unsubscribe1()
    setInput(41)

    expect(values1.length).toBeGreaterThan(0)
    expect(values2.length).toBeGreaterThan(values1.length)
  })
})