import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  capitalizeSentences,
  extractUrls,
  enforceHttps,
  rewriteDocsUrls,
  extractYear
} from '@workspace/transformations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gradingRoot = path.resolve(__dirname, '..', '..');
const resultsDir = path.join(gradingRoot, 'results');
const outputPath = path.join(resultsDir, 'transformations.json');

const TASKS = [
  'capitalize-sentences',
  'extract-urls',
  'enforce-https',
  'rewrite-docs',
  'extract-year'
];
const status = new Map<string, boolean>(TASKS.map((taskId) => [taskId, false]));

describe('transformations hidden suite', () => {
  it('capitalizes sentences with messy spacing', () => {
    const input = 'hello world.  how are you?i am fine!   thanks.';
    const output = capitalizeSentences(input);
    expect(output).toBe('Hello world. How are you? I am fine! Thanks.');
    status.set('capitalize-sentences', true);
  });

  it('extracts urls without trailing punctuation', () => {
    const text = 'Visit https://example.com/docs, http://foo.org?x=1, and https://sub.example.com.';
    expect(extractUrls(text)).toEqual([
      'https://example.com/docs',
      'http://foo.org?x=1',
      'https://sub.example.com'
    ]);
    status.set('extract-urls', true);
  });

  it('enforces https without touching existing https links', () => {
    const text = 'http://example.com and https://already.secure';
    expect(enforceHttps(text)).toBe('https://example.com and https://already.secure');
    status.set('enforce-https', true);
  });

  it('rewrites docs urls while skipping dynamic paths', () => {
    const text = [
      'Docs: http://example.com/docs/guide',
      'API: http://example.com/api/v1',
      'Skip CGI: http://example.com/cgi-bin/script',
      'Skip query: http://example.com/docs/guide?lang=en'
    ].join('\n');
    const rewritten = rewriteDocsUrls(text).split('\n');
    expect(rewritten[0]).toBe('Docs: https://docs.example.com/docs/guide');
    expect(rewritten[1]).toBe('API: https://example.com/api/v1');
    expect(rewritten[2]).toBe('Skip CGI: http://example.com/cgi-bin/script');
    expect(rewritten[3]).toBe('Skip query: http://example.com/docs/guide?lang=en');
    status.set('rewrite-docs', true);
  });

  it('extracts year or returns N/A when invalid', () => {
    expect(extractYear('12/31/1999')).toBe('1999');
    expect(extractYear('02/29/2000')).toBe('2000');
    expect(extractYear('13/01/2020')).toBe('N/A');
    expect(extractYear('2020-01-01')).toBe('N/A');
    status.set('extract-year', true);
  });
});

afterAll(() => {
  const results = TASKS.map((taskId) => ({ taskId, passed: status.get(taskId) === true }));
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
});
