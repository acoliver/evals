# GPT's Prerequisite Implementation Tasks

## Phase 1: Hidden Test Breakdown Implementation

### Task 1: Base64-Fix Hidden Test Updates
- File: `grading/base64-fix/tests/hidden/base64.spec.ts`
- Add breakdown writer with 12 subtasks:
  - encode: 6 fixtures (TypeScript, Base64?, ~~~, foo/bar, , [OK] check)
  - decode: 4 fixtures (standard tests + padding test)
  - CLI helpers: encode success, decode success, encode/decode error cases
- Output: `workspace/results/base64.json`

### Task 2: Report-Builder Hidden Test Updates
- File: `grading/report-builder/tests/hidden/render.spec.ts`
- Add breakdown writer with 6 subtasks:
  - render markdown with totals ([OK])
  - render text without totals ([OK])
  - render text with totals ([OK])
  - fail unsupported format ( expected failure)
  - fail missing files ( expected failure)
  - package integrity ([OK])
- File: `grading/report-builder/tests/hidden/package.spec.ts` (already exists)
- Output: `workspace/results/report-builder.json`

### Task 3: Form-Capture Hidden Test Updates
- File: `grading/form-capture/tests/hidden/form.spec.ts`
- Add breakdown writer with 6 subtasks:
  - form renders correctly ([OK])
  - invalid email validation ([OK])
  - form data persists ([OK])
  - thank-you page displays ([OK])
  - CSS styling applied ([OK])
  - package integrity ([OK])
- Output: `workspace/results/form-capture.json`

### Task 4: Pagination Hidden Test Updates
- Files: `grading/pagination/tests/hidden/api.spec.ts`, `client.spec.tsx`
- Add breakdown writer with 5 subtasks:
  - API mid-page returns correct data ([OK])
  - API final page handling ([OK])
  - API invalid parameter handling ([OK])
  - Client navigation functionality ([OK])
  - Client alert edge case ([OK])
- Output: `workspace/results/pagination.json`

### Task 5: React-Evaluation Hidden Test Updates
- Files: `grading/react-evaluation/tests/hidden/advanced-observer.spec.ts`, `memory-management.spec.ts`
- Add breakdown writer with 3 subtasks:
  - advanced dependency chain works ([OK])
  - nested computed properties ([OK])
  - callback cleanup after unmount ([OK])
- Output: `workspace/results/react-evaluation.json`

## Implementation Pattern

```typescript
// Template for each test file:
import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..', 'workspace');

const TASKS = [
  // Define subtask IDs based on actual test cases
  'task-id-1',
  'task-id-2',
  // ...
];

const RESULTS_PATH = path.join(workspaceRoot, 'results', 'task-name.json');
const status = new Map<string, boolean>(TASKS.map((id) => [id, false]));

describe('hidden suite with breakdown', () => {
  it('subtask-1', () => {
    // existing test logic
    expect(...);
    status.set('task-id-1', true);
  });
  
  // ... existing tests ...
});

afterAll(() => {
  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(
    TASKS.map((taskId) => ({ taskId, passed: status.get(taskId) === true })),
    null,
    2
  ), 'utf8');
});
```

## Output Path Convention
All hidden test suites will write to: `workspace/results/<task-name>.json`

## Test Run Procedure
1. Implement all 5 hidden test updates
2. Run evaluation: `npm run eval:all -- --config llxprt-synthetic-glm4.6-temp1`
3. Verify each evaluation produces breakdown JSON in archived workspace
4. Validate JSON structure and content