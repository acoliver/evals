# Base64 Fix Evaluation Plan

## Objectives
- Establish a reproducible TypeScript problem (`base64-fix`) where llxprt edits a workspace while hidden grading assets remain inaccessible.
- Instrument linting, type-checking, and Vitest-based validation that run only during grading.
- Provide an automated evaluation harness to compare `cerebrasqwen3` and synthetic profiles on the same task.

## Work Breakdown

1. **Scaffold directories**
   - Create `problems/base64-fix/workspace` for the visible project.
   - Create `grading/base64-fix` for hidden tests, configs, and grading scripts.
   - Add shared tooling (e.g., lockfile handling) ensuring deterministic installs.

2. **Author base64 CLI task**
   - Implement a broken `encode`/`decode` CLI in the workspace with a `run` command handling `--encode/--decode`.
   - Provide minimal visible guidance (`problem.md`, README) without revealing hidden test expectations.
   - Configure `package.json`, `tsconfig.json`, and scripts (`lint`, `typecheck`, `test:public`) that operate within the workspace.

3. **Build hidden grading suite**
   - Write comprehensive Vitest cases under `grading/base64-fix/tests` covering edge cases (padding, binary data, non-ASCII).
   - Add strict ESLint and `tsc` configs to be run from the grading directory (e.g., `npm run lint`, `npm run typecheck`, `npm run test:hidden`).
   - Ensure hidden commands can mount or symlink the workspace while keeping tests private.

4. **Implement evaluation harness**
   - Write a TypeScript script that prepares a fresh copy of the workspace per run.
   - Invoke `llxprt --profile-load <profile> --yolo --prompt "<task prompt>"` for each target profile (start with `cerebrasqwen3` and synthetic).
   - After the agent run, execute grading commands from `grading/base64-fix` and capture success/failure, timing, and logs.
   - Emit structured results (JSON/CSV) for comparing models; document workflow for adding additional profiles/tasks.

5. **Document usage**
   - Outline how to reset the workspace between runs.
   - Describe how to add new problems following the same structure.
   - Record any assumptions (e.g., deterministic seeds, Node.js version) needed for reproducibility.

