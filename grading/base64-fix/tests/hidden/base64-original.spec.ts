import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encode, decode } from '@workspace/base64';
import { run } from '@workspace/index';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..', 'workspace');
const RESULTS_PATH = path.join(workspaceRoot, 'results', 'base64.json');

const TASKS = [
  'encode-typescript',
  'encode-base64-question', 
  'encode-tildes',
  'encode-foo-bar',
  'encode-emoji',
  'encode-check-symbol',
  'decode-standard',
  'decode-without-padding',
  'decode-reject-invalid',
  'cli-encode-success',
  'cli-decode-success', 
  'cli-error-handling'
];

const status = new Map<string, boolean>(TASKS.map((id) => [id, false]));

const fixtures = [
  { plain: 'TypeScript', base64: 'VHlwZVNjcmlwdA==' },
  { plain: 'Base64?', base64: 'QmFzZTY0Pw==' },
  { plain: '~~~', base64: 'fn5+' },
  { plain: 'foo/bar', base64: 'Zm9vL2Jhcg==' },
  { plain: '', base64: '8J+YgA==' },
  { plain: '[OK] check', base64: '4pyTIGNoZWNr' }
];

describe('encode', () => {
  it('encodes TypeScript to standard Base64', () => {
    expect(encode('TypeScript')).toBe('VHlwZVNjcmlwdA==');
    status.set('encode-typescript', true);
  });
  
  it('encodes question mark to standard Base64', () => {
    expect(encode('Base64?')).toBe('QmFzZTY0Pw==');
    status.set('encode-base64-question', true);
  });
  
  it('encodes tildes to standard Base64', () => {
    expect(encode('~~~')).toBe('fn5+');
    status.set('encode-tildes', true);
  });
  
  it('encodes forward slash to standard Base64', () => {
    expect(encode('foo/bar')).toBe('Zm9vL2Jhcg==');
    status.set('encode-foo-bar', true);
  });
  
  it('encodes unicode character to standard Base64', () => {
    expect(encode('')).toBe('8J+YgA==');
    status.set('encode-emoji', true);
  });
  
  it('encodes check symbol to standard Base64', () => {
    expect(encode('[OK] check')).toBe('4pyTIGNoZWNr');
    status.set('encode-check-symbol', true);
  });
});

describe('decode', () => {
  it('decodes TypeScript back to original string', () => {
    expect(decode('VHlwZVNjcmlwdA==')).toBe('TypeScript');
    status.set('decode-standard', true);
  });
  
  it('decodes unicode back to original string', () => {
    expect(decode('8J+YgA==')).toBe('');
    status.set('decode-unicode', true);
  });
  
  it('decodes forward slash back to original string', () => {
    expect(decode('Zm9vL2Jhcg==')).toBe('foo/bar');
    status.set('decode-slash', true);
  });

  it('accepts Base64 without padding', () => {
    expect(decode('aGVsbG8')).toBe('hello');
    status.set('decode-without-padding', true);
  });

  it('rejects clearly invalid payloads', () => {
    expect(() => decode('@@@')).toThrow();
    status.set('decode-reject-invalid', true);
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
  });

  it('prints decoded output and exits with zero', () => {
    const code = run(['--decode', '8J+YgA==']);
    expect(code).toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith('😀\n');
    expect(stderrWrite).not.toHaveBeenCalled();
  });

  it('surfaces argument errors to stderr and exits with one', () => {
    const code = run([]);
    expect(code).toBe(1);
    expect(stderrWrite).toHaveBeenCalled();
    expect(stdoutWrite).not.toHaveBeenCalled();
  });

  it('surfaces decode failures to stderr and exits with one', () => {
    const code = run(['--decode', '@@@']);
    expect(code).toBe(1);
    expect(stderrWrite).toHaveBeenCalled();
  });
});
