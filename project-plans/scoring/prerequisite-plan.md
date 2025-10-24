# Vybes Scoring – Prerequisite Work

Before we implement the Vybes scoring engine, we need deterministic per-task
outputs for partial credit and ensure every run records agent runtime only.

## Goals
- Produce machine-readable hidden-test breakdowns for all tasks, not just regex.
- Persist each breakdown inside the run archive (`workspace/results.json`).
- Fast-fail when lint/typecheck fail; scoring should not attempt partial credit.
- Guarantee `cliResult.duration` is captured for every run.

## Task Breakdown

### 1. Instrument Hidden Suites
Add JSON writers mirroring regex’ behaviour:

| Task | File(s) | Subtasks to Capture | Output Path |
|------|---------|----------------------|--------------|
| base64-fix | `grading/base64-fix/tests/hidden/base64.spec.ts` | Individual encode/decode fixtures + CLI scenarios (total 12) | `workspace/results/base64.json` |
| report-builder | `grading/report-builder/tests/hidden/render.spec.ts`, `package.spec.ts` | 5 render behaviours + package integrity (6 total) | `workspace/results/report-builder.json` |
| form-capture | `grading/form-capture/tests/hidden/form.spec.ts`, `package.spec.ts` | Form render, invalid email, persistence, thank-you copy, CSS check, package integrity (6) | `workspace/results/form-capture.json` |
| pagination | `grading/pagination/tests/hidden/api.spec.ts`, `client.spec.tsx` | API mid-page, final page, invalid params, client navigation, client alert (5) | `workspace/results/pagination.json` |
| react-evaluation | `grading/react-evaluation/tests/hidden/advanced-observer.spec.ts`, `memory-management.spec.ts` | Advanced dependency chain, nested computed, callback cleanup (3) | `workspace/results/react-evaluation.json` |

Implementation pattern:
```ts
const RESULTS_PATH = path.join(workspaceRoot, 'results', 'task.json');
const TASKS = [...] // IDs for each `it` block
const status = new Map<string, boolean>(TASKS.map((id) => [id, false]));

it('...', () => {
  expect(...);
  status.set('task-id', true);
});

afterAll(() => {
  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(
    TASKS.map((taskId) => ({ taskId, passed: status.get(taskId) === true })),
    null,
    2
  ));
});
```

### 2. Update Unified Runner
- Ensure `cliResult.duration` is always recorded (rounded to seconds/minutes for scoring).
- Record grade-step results alongside existing command logs.

### 3. Guardrails
- Introduce a pre-scoring check: lint and typecheck must pass or scoring aborts.
- If any expected JSON breakdown is missing, emit a clear error and skip scoring.

### 4. Testing
- Validate each task’s hidden suite now produces the JSON summary inside the run archive.
- Confirm the files are cleaned up (ignored by git) and available per run.

## Deliverables
- Updated hidden tests with breakdown writers.
- Documentation describing each task’s JSON schema for the scoring engine.
- Runner changes guaranteeing CLI duration capture and guardrails.

Once these prerequisites are in place, the Vybes scoring implementation can consume
consistent per-run data for partial credit across all tasks.
