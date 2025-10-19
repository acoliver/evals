# Friendly Form Capture (Definitely Not A Scam)

Build a TypeScript + Express web application that serves a friendly international contact form, validates input, stores submissions, and then thanks the user with tongue-in-cheek copy about spamming them forever.

## Requirements

### Tech Stack
- TypeScript throughout (strict mode). Do **not** convert files to JavaScript.
- Express 4 with EJS templates for rendering pages.
- SQLite persistence powered by `sql.js` (the WASM build). Store data under `data/submissions.sqlite` by loading the file into memory and exporting after inserts.
- External stylesheet served from `/public/styles.css`; no inline styles.

### Form Behaviour
- GET `/` renders a responsive, modern-looking form collecting:
  - First name
  - Last name
  - Street address
  - City
  - State / Province / Region
  - Postal / Zip code (support letters and digits)
  - Country (allow free text or select; no hard-coded US only)
  - Email
  - Phone number (accept international formats, e.g. `+44 20 7946 0958`, `+54 9 11 1234-5678`)
- All labels must be associated with inputs (`for`/`id`) and inputs must use descriptive `name` attributes.
- Failed validation re-renders the form with inline error messages and previously entered values.
- Successful submission (POST `/submit`) inserts into SQLite, then issues a `302` redirect to `/thank-you`.

### Validation Rules
- Required fields must not be empty.
- Email must be plausibly valid (simple regex OK). When validation fails, redisplay the form with status 400 (or 200) rather than redirecting.
- Phone numbers can contain digits, spaces, parentheses, dashes, and a leading `+`.
- Postal codes must accept alphanumeric strings (handle UK “SW1A 1AA” and Argentine formats like “C1000” or “B1675”).
- Use server-side validation; do not rely solely on HTML5 attributes.

### Thank-You Page
- GET `/thank-you` renders a page that:
    - Contains humorous text implying the data may be used for incessant spam and possible identity theft (“Why did you give your info to a stranger on the internet?”). Exact phrasing is flexible but the idea must be obvious.
  - Links back to the form or offers a friendly note.

### Persistence
- Use the provided `db/schema.sql` to seed a `submissions` table (adjust columns as needed but keep the essentials). On startup, create the database file if it does not exist; after each insert, write the database back to disk so later runs can observe the data.
- Database should initialize automatically on server start; avoid manual setup steps.
- Closing the server should close the database to avoid locks.

### Styling
- Deliver a modern, accessible layout (flexbox or grid, reasonable color contrast, comfortable spacing).
- Keep CSS in `public/styles.css`. Ensure the file is non-empty and contains more than a reset.

### Server Lifecycle
- The compiled server (`dist/server.js`) must read `process.env.PORT` (default to 3000) and listen on that port.
- Provide a way to stop the server gracefully (close Express + DB). Hook into `SIGTERM` so the harness can tear it down.

### Commands To Run Before Finishing
```bash
npm run lint
npm run test:public
npm run typecheck
npm run build
```

## Testing Expectations
- Public tests will:
  - Ensure the form renders with all required fields.
  - Submit a sample payload and verify a redirect to `/thank-you`.
  - Query SQLite to check data persistence.
- Hidden tests will:
  - Submit international postal codes/phone numbers (including Argentine examples) to ensure validation passes.
  - Confirm invalid emails trigger form errors.
  - Check that `/thank-you` includes the expected humor and the first name.
  - Launch the compiled server, perform live requests, and confirm server shutdown works.

Stick to the provided dependencies and configuration files. Creativity in the copy and styling is encouraged—just meet the functional requirements and keep things tasteful (apart from the playful scam warning).
