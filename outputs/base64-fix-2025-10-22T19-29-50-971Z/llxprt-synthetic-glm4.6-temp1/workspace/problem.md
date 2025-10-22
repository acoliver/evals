# Base64 CLI Repair

The CLI in this workspace is intended to encode and decode UTF-8 text using standard Base64 semantics. It exposes:

- `encode(text: string): string`
- `decode(text: string): string`
- `run(argv: string[]): number` – a thin wrapper that supports:
  - `node src/index.ts --encode "plain text"`
  - `node src/index.ts --decode "YmFzZTY0IGRhdGE="`

The current implementation is incorrect. Your goal is to restore compliance with the Base64 specification:

- Encoded output must use the canonical Base64 alphabet (`A-Z`, `a-z`, `0-9`, `+`, `/`) and include padding (`=`) when required.
- Decoding must accept valid Base64 input (with or without padding) and recover the original Unicode string, **and** must reject clearly invalid payloads by throwing an error so the CLI can signal failure.
- Keep the CLI behavior intact: return exit code `0` on success, `1` on failure, and write error messages to `stderr`.

You may refactor the module layout if needed, but preserve the exposed functions so tests continue to import them.

### Constraints
- **Do not** modify `tsconfig.json`, ESLint/Prettier configs, or `package.json`.
- Keep the project strictly typed—avoid falling back to `any` unless a type really is unavailable.

## Commands

```bash
npm install
npm run typecheck
npm run lint
npm run test:public
npm run start -- --encode "hello world"
```

This suite covers the essentials, but expect reviewers to poke at tricky inputs (padding, non-ASCII characters, binary-like data), so exercise those paths before you wrap up.
