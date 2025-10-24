import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encode, decode } from '@workspace/base64';
import { run } from '@workspace/index';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = [
  { plain: 'TypeScript', base64: 'VHlwZVNjcmlwdA==' },
  { plain: 'Base64?', base64: 'QmFzZTY0Pw==' },
  { plain: '~~~', base64: 'fn5+' },
  { plain: 'foo/bar', base64: 'Zm9vL2Jhcg==' },
  { plain: '😀', base64: '8J+YgA==' },
  { plain: '✓ check', base64: '4pyTIGNoZWNr' }
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..', 'workspace');
const resultsPath = path.join(workspaceRoot, 'results', 'base64.json');

const taskIds: string[] = [
  ...fixtures.map((_, index) => `encode-${index}`),
  ...fixtures.map((_, index) => `decode-${index}`),
  'decode-without-padding',
  'decode-rejects-invalid',
  'cli-encode-success',
  'cli-decode-success',
  'cli-argument-error',
  'cli-decode-error'
];

const taskStatus = new Map(taskIds.map((id) => [id, false]));

describe('encode', () => {
  fixtures.forEach(({ plain, base64 }, index) => {
    it(`encodes "${plain}" to standard Base64`, () => {
      expect(encode(plain)).toBe(base64);
      taskStatus.set(`encode-${index}`, true);
    });
  });
});

describe('decode', () => {
  fixtures.forEach(({ plain, base64 }, index) => {
    it(`decodes "${base64}" back to the original string`, () => {
      expect(decode(base64)).toBe(plain);
      taskStatus.set(`decode-${index}`, true);
    });
  });

  it('accepts Base64 without padding', () => {
    expect(decode('aGVsbG8')).toBe('hello');
    taskStatus.set('decode-without-padding', true);
  });

  it('rejects clearly invalid payloads', () => {
    expect(() => decode('@@@')).toThrow();
    taskStatus.set('decode-rejects-invalid', true);
  });
});

describe('run CLI helper', () => {
  const stdoutWrite = vi.spyOn(process.stdout, 'write');
  const stderrWrite = vi.spyOn(process.stderr, 'write');

  beforeEach(() => {
    stdoutWrite.mockClear();
    stderrWrite.mockClear();
  });

  afterEach(() => {
    stdoutWrite.mockReset();
    stderrWrite.mockReset();
  });

  it('prints encoded output and exits with zero', () => {
    const code = run(['--encode', 'foo/bar']);
    expect(code).toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith('Zm9vL2Jhcg==\n');
    expect(stderrWrite).not.toHaveBeenCalled();
    taskStatus.set('cli-encode-success', true);
  });

  it('prints decoded output and exits with zero', () => {
    const code = run(['--decode', '8J+YgA==']);
    expect(code).toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith('😀\n');
    expect(stderrWrite).not.toHaveBeenCalled();
    taskStatus.set('cli-decode-success', true);
  });

  it('surfaces argument errors to stderr and exits with one', () => {
    const code = run([]);
    expect(code).toBe(1);
    expect(stderrWrite).toHaveBeenCalled();
    expect(stdoutWrite).not.toHaveBeenCalled();
    taskStatus.set('cli-argument-error', true);
  });

  it('surfaces decode failures to stderr and exits with one', () => {
    const code = run(['--decode', '@@@']);
    expect(code).toBe(1);
    expect(stderrWrite).toHaveBeenCalled();
    taskStatus.set('cli-decode-error', true);
  });
});

afterAll(() => {
  const directory = path.dirname(resultsPath);
  fs.mkdirSync(directory, { recursive: true });
  const results = taskIds.map((taskId) => ({
    taskId,
    passed: taskStatus.get(taskId) === true
  }));
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf8');
});
