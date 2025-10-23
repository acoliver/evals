import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..', 'workspace');
const baselinePackagePath = path.resolve(
  workspaceRoot,
  '..',
  '..',
  '..',
  'problems',
  'report-builder',
  'workspace',
  'package.json'
);

const RESULTS_PATH = path.join(workspaceRoot, 'results', 'report-builder.json');
const ALL_TASKS = [
  'render-markdown-with-totals',
  'render-text-without-totals',
  'render-text-with-totals',
  'render-unsupported-format-failure',
  'render-missing-file-failure',
  'package-integrity'
] as const;

let packageIntegrityPassed = false;

function readJson(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

describe('workspace package.json integrity', () => {
  it('matches the baseline dependencies/scripts', () => {
    const workspacePackage = readJson(path.join(workspaceRoot, 'package.json')) as Record<
      string,
      unknown
    >;
    const baselinePackage = readJson(baselinePackagePath) as Record<string, unknown>;

    expect(workspacePackage.dependencies).toEqual(baselinePackage.dependencies);
    expect(workspacePackage.devDependencies).toEqual(baselinePackage.devDependencies);
    expect(workspacePackage.scripts).toEqual(baselinePackage.scripts);
    packageIntegrityPassed = true;
  });
});

afterAll(() => {
  const statusMap = new Map<string, boolean>(ALL_TASKS.map((taskId) => [taskId, false]));

  if (fs.existsSync(RESULTS_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8')) as Array<{
        taskId: string;
        passed: boolean;
      }>;
      for (const { taskId, passed } of existing) {
        if (statusMap.has(taskId)) {
          statusMap.set(taskId, passed);
        }
      }
    } catch {
      // ignore malformed existing content
    }
  }

  statusMap.set('package-integrity', packageIntegrityPassed);

  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  const results = ALL_TASKS.map((taskId) => ({
    taskId,
    passed: statusMap.get(taskId) === true
  }));
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf8');
});
