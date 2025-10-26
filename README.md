# LLxprt Evaluations

This repository houses the evaluation runner and dashboard builder logic. Generated
artifacts (workspace archives, `vybes-*.json`, logs, etc.) are not kept in Git so
the framework remains lightweight.

## Running evaluations

1. Install dependencies if needed: `npm install`.
2. Kick off the desired scenario, e.g. `npm run eval:all` or `npm run eval:base64`.
3. Regenerate dashboard data/zips with `npm run build:vybes` when the runs finish.

## Archiving artifacts

Use the helper to bundle results before copying them to `vybestack-site` (or any
other deployment repo):

```bash
npm run archive:results
```

This command creates `archives/vybes-artifacts-<timestamp>.tar.gz` containing:

- `outputs/`
- `public/runs/**`
- `public/vybes-daily.json`
- `public/vybes-runs.json`
- any `eval-*.log` files

Move or extract the tarball into the publication repo and commit the contents
there. The archive directory itself stays ignored in this repo.

## Configuration overrides

Additional LLxprt configuration overrides (e.g., passing model parameters via the
CLI) will be wired up once the next LLxprt release lands, so no ad-hoc env vars
are added here yet.
