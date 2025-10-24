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

let callbackCleanupPassed = false

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
    callbackCleanupPassed = true
  })
})

afterAll(() => {
  const statusMap = new Map<string, boolean>(ALL_TASKS.map((taskId) => [taskId, false]))

  if (fs.existsSync(resultsPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(resultsPath, 'utf8')) as Array<{
        taskId: string
        passed: boolean
      }>
      for (const { taskId, passed } of existing) {
        if (statusMap.has(taskId)) {
          statusMap.set(taskId, passed)
        }
      }
    } catch {
      // ignore malformed existing file
    }
  }

  statusMap.set('callback-cleanup', callbackCleanupPassed)

  fs.mkdirSync(path.dirname(resultsPath), { recursive: true })
  const results = ALL_TASKS.map((taskId) => ({
    taskId,
    passed: statusMap.get(taskId) === true
  }))
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf8')
})
