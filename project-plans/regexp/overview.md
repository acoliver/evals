# Regex Challenge Eval – Working Notes

## Concept
Create a multi-task TypeScript project where each function (or small group) solves a specific regex validation or text transformation problem. Public tests provide easy examples; hidden tests hammer edge cases. Each task is graded independently so we can attribute partial credit later.

## Workspace Layout (proposal)
```
problems/regex-challenge/workspace/
├── package.json                # Vitest, ts-node, ESLint, etc.
├── tsconfig.json               # NodeNext, strict types
├── src/
│   ├── validators.ts           # email, phone, name, credit card, etc.
│   ├── transformations.ts      # capitalization, URL rewrites, sentence handling
│   ├── puzzles.ts              # negative lookahead/behind challenges, complex patterns
│   └── index.ts                # optional CLI or aggregator
├── tests/public/
│   ├── validators.spec.ts
│   ├── transformations.spec.ts
│   └── puzzles.spec.ts
├── problem.md                  # task description + command requirements
└── README.md                   # quickstart
```
Hidden suite mirrors this structure under `grading/regex-challenge/`, with per-task spec files reporting pass/fail individually.

## Regex Tasks (initial set)
### Validation
1. **Email** – Allow standard local+domain (letters, digits, dots, plus tags). Reject trailing dots/double dots/underscores in domain, but don’t require exotic RFC corners. Hidden tests include `name+tag@example.co.uk`, `user..dot@example.com`, `user@sub_domain.com`.
2. **US phone** – Accept `(123) 456-7890`, `123-456-7890`, `1234567890`, optional `+1` prefix. Reject invalid area codes (leading 0/1) and short lengths.
3. **Argentine phone** – Handle combos like `+54 9 11 1234-5678`, `011 1234-5678`, `+54 341 123 4567`. Allow optional trunk `0`, optional `9` for mobile, area codes 2–4 digits, subscriber segments 6–8 digits.
4. **Human names** – Permit letters, accents, apostrophes, hyphens, spaces. Reject digits/symbols. Hidden tests include `María-José`, `O’Connor`, and failing `X Æ A-12`.
5. **Credit card** – Regex for Visa/Mastercard/AmEx prefixes and lengths; follow-up code runs Luhn check.

### Transformations
6. **Sentence capitalization** – Given raw paragraph text, capitalize first character of each sentence (after `.?!`), collapse extra spaces appropriately. Hidden tests involve “messy” spacing and abbreviations.
7. **URL detection** – Regex to find URLs in text, differentiate Markdown/external braces, avoid trailing punctuation.
8. **Force HTTPS** – Replace `http://` with `https://` for detected URLs.
9. **Docs rewrite** – For URLs of the form `http://example.com/...`:
   - If path starts with `/docs/`, rewrite to `https://docs.example.com/...`.
   - Skip URLs containing `cgi-bin`, `?`, `&`, `.jsp`, or other dynamic hints.
   - Guard nested subpaths (e.g., `/docs/api/v1` OK; `/docs/file.jsp` unchanged).
10. **Extract year** – Take strings containing `mm/dd/yyyy`; return the `yyyy`. If format deviates (wrong separators, mm>12), return `N/A`.

### Regex Puzzles / Negative Conditions
11. **Starts-with but not repeating** – e.g., match words beginning with `pre` but excluding `prefix` and `prevent`. Hidden cases ensure lookahead usage.
12. **Inside but not starting** – Match `foo` only when preceded by a digit but not at string start (use lookbehind/forward).
13. **Password policy** – At least 10 chars, 1 upper, 1 lower, 1 digit, 1 symbol, no whitespace, no repeated sequences.
14. **IPv6 detection** – Recognize IPv6 addresses (including shorthand) and reject IPv4; optional follow-up ensures IPv4 detection is separate.

Stretch goal ideas: ISBN/IBAN checks, log-pattern parsing, advanced lookbehinds for context-specific replacements.

## Harness Behaviour
- Public tests show simple successes/failures.
- Hidden tests call each exported function individually and push them through diverse datasets. Each spec writes to a JSON summary (e.g., `grading/results/<task>.json`) so pass/fail per task is recorded.
- `grading/regex-challenge/package.json` scripts: `lint`, `typecheck`, `test:hidden` (Vitest). Hidden specs emit `{ taskId, passed, message }` arrays for later aggregation.
- Runner `evals/runRegexChallenge.ts` copies workspace, runs agent, executes lint/test/build, then hidden tests. After grading, it bundles per-task results into the run summary for future partial-credit scoring.

## Prompt Highlights (problem.md)
- Emphasise TypeScript-only, no config edits, rely on provided deps.
- Implement functions in `validators.ts`, `transformations.ts`, `puzzles.ts` explicitly using regex (with helper logic for Luhn/date checks).
- Call out international requirements (Argentine phones, accented names), tricky URL rules, and the sentence capitalization spec.
- Require finishing commands: `npm run lint`, `npm run test:public`, `npm run typecheck`, `npm run build`.

## Grading Overview
1. Runner installs workspace deps.
2. Agent executes prompt.
3. Runner performs lint/test/typecheck/build locally.
4. Sync to grading workspace, reinstall deps, run `npm run typecheck` and `npm run test:hidden`.
5. Hidden tests output per-task pass/fail; runner aggregates into evaluation results.

## Notes
- Make sure public tests mention the tricky areas so agents don’t assume US-only formats.
- Use `sql.js`/plain data files (no native deps) if persistence is needed for optional tasks. Otherwise keep everything pure functions to simplify runtime.
- Document how to run `npm run eval:regex` once the harness is wired into `package.json` and docs.
