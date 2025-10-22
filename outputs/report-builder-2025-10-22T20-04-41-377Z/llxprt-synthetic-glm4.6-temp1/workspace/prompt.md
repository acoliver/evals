You are assisting with the "Report Builder" TypeScript project.
Implement a clean CLI and supporting modules that read structured JSON, render markdown or text reports, keep formatters modular for future extensions, and rely solely on built-in Node APIs. Do not modify the provided configuration files or dependencies.
After completing the work, report any command failures honestly.

Problem context:

# Report Builder CLI

Implement a clean, idiomatic TypeScript command-line tool that renders reports from JSON input.

## Requirements

### CLI Usage
- Entry point: `src/cli/report.ts` (compiled to `dist/cli/report.js`).
- Invocation after building: `node dist/cli/report.js <data.json> --format <format> [--output <path>] [--includeTotals]`.
- Supported formats: `markdown`, `text`. Reject unknown formats with an error containing `Unsupported format`.
- Output goes to stdout unless `--output` is provided.
- Parse arguments using Node’s standard library (no third-party parsers).
- Ensure TypeScript imports use `.js` extensions (e.g., `import { renderMarkdown } from '../formats/markdown.js';`) so emitted JavaScript resolves correctly under NodeNext.

### Data Model
- JSON schema matches `fixtures/data.json`:
  ```json
  {
    "title": "Quarterly Financial Summary",
    "summary": "Highlights include record revenue...",
    "entries": [
      { "label": "North Region", "amount": 12345.67 },
      { "label": "South Region", "amount": 23456.78 },
      { "label": "West Region", "amount": 34567.89 }
    ]
  }
  ```
- Compute totals by summing `entries[].amount`. Amounts must render with two decimal places.
- Validate input and report helpful errors for malformed JSON or missing fields.

### Formatting Rules
- Markdown format: print `# <title>`, blank line, summary, blank line, `## Entries`, bullet list `- **<label>** — $<amount>`, optional final `**Total:** $<amount>` when `--includeTotals` is provided.
- Text format: print title, summary, `Entries:` heading, bullet list `- <label>: $<amount>`, optional `Total: $<amount>` when totals are requested.
- Render amounts exactly as `$12345.67` (two decimal places, no thousands separators) so the fixtures and totals align.
- Output comparison normalises whitespace (trim + collapse blank lines) before checking results, so focus on content and order.

- Keep the CLI minimal and delegate rendering to format modules under `src/formats/` (create at least `markdown.ts` and `text.ts`).
- Export a consistent interface from each formatter so adding new formats is easy (e.g., via a map of `format -> renderer`).
- Share typed interfaces for report data and options.
- Maintain strict TypeScript/ESLint/Prettier rules as configured.

- Do **not** modify `package.json`, `tsconfig.json`, `.eslintrc.cjs`, or `.prettierrc` (no new dependencies, scripts, or settings).
- Rely only on built-in Node modules.
- Before finishing, run:
  ```bash
  npm run lint
  npm run test:public
  npm run typecheck
  npm run build
  node dist/cli/report.js fixtures/data.json --format markdown --includeTotals
  ```

Expect reviewers to exercise both formats and error handling by invoking the compiled CLI in `dist/`, so treat the build artifacts as the source of truth.


Before finishing, run these commands and report any failures honestly:
npm run typecheck, npm run lint, npm run test:public, npm run build

IMPORTANT: You must run lint and the build as a final step and resolve ANY lint or build errors before finishing.
Fix all ESLint errors (unused variables, any types, etc.) and ensure the build completes successfully.