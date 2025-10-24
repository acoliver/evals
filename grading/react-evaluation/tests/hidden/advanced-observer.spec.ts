import { afterAll, describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

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

const workspaceRoot = path.resolve(__dirname, '..', '..', 'workspace')
const resultsPath = path.join(workspaceRoot, 'results', 'react-evaluation.json')
const ALL_TASKS = [
  'advanced-dependency-chain',
  'nested-computed',
  'callback-cleanup'
] as const

const taskStatus = new Map<string, boolean>(ALL_TASKS.map((taskId) => [taskId, false]))

describe('Advanced Observer Patterns', () => {
  it('handles complex dependency chains', async () => {
    const { createInput, createComputed } = await getModule()
    
    const [input1, setInput1] = createInput(1)
    const [input2, setInput2] = createInput(2)
    
    const computed = createComputed(() => input1() + input2())
    expect(computed()).toBe(3)
    
    setInput1(10)
    expect(computed()).toBe(12)
    taskStatus.set('advanced-dependency-chain', true)
  })

  it('handles nested computed values', async () => {
    const { createInput, createComputed } = await getModule()
    
    const [base, setBase] = createInput(5)
    const doubled = createComputed(() => base() * 2)
    const quadrupled = createComputed(() => doubled() * 2)
    
    expect(quadrupled()).toBe(20)
    setBase(10)
    expect(quadrupled()).toBe(40)
    taskStatus.set('nested-computed', true)
  })
})

afterAll(() => {
  if (fs.existsSync(resultsPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(resultsPath, 'utf8')) as Array<{
        taskId: string
        passed: boolean
      }>
      for (const { taskId, passed } of existing) {
        if (taskStatus.has(taskId) && passed) {
          taskStatus.set(taskId, true)
        }
      }
    } catch {
      // ignore malformed existing file
    }
  }

  fs.mkdirSync(path.dirname(resultsPath), { recursive: true })
  const results = ALL_TASKS.map((taskId) => ({
    taskId,
    passed: taskStatus.get(taskId) === true
  }))
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf8')
})
