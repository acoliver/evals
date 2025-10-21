import { describe, it, expect } from 'vitest'
import { createInput, createComputed, createCallback } from '../../src/index.js'

describe('Reactive Programming - Comprehensive Tests', () => {
  
  // Input cell tests
  it('input cells have a value', () => {
    const initialValue = 10
    const [input] = createInput(initialValue)
    expect(input()).toEqual(initialValue)
  })

  it("an input cell's value can be set", () => {
    const newValue = 20
    const [input, setInput] = createInput(4)
    setInput(newValue)
    expect(input()).toEqual(newValue)
  })

  // Basic compute cell tests
  it('compute cells calculate initial value', () => {
    const [input] = createInput(1)
    const output = createComputed(() => input() + 1)
    expect(output()).toEqual(2)
  })

  it('compute cell takes inputs in correct order', () => {
    const [one] = createInput(1)
    const [two] = createInput(2)
    const output = createComputed(() => one() + two() * 10)
    expect(output()).toEqual(21)
  })

  it('compute cells update value when inputs are changed', () => {
    const [input, setInput] = createInput(1)
    const output = createComputed(() => input() + 1)
    setInput(3)
    expect(output()).toEqual(4)
  })

  // Advanced dependency tests
  it('compute cells can depend on other compute cells', () => {
    const [input, setInput] = createInput(1)
    const timesTwo = createComputed(() => input() * 2)
    const timesThirty = createComputed(() => input() * 30)
    const sum = createComputed(() => timesTwo() + timesThirty())
    expect(sum()).toEqual(32)
    setInput(3)
    expect(sum()).toEqual(96)
  })

  it('handles nested computed values', () => {
    const [base, setBase] = createInput(5)
    const doubled = createComputed(() => base() * 2)
    const quadrupled = createComputed(() => doubled() * 2)
    
    expect(quadrupled()).toBe(20)
    setBase(10)
    expect(quadrupled()).toBe(40)
  })

  // Callback tests
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
    values1.pop() // discard initial value from registration
    const values2: number[] = []
    createCallback(() => values2.push(output()))
    values2.pop() // discard initial value ...

    setInput(31)

    unsubscribe1()

    const values3: number[] = []
    createCallback(() => values3.push(output()))
    values3.pop() // discard initial value ...

    setInput(41)

    expect(values1).toEqual([32])
    expect(values2).toEqual([32, 42])
    expect(values3).toEqual([42])
  })

  it('removing a callback multiple times doesn\'t interfere with other callbacks', () => {
    const [input, setInput] = createInput(1)
    const output = createComputed(() => input() + 1)

    const values1: number[] = []
    const unsubscribe1 = createCallback(() => values1.push(output()))
    values1.pop() // discard initial value from registration
    const values2: number[] = []
    createCallback(() => values2.push(output()))
    values2.pop() // discard initial value ...

    unsubscribe1()
    unsubscribe1()
    unsubscribe1()

    setInput(2)

    expect(values1).toEqual([])
    expect(values2).toEqual([3])
  })

  it('callbacks should only be called once, even if multiple dependencies change', () => {
    const [input, setInput] = createInput(1)
    const plusOne = createComputed(() => input() + 1)
    const minusOne1 = createComputed(() => input() - 1)
    const minusOne2 = createComputed(() => minusOne1() - 1)
    const output = createComputed(() => plusOne() * minusOne2())

    const values: number[] = []
    createCallback(() => values.push(output()))
    values.pop() // discard initial value from registration

    setInput(4)

    expect(values).toEqual([10])
  })

  // Memory management tests
  it('callback cleanup works correctly', () => {
    const [input, setInput] = createInput(0)
    let callCount = 0
    
    const unsubscribe = createCallback(() => {
      callCount++
      input()
    })
    
    setInput(1)
    unsubscribe()
    setInput(2)
    
    // Should be called for each input change before unsubscribe
    expect(callCount).toBe(2)
  })
})