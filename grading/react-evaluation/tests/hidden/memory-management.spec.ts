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

describe('Memory Management', () => {
  it('callback cleanup works correctly', async () => {
    const { createInput, createComputed, createCallback } = await getModule()
    
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
