import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..', 'workspace');
const fixturesDir = path.join(workspaceRoot, 'fixtures');
const cliPath = path.join(workspaceRoot, 'dist', 'cli', 'report.js');

const expectedMarkdown = `# Quarterly Financial Summary

Highlights include record revenue across regions and a healthy outlook for the next quarter.

## Entries
- **North Region** — $12345.67
- **South Region** — $23456.78
- **West Region** — $34567.89

**Total:** $70370.34
`;

const expectedText = `Quarterly Financial Summary
Highlights include record revenue across regions and a healthy outlook for the next quarter.
Entries:
- North Region: $12345.67
- South Region: $23456.78
- West Region: $34567.89
Total: $70370.34
`;

function normalize(content: string): string {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function runCli(args: string[]) {
  const result = spawnSync('node', [cliPath, ...args], {
    cwd: workspaceRoot,
    encoding: 'utf8'
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

describe('report CLI hidden validations', () => {
  it('renders markdown with totals', () => {
    const result = runCli([
      path.join(fixturesDir, 'data.json'),
      '--format',
      'markdown',
      '--includeTotals'
    ]);

    expect(result.status).toBe(0);
    expect(normalize(result.stdout)).toBe(normalize(expectedMarkdown));
  });

  it('renders plain text without totals', () => {
    const result = runCli([
      path.join(fixturesDir, 'data.json'),
      '--format',
      'text'
    ]);

    expect(result.status).toBe(0);
    const expectedWithoutTotals = expectedText.replace(/\nTotal:.*\n?$/, '');
    expect(normalize(result.stdout)).toBe(normalize(expectedWithoutTotals));
  });

  it('includes totals in text format when requested', () => {
    const result = runCli([
      path.join(fixturesDir, 'data.json'),
      '--format',
      'text',
      '--includeTotals'
    ]);

    expect(result.status).toBe(0);
    expect(normalize(result.stdout)).toBe(normalize(expectedText));
  });

  it('fails for unsupported format', () => {
    const result = runCli([
      path.join(fixturesDir, 'data.json'),
      '--format',
      'xml'
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Unsupported format/);
  });

  it('errors on missing files', () => {
    const result = runCli(['missing.json', '--format', 'markdown']);

    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toMatch(/unable|enoent|not found/);
  });
});
