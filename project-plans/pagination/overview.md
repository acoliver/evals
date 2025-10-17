# Pagination Repair Plan

## Objectives
- Build a multi-file TypeScript problem (`pagination`) spanning an API layer and a web client.
- Exercise model ability to coordinate schema/types across service + UI, including SQLite data access.
- Provide hidden grading (integration + component tests) while keeping public surface minimal.
- Extend evaluation harness to run the new task alongside base64 for llxprt profiles and Codex.

## Work Breakdown

1. **Scaffold directories**
   - `problems/pagination/workspace`: visible project with Express-like API, React client, SQLite DB setup, minimal public tests.
   - `grading/pagination`: hidden supertest/React Testing Library suites, stricter lint/type configs, migration fixture for SQLite.
   - Shared tooling (npm scripts, tsconfig, eslint) aligned with deterministic installs.

2. **Author broken scenario**
   - Seed SQLite DB with sample inventory rows (id, name, price, created_at).
   - API bug: query miscalculates OFFSET (off-by-one) and ignores `limit`, causing duplicate rows; validation missing.
   - Client bug: fetch hook hardcodes page 1 and ignores server metadata; UI lacks pagination controls.
   - Document requirements in `problem.md`: implement pagination params, validation, error states; update client to navigate pages.

3. **Hidden grading suite**
   - Supertest integration tests verifying `GET /inventory` respects `page`/`limit`, returns metadata (`total`, `hasNext`), and rejects invalid params with 400.
   - React Testing Library tests ensuring pagination buttons fetch next/prev pages, disable appropriately, and render empty-state messaging.
   - Lint/type commands run across workspace via hidden configs; ensure DB migrations are applied per test run (in-memory SQLite or tmp file).

4. **Evaluation harness updates**
   - Create `evals/runPagination.ts` mirroring base64 runner: copy workspace, invoke each profile, run grading commands, archive results to `evals/results/pagination-<timestamp>/`.
   - Wire npm script `eval:pagination` for convenience; optionally bundle both tasks via `npm run eval:all`.

5. **Documentation**
   - Add instructions to `docs/overview.md` for the new scenario (prereqs, commands, grading flow).
   - Note SQLite dependency and how to reset DB between runs.
