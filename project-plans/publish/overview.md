# Publication Plan: Vybes Scoreboard

## Objectives
- Publish daily Vybes aggregates (per provider per eval) with a “greenscreen” themed static site.
- Provide raw per-run data to detect regressions and provider drift.
- Keep the pipeline fully automated so GitHub Actions or cron jobs can regenerate the assets.

## High-Level Flow
```
1. Run evaluations (manual or scheduled)
2. Aggregator script reads outputs/*/*/workspace/results.json
   → extracts vybes blocks + command metadata
   → groups by date + profile + eval
   → writes JSON artifacts (daily summary + run log)
3. Static HTML/JS page fetches JSON and renders headlines:
   - Daily totals/averages per profile
   - Per-run cards with links to archived workspaces
   - Trend indicators (optional)
4. Deploy static assets via GitHub Pages/Netlify/S3
```

## Data Artifacts
### 1. Per-run log (`vybes-runs.json`)
```json
[
  {
    "evalName": "pagination",
    "configId": "cerebrasqwen3-qwen3-coder-temp1",
    "runId": "pagination-2025-10-24T03-37-00-232Z",
    "date": "2025-10-24",
    "vybes": {
      "finalScore": 300,
      "successPercentage": 0.6,
      "timePenaltyMultiplier": 1,
      "actualTimeMinutes": 0.51,
      "breakdown": {
        "subtasksPassed": 3,
        "subtasksTotal": 5,
        "modules": {
          "pagination": {
            "passed": 3,
            "total": 5,
            "failedTasks": ["client-alert", "client-navigation"]
          }
        }
      }
    },
    "workspaceArchive": "outputs/pagination-2025-…/cerebrasqwen3-qwen3-coder-temp1/workspace"
  }
]
```

### 2. Daily rollup (`vybes-daily.json`)
```json
[
  {
    "date": "2025-10-24",
    "profiles": {
      "cerebrasqwen3-qwen3-coder-temp1": {
        "runs": 6,
        "totalVybes": 1091.79,
        "avgVybes": 181.97,
        "avgSuccess": 0.6,
        "avgPenalty": 0.66,
        "bestRun": {
          "eval": "react-evaluation",
          "score": 500,
          "runId": "react-evaluation-2025-…"
        },
        "worstRun": {
          "eval": "form-capture",
          "score": 0,
          "runId": "form-capture-2025-…"
        }
      }
    }
  }
]
```

## Aggregator Script Outline (`scripts/build-vybes.js`)
1. Discover all `outputs/*/*/workspace/results.json`
2. Parse each file:
   ```js
   const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
   if (!data.vybes) return;
   ```
3. Normalize timestamps → `date` (UTC) & `runId` (from parent directory name)
4. Push entry into in-memory arrays for runs/daily groups
5. After scanning everything:
   - Write `public/vybes-runs.json`
   - Aggregate per day/profile and write `public/vybes-daily.json`
6. Optionally write `public/vybes-latest.json` with only today’s data for quick fetches

## Frontend Notes
- Single `index.html` with:
  - `<link rel="stylesheet" href="vybestack.css">`
  - Minimal JS: `fetch('vybes-daily.json')` & `fetch('vybes-runs.json')`
  - Render daily tiles (totals) and expandable per-run timeline
- Keep color palette consistent (#6a9955 as primary accent)
- Include links back to raw `results.json` and archived workspace

## Automation
- Add npm script:
  ```json
  {
    "scripts": {
      "build:vybes": "node scripts/build-vybes.js"
    }
  }
  ```
- GitHub Actions workflow:
  ```yaml
  on:
    workflow_dispatch:
    schedule:
      - cron: '0 3 * * *'
  jobs:
    vybes:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - run: npm ci
        - run: npm run eval:all  # optional if running evaluations
        - run: npm run build:vybes
        - uses: actions/upload-artifact@v4
          with:
            name: vybes-static
            path: public/
  ```
- Deployment: either publish `public/` via Pages or sync to S3/Netlify

## Open Questions
- Do we want sparkline charts (requires additional JS lib)?
- How far back should the aggregator look (cleanup old outputs or archive them)?
- Should we version the JSON schema (add `schemaVersion` key)?
- Do we include command-level timing (CLI vs build vs grade) in the feed?

## Next Steps
1. Implement `scripts/build-vybes.js`
2. Scaffold `public/index.html` with greenscreen theme + fetch logic
3. Hook into workflow (manual or scheduled)
4. Optionally add regression alerts (e.g., failing runs send Slack/Discord message)
