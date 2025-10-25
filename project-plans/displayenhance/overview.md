# Display Enhancements Plan

## Goals
- Surface repository version (tag or commit hash) alongside each evaluation run.
- Provide a mid-level table summarizing runs per day with quick stats (profiles involved, total minutes, average vybes).
- Convert the run log into drill-down sections (accordion-style) for easier browsing.
- Publish per-run artifacts (zipped workspaces without `node_modules`) under `public/runs/<run-id>/<profile>/` and link to them from the dashboard.

## Proposed Architecture
1. **Version tagging**
   - During `runEvaluation`, capture `git describe --tags --dirty` (or fallback `main@<short-hash>`).
   - Store the string on the `vybes` block (`vybes.repoVersion`).
   - Aggregator copies the field into `vybes-runs.json` / `vybes-daily.json`.
   - Dashboard shows version labels in both daily and per-run UI.

2. **Daily run summary table**
   - Aggregator computes daily stats: list of profiles seen, total CLI minutes, average vybes.
   - Dashboard renders a sortable table between the current daily overview and run log. Clicking a row scrolls to its run sections.

3. **Drill-down run log**
   - Replace the flat table with grouped accordions (one per run). Summary row shows finished time, profile, eval, vybes.
   - Expanded content contains the existing metrics, module breakdown, version info, and links.

4. **Per-run zip artifacts**
   - After archiving a workspace, create `workspace.zip` (exclude `node_modules`, `workspace/node_modules` already filtered) and copy to `public/runs/<run-id>/<configId>/workspace.zip`.
   - Aggregator records the zip path + size for dashboard use.

## Implementation Steps
1. Add repo version detection in `run-evals.ts`; include it on each `EvalResult` and `results.json`.
2. Extend `scripts/build-vybes.js`:
   - read `vybes.repoVersion` and zip stats
   - emit per-day run summaries (profiles list, total minutes, average vybes)
   - capture per-run zip path/size for links
3. Update `public/index.html` + `public/vybestack.css` to:
   - add daily summary table
   - transform the run log into accordion drill-downs
   - display version/zip links
4. Ensure `npm run build:vybes` regenerates JSON + zips, and `public/run-local.sh` still works.
