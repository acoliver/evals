# Pagination Service Repair

This project contains a small Express API backed by SQLite and a minimal React client rendered through tests. The current implementation is missing critical pagination behavior.

## Requirements

- `GET /inventory` must accept `page` and `limit` query parameters (default `page = 1`, `limit = 5`).
  - Validate inputs: reject non-numeric, negative, zero, or excessive values with HTTP 400.
  - Query must return the correct slice of items without skipping or duplicating rows.
  - Response should include pagination metadata: `page`, `limit`, `total`, `hasNext`.
- React hook/component must request the selected page, update when the user navigates, and surface errors.
  - Provide “Previous” and “Next” controls that disable appropriately when there is no further data.
  - Ensure the UI renders empty states and propagates server validation errors.
- Keep the database bootstrap (`createDatabase`) intact so tests can create a fresh DB each run, but feel free to add helpers.

## Commands

```bash
npm install
npm run typecheck
npm run lint
npm run test:public
```

Additional grading checks (hidden) exercise the API via Supertest and the React components via Testing Library with in-memory SQLite databases. Expect to coordinate edits across server, shared types, and client files to satisfy all requirements.
