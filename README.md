# LLxprt Evaluations

This repository houses the evaluation runner and dashboard builder logic. Generated
artifacts (workspace archives, `vybes-*.json`, logs, etc.) are not kept in Git so
the framework remains lightweight.

## Third-Party Attributions

Some problem workspaces incorporate MIT-licensed material from upstream projects.
See `ATTRIBUTIONS.md` for the full list of sources and license details.

## Running evaluations

1. Install dependencies if needed: `npm install`.
2. Export the env vars that feed the LLxprt CLI arguments (see below). At minimum you need the `*_KEY` values.
3. Kick off the desired scenario, e.g. `npm run eval:all` or `npm run eval:base64`.
3. Regenerate dashboard data/zips with `npm run build:vybes` when the runs finish.

### Env vars for LLxprt

`evals/config/cli-config.json` defines two env-driven configurations:

| Variable | Description | Default |
| --- | --- | --- |
| `SYNTHETIC_PROVIDER` | Provider passed to `--provider` for the Synthetic stack | `openai` |
| `SYNTHETIC_BASEURL` | Synthetic base URL (`--baseurl`) | `https://api.synthetic.new/openai/v1` |
| `SYNTHETIC_MODEL` | Model slug (`--model`) | `hf:zai-org/GLM-4.6` |
| `SYNTHETIC_KEY` | **Required** API key used with `--key` | – |
| `SYNTHETIC_CONTEXT_LIMIT` | Workspace context limit `--set` | `context-limit=190000` |
| `SYNTHETIC_SHELL_REPLACEMENT` | Shell replacement flag `--set` | `shell-replacement=true` |
| `CEREBRAS_PROVIDER` | Provider for the Cerebras stack | `openai` |
| `CEREBRAS_BASEURL` | Cerebras base URL | `https://api.cerebras.ai/v1` |
| `CEREBRAS_MODEL` | Model slug | `qwen-3-coder-480b` |
| `CEREBRAS_KEY` | **Required** API key passed to `--key` | – |
| `CEREBRAS_CONTEXT_LIMIT` | `--set` context limit | `context-limit=128000` |
| `CEREBRAS_CUSTOM_HEADERS` | Optional custom header tuple (`--set`) | `custom-headers=response_format.json_schema.strict true` |
| `CEREBRAS_SHELL_REPLACEMENT` | Shell replacement flag | `shell-replacement=true` |

Only the `*_KEY` variables are strictly required—everything else falls back to the defaults above, but you can override them in CI by exporting new values before running `npm run eval:all`.

### Multipass remediation

Each evaluation now supports a remediation loop that can retry a scenario up to
three times by default. After every failing attempt the harness summarises the
lint/test/build errors and feeds those bullets back into the next pass. The
highest scoring pass is reported, while time penalties are applied to the total
elapsed wall-clock time across all passes.

- Disable multipass entirely with `--skip-multipass` or by exporting
  `EVALS_SKIP_MULTIPASS=1`.
- Override the retry budget with `--max-passes <n>` or
  `EVALS_MAX_PASSES=<n>` (minimum of 1).
- The `outputs/**/results.json` files include a `multipass` block with per-pass
  prompts, feedback, and Vybe scores so you can audit each attempt.

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
