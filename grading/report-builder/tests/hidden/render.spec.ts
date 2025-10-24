import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..', 'workspace');
const fixturesDir = path.join(workspaceRoot, 'fixtures');
const cliPath = path.join(workspaceRoot, 'dist', 'cli', 'report.js');
const RESULTS_PATH = path.join(workspaceRoot, 'results', 'report-builder.json');

const ALL_TASKS = [
  'render-markdown-with-totals',
  'render-text-without-totals',
  'render-text-with-totals',
  'render-unsupported-format-failure',
  'render-missing-file-failure',
  'package-integrity'
] as const;

const taskStatus = new Map<string, boolean>(ALL_TASKS.map((taskId) => [taskId, false]));

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
    taskStatus.set('render-markdown-with-totals', true);
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
    taskStatus.set('render-text-without-totals', true);
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
    taskStatus.set('render-text-with-totals', true);
  });

  it('fails for unsupported format', () => {
    const result = runCli([
      path.join(fixturesDir, 'data.json'),
      '--format',
      'xml'
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Unsupported format/);
    taskStatus.set('render-unsupported-format-failure', true);
  });

  it('errors on missing files', () => {
    const result = runCli(['missing.json', '--format', 'markdown']);

    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toMatch(/unable|enoent|not found/);
    taskStatus.set('render-missing-file-failure', true);
  });
});

afterAll(() => {
  if (fs.existsSync(RESULTS_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8')) as Array<{
        taskId: string;
        passed: boolean;
      }>;
      for (const { taskId, passed } of existing) {
        if (taskStatus.has(taskId) && passed) {
          taskStatus.set(taskId, true);
        }
      }
    } catch {
      // ignore malformed existing file – we'll overwrite below
    }
  }

  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  const results = ALL_TASKS.map((taskId) => ({
    taskId,
    passed: taskStatus.get(taskId) === true
  }));
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf8');
});
