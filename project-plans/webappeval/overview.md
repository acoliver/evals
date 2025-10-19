# Form Capture Eval – Working Notes

## Concept
- Lightweight TypeScript/Express scenario where the agent creates a single-page form collecting:
  `firstName`, `lastName`, `streetAddress`, `city`, `stateProvince`, `postalCode`, `country`, `email`, `phone`.
- Form posts to the server, data persists in SQLite, and the user is redirected to `/thank-you`.
- Thank-you page must display a short, humorous warning (e.g., “we may spam you incessantly and possibly steal your identity—why did you give your info to a stranger on the internet?”).
- Styling delivered via external CSS (flex/grid layout, pleasant colors, readable typography). No requirement to snapshot the UI, but file must contain meaningful styles.

## Key Behaviours to Exercise
- **Real server lifecycle**: hidden tests start the compiled server (`node dist/server.js`) on a random port, run HTTP interactions (Supertest or raw fetch), then shut it down cleanly.
- **International-friendly validation**:
  - Postal codes must tolerate letters/digits (e.g., “SW1A 1AA”, “75008”).
  - Phone numbers accept `+`, spaces, parentheses (e.g., “+44 20 7946 0958”, “(555) 123-4567”).
  - Email validated server-side (simple regex is fine, but must reject obvious garbage).
  - Required fields must not be empty; redisplay form with inline error messages.
- **Persistence**: submissions saved to SQLite (recommended: `sql.js` for sync simplicity). Database file lives at `data/submissions.sqlite`; schema created via `db/schema.sql`.
- **Templates**: use EJS (or similar) templates for `form` and `thank-you` pages. Form template must refill submitted values and render error lists when validation fails.

## Workspace Layout (scaffold)
```
problems/form-capture/workspace/
├── package.json                # Express, sql.js, ejs, vitest, supertest, cheerio
├── tsconfig.json               # NodeNext target, outDir dist
├── .eslintrc.cjs / .prettierrc # Standard strict configs
├── src/
│   ├── server.ts               # entrypoint stub (listens, registers routes)
│   ├── routes/formRouter.ts    # GET/POST handlers (empty shell)
│   ├── db/index.ts             # helper to init connection (todo)
│   └── templates/
│       ├── form.ejs            # placeholder markup
│       └── thank-you.ejs       # placeholder markup
├── db/schema.sql               # CREATE TABLE stub
├── public/styles.css           # basic reset + TODO comments
├── tests/public/
│   └── form.spec.ts            # smoke tests: GET /, POST sample, DB verification
└── README.md / problem.md      # final instructions to agent
```

## Prompt Highlights
- Prohibit modification of provided configs (package.json, tsconfig, ESLint, Prettier).
- Mention SQLite file path and expect synchronous `sql.js` usage (no async/await required).
- Require all labels/inputs have matching `for`/`name` attributes for accessibility.
- Specify that validation errors re-render the form with error messages near the problematic fields.
- Stress international-friendly input: no numeric-only `type="tel"` or `type="number"` for postal code/phone; stick to `type="text"` with pattern hints.
- Must redirect after successful submission (POST → 302 → `/thank-you`), preventing duplicate form resubmits on refresh.
- Thank-you page must repeat user first name and include the humorous “spam/identity theft” blurb exactly once.

## Testing Strategy
- **Public tests** (Vitest):
  1. GET `/` returns HTTP 200 with all expected fields/labels (Cheerio DOM assertions).
  2. POST sample US-style data → expect 302 redirect to `/thank-you`.
  3. After POST, query SQLite table `submissions` and verify stored values.
- **Hidden tests**:
  - POST with UK style postal code and international phone; ensure validation passes.
  - Submit invalid email -> expect status 400 and form re-render with error text.
  - Confirm `/thank-you` page contains the humorous disclaimer and includes submitted first name.
  - Assert `public/styles.css` includes at least one modern layout declaration (`display: flex` or `grid`).
  - Launch compiled server, perform GET/POST through HTTP client, stop server (using a PID file or event hook).

## Harness Updates
- Add `evals/runFormCapture.ts`:
  1. Copy workspace to temp dir.
  2. `npm install`.
  3. Run `npm run lint`, `npm run test:public`, `npm run build`.
  4. Start `node dist/server.js` with env `PORT=<random>`.
  5. Execute hidden tests (Supertest hitting actual port).
  6. Kill server (SIGTERM) and ensure process exits.
  7. Archive workspace/results.
- Root `package.json` gains `eval:form` script and `eval:all` includes it.
- Docs (`docs/overview.md`) summarise new scenario with commands to run.

## Evaluation Signals
- **Server Boot**: Did the agent implement a clean start/stop routine (closing DB, handling SIGTERM)?
- **Validation Robustness**: Hidden tests catch naive regex patterns or HTML-type misuse.
- **Persistence**: Failing to run migrations or forgetting to insert rows is caught after POST.
- **Spec Compliance**: Thank-you copy and first-name interpolation confirm spec awareness.
- **Styling Effort**: Non-empty CSS ensures they built at least minimal look-and-feel.

## Risks / TODO
- Decide whether templates must use EJS; keep instructions generic but tests should accommodate whichever templating engine we scaffold.
- Provide helper for DB initialization to avoid agents forgetting to run schema.
- Ensure harness cleans up `data/submissions.sqlite` per run (delete or copy from pristine workspace).
- Playwright optional; Supertest/Cheerio might suffice for this scale. Keep dependencies minimal.

