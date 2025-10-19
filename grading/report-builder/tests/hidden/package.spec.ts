import { describe, expect, it } from 'vitest';
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
  });
});
