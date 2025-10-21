import { describe, it, expect } from 'vitest'
import { createInput } from '../../src/index.js'

describe('createInput', () => {
  it('creates input with initial value', () => {
    const [getter, _setter] = createInput(42)
    expect(getter()).toBe(42)
  })

  it('updates value through setter', () => {
    const [getter, setter] = createInput(42)
    setter(100)
    expect(getter()).toBe(100)
  })

  it('returns updated value from setter', () => {
    const [getter, setter] = createInput('hello')
    const result = setter('world')
    expect(result).toBe('world')
    expect(getter()).toBe('world')
  })
})