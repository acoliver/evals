import { describe, it, expect } from 'vitest'

// Dynamic import that works after workspace is copied during grading
const getModule = async () => {
  try {
    // Try workspace path first (during grading)
    return await import('../../workspace/src/index.ts')
  } catch {
    // Fallback for manual testing
    return await import('../../../../problems/react-evaluation/workspace/src/index.ts')
  }
}

describe('Advanced Observer Patterns', () => {
  it('handles complex dependency chains', async () => {
    const { createInput, createComputed } = await getModule()
    
    const [input1, setInput1] = createInput(1)
    const [input2, setInput2] = createInput(2)
    
    const computed = createComputed(() => input1() + input2())
    expect(computed()).toBe(3)
    
    setInput1(10)
    expect(computed()).toBe(12)
  })

  it('handles nested computed values', async () => {
    const { createInput, createComputed } = await getModule()
    
    const [base, setBase] = createInput(5)
    const doubled = createComputed(() => base() * 2)
    const quadrupled = createComputed(() => doubled() * 2)
    
    expect(quadrupled()).toBe(20)
    setBase(10)
    expect(quadrupled()).toBe(40)
  })
})
