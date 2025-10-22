import { describe, expect, it } from 'vitest';
import {
  capitalizeSentences,
  extractUrls,
  enforceHttps,
  rewriteDocsUrls,
  extractYear
} from '../../src/transformations.js';

describe('transformations (public smoke)', () => {
  it('capitalizes simple sentences', () => {
    expect(capitalizeSentences('hello world. how are you?')).toBe('Hello world. How are you?');
  });

  it('extracts an obvious URL', () => {
    expect(extractUrls('Visit http://example.com today')).toEqual(['http://example.com']);
  });

  it('converts http to https', () => {
    expect(enforceHttps('http://example.com')).toBe('https://example.com');
  });

  it('rewrites docs url', () => {
    expect(rewriteDocsUrls('See http://example.com/docs/guide')).toContain('https://docs.example.com/docs/guide');
  });

  it('extracts the year from a simple date', () => {
    expect(extractYear('01/31/2024')).toBe('2024');
  });
});
