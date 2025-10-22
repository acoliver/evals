import { describe, expect, it } from 'vitest';
import {
  findPrefixedWords,
  findEmbeddedToken,
  isStrongPassword,
  containsIPv6
} from '../../src/puzzles.js';

describe('puzzles (public smoke)', () => {
  it('finds prefixed words', () => {
    expect(findPrefixedWords('preview prevent prefix', 'pre', ['prevent'])).toContain('preview');
  });

  it('finds embedded tokens after digits', () => {
    expect(findEmbeddedToken('xfoo 1foo foo', 'foo')).toEqual(['1foo']);
  });

  it('accepts a trivially strong password', () => {
    expect(isStrongPassword('Abcdef!234')).toBe(true);
  });

  it('detects ipv6', () => {
    expect(containsIPv6('Address: 2001:db8::1')).toBe(true);
  });
});
