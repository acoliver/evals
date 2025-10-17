# LLxprt Evaluation Overview

## Repo Layout
- `problems/base64-fix/workspace/`: TypeScript project the agent edits. Includes the broken Base64 CLI, public tests, and task brief.
- `grading/base64-fix/`: Hidden lint/type/test harness. The `workspace` folder inside is ephemeral and created by the evaluator.
- `evals/runBase64Fix.ts`: Driver script that copies a fresh workspace, runs each configured agent profile (llxprt models and/or Codex), then executes grading commands.
- `project-plans/initial/`: Planning notes and usage guidance.

## Prerequisites
- Node.js 20+ and npm.
- `llxprt` CLI on `PATH` with profiles such as `cerebrasqwen3` or `synthetic` configured (`llxprt --profile-load <name>`).
- (Optional) `codex` CLI if you want to benchmark Codex. For write access, launch it with `--sandbox danger-full-access` or another writable sandbox.

Install dependencies once:

```bash
npm install
npm --prefix grading/base64-fix install
```

## Running the Base64 Eval
Use the provided npm script for a full sweep of configured profiles (currently `cerebrasqwen3`, `synthetic`, and `codex`):

```bash
npm run eval:base64
```

What it does:
1. Copies `problems/base64-fix/workspace` to a temporary directory per profile.
2. Invokes the agent:
   - llxprt: `llxprt --profile-load <profile> --yolo --prompt "<task>"`
   - Codex: `codex --dangerously-bypass-approvals-and-sandbox exec --skip-git-repo-check "<task>"`
3. Syncs the workspace into `grading/base64-fix/workspace` and runs:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test:public`
   - `npm --prefix grading/base64-fix run lint`
   - `npm --prefix grading/base64-fix run typecheck`
   - `npm --prefix grading/base64-fix run test:hidden`
4. Archives each agent’s edited workspace and command log under `evals/results/base64-fix-<timestamp>/<profile>/`.

Results summary lives in `evals/results/base64-fix-<timestamp>/summary.json`.

## Running a Single Agent Manually
If you want to run just Codex (outside the harness) against the task:

```bash
cd problems/base64-fix/workspace
codex --dangerously-bypass-approvals-and-sandbox --sandbox danger-full-access exec --skip-git-repo-check "$(cat problem.md)"
```

After the agent exits, execute the grading steps yourself:

```bash
npm run typecheck && npm run lint && npm run test:public
ln -s "$(pwd)" ../../grading/base64-fix/workspace
npm --prefix ../../grading/base64-fix run lint
npm --prefix ../../grading/base64-fix run typecheck
npm --prefix ../../grading/base64-fix run test:hidden
unlink ../../grading/base64-fix/workspace
```

## Extending the Suite
1. Duplicate `problems/base64-fix` and `grading/base64-fix` to create a new task skeleton.
2. Place only minimal public tests in the workspace; keep comprehensive checks hidden under the grading directory.
3. Add a new script (e.g., `eval:<task>`) to `package.json` that points to a new runner file under `evals/`.
4. Update `docs/overview.md` with instructions for the new task.
