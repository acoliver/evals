import { afterAll, describe, it, expect } from 'vitest'
import path from 'node:path';
import fs from 'node:fs';

const gradingRoot = path.resolve(__dirname, '..', '..');
const workspaceRoot = path.resolve(gradingRoot, 'workspace');

// Task breakdown for scoring
const TASKS = [
  'callback-cleanup'
];

const RESULTS_PATH = path.join(workspaceRoot, 'results', 'react-evaluation-memory.json');
const status = new Map<string, boolean>(TASKS.map((id) => [id, false]));

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

describe('Memory Management with breakdown', () => {
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
    
    status.set('callback-cleanup', true)
  })
})

afterAll(() => {
  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  const results = TASKS.map((taskId) => ({ taskId, passed: status.get(taskId) === true }));
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf8');
});