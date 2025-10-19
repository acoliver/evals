# Regex Challenge Toolkit

Implement the utility functions in `src/validators.ts`, `src/transformations.ts`, and `src/puzzles.ts`. Each function should rely primarily on regular expressions (with minimal helper logic when required, e.g., Luhn checksum) to satisfy the scenarios below.

## Tasks

### Validators (`src/validators.ts`)
1. `isValidEmail(value)` – Accept typical addresses such as `name+tag@example.co.uk`. Reject double dots, trailing dots, domains with underscores, and other obviously invalid forms.
2. `isValidUSPhone(value, options?)` – Support `(123) 456-7890`, `123-456-7890`, `1234567890`, optional `+1` prefix. Disallow impossible area codes (leading 0/1) and too short inputs.
3. `isValidArgentinePhone(value)` – Handle landlines and mobiles: `+54 9 11 1234-5678`, `011 1234-5678`, `+54 341 123 4567`, etc. Optional trunk `0`, optional `9`, area codes 2–4 digits, subscriber segments 6–8 digits.
4. `isValidName(value)` – Permit unicode letters, accents, apostrophes, hyphens, spaces. Reject digits, symbols, and `X Æ A-12` style names.
5. `isValidCreditCard(value)` – Accept Visa/Mastercard/AmEx prefixes and lengths. Run a Luhn checksum.

### Text Transformations (`src/transformations.ts`)
6. `capitalizeSentences(text)` – Capitalize the first character of each sentence (after `.?!`), collapse extra spaces sensibly, leave abbreviations intact when possible.
7. `extractUrls(text)` – Return all URLs detected in the text without trailing punctuation.
8. `enforceHttps(text)` – Replace `http://` schemes with `https://` while leaving existing secure URLs untouched.
9. `rewriteDocsUrls(text)` – For URLs `http://example.com/...`:
   - Paths beginning with `/docs/` → rewrite to `https://docs.example.com/...`.
   - Skip URLs containing `cgi-bin`, `?`, `&`, `.jsp`, or other dynamic hints.
   - Preserve nested paths (e.g., `/docs/api/v1`).
10. `extractYear(value)` – Return the four-digit year for `mm/dd/yyyy`. If the string doesn’t match that format or month/day are invalid, return `N/A`.

### Regex Puzzles (`src/puzzles.ts`)
11. `findPrefixedWords(text, prefix, exceptions)` – Find words beginning with the prefix but excluding the listed exceptions.
12. `findEmbeddedToken(text, token)` – Return occurrences where the token appears after a digit and not at the start of the string (use lookaheads/lookbehinds).
13. `isStrongPassword(value)` – At least 10 characters, one uppercase, one lowercase, one digit, one symbol, no whitespace, no immediate repeated sequences (e.g., `abab` should fail).
14. `containsIPv6(value)` – Detect IPv6 addresses (including shorthand `::`) and ensure IPv4 addresses do not trigger a positive result.

Feel free to add helper functions (e.g., `runLuhnCheck`) but keep the exported signatures intact.

## Constraints
- TypeScript only. Do **not** downgrade files to JavaScript.
- Dependencies limited to those listed in `package.json` (no new packages).
- Do **not** modify `package.json`, `tsconfig.json`, `.eslintrc.cjs`, or `.prettierrc`.
- Tests should pass without mutating the public test files.

## Required Commands Before Finishing
```bash
npm run lint
npm run test:public
npm run typecheck
npm run build
```

## Eval Expectations
- Hidden tests supply extensive edge cases (international numbers, tricky URLs, malformed inputs) and report pass/fail per task.
- Follow the function contracts above; throwing or returning placeholder strings will fail grading.
- Creativity in regex construction is encouraged—as long as the behaviour is correct.
