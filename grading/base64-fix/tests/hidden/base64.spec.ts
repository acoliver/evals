import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encode, decode } from '@workspace/base64';
import { run } from '@workspace/index';

const fixtures = [
  { plain: 'TypeScript', base64: 'VHlwZVNjcmlwdA==' },
  { plain: 'Base64?', base64: 'QmFzZTY0Pw==' },
  { plain: '~~~', base64: 'fn5+' },
  { plain: 'foo/bar', base64: 'Zm9vL2Jhcg==' },
  { plain: '😀', base64: '8J+YgA==' },
  { plain: '✓ check', base64: '4pyTIGNoZWNr' }
];

describe('encode', () => {
  for (const { plain, base64 } of fixtures) {
    it(`encodes "${plain}" to standard Base64`, () => {
      expect(encode(plain)).toBe(base64);
    });
  }
});

describe('decode', () => {
  for (const { plain, base64 } of fixtures) {
    it(`decodes "${base64}" back to the original string`, () => {
      expect(decode(base64)).toBe(plain);
    });
  }

  it('accepts Base64 without padding', () => {
    expect(decode('aGVsbG8')).toBe('hello');
  });

  it('rejects clearly invalid payloads', () => {
    expect(() => decode('@@@')).toThrow();
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
