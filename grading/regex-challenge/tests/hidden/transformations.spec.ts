import { describe, expect, it } from 'vitest';
import {
  capitalizeSentences,
  extractUrls,
  enforceHttps,
  rewriteDocsUrls,
  extractYear
} from '@workspace/transformations.js';

describe('transformations hidden suite', () => {
  it('capitalizes sentences with messy spacing', () => {
    const input = 'hello world.  how are you?i am fine!   thanks.';
    const output = capitalizeSentences(input);
    expect(output).toBe('Hello world. How are you? I am fine! Thanks.');
  });

  it('extracts urls without trailing punctuation', () => {
    const text = 'Visit https://example.com/docs, http://foo.org?x=1, and https://sub.example.com.';
    expect(extractUrls(text)).toEqual([
      'https://example.com/docs',
      'http://foo.org?x=1',
      'https://sub.example.com'
    ]);
  });

  it('enforces https without touching existing https links', () => {
    const text = 'http://example.com and https://already.secure';
    expect(enforceHttps(text)).toBe('https://example.com and https://already.secure');
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
    expect(rewritten[2]).toBe('Skip CGI: https://example.com/cgi-bin/script');
    expect(rewritten[3]).toBe('Skip query: https://example.com/docs/guide?lang=en');
  });

  it('extracts year or returns N/A when invalid', () => {
    expect(extractYear('12/31/1999')).toBe('1999');
    expect(extractYear('02/29/2000')).toBe('2000');
    expect(extractYear('13/01/2020')).toBe('N/A');
    expect(extractYear('2020-01-01')).toBe('N/A');
  });
});
