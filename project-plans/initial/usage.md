# Base64 Fix Evaluation Usage

## Prerequisites
- Node.js 20+ and npm available on the host.
- `llxprt` CLI installed and accessible on `PATH`.
- Profiles `cerebrasqwen3` and `synthetic` configured via `llxprt --profile-load`.

Install root tooling:

```bash
npm install
```

Install hidden grading dependencies (runs automatically inside the eval script if `node_modules` is missing):

```bash
npm --prefix grading/base64-fix install
```

## Running an Evaluation
1. Ensure any previous grading symlink is cleared:
   ```bash
   rm -rf grading/base64-fix/workspace
   ```
2. Execute the harness:
   ```bash
   npm run eval:base64
   ```
   The script will:
   - Copy `problems/base64-fix/workspace` to a temp directory per profile.
   - Run `llxprt --profile-load <profile> --yolo --prompt ...` inside each copy.
   - Symlink `grading/base64-fix/workspace` to the working copy and execute lint/typecheck/Vitest (hidden) commands.
   - Archive modified workspaces under `evals/results/base64-fix-<timestamp>/<profile>/` (excluding `node_modules`).
   - Emit `summary.json` with command outcomes.

## Manual Grading / Debugging
- To inspect or run hidden tests manually against a workspace copy, create a symlink:
  ```bash
  ln -s <absolute-path-to-workspace-copy> grading/base64-fix/workspace
  npm --prefix grading/base64-fix run test:hidden
  ```
- Remove the link afterwards to avoid stale references.

## Reproducibility Notes
- No randomness is used within the task; Base64 fixtures are deterministic.
- The evaluation harness copies the workspace before each run, so rerunning the same profile is idempotent.
- Hidden tests remain under `grading/base64-fix/tests/hidden` and are never exposed to the model.
- Node dependency versions are pinned in each `package.json`; run `npm install` without `--save` to maintain deterministic locks when lockfiles are added later.

## Extending the Suite
- Clone `problems/base64-fix` and `grading/base64-fix` as a template for new tasks.
- Expose only the minimal public tests under `problems/<task>/workspace/tests/public`.
- Place hidden Vitest suites, lint rules, and grading scripts inside `grading/<task>` and rely on a symlink named `workspace`.
- Register new evaluation scripts under `evals/` and add npm scripts (e.g., `eval:<task>`).
