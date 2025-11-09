import { describe, expect, it } from 'vitest';
import {
  findPrefixedWords,
  findEmbeddedToken,
  isStrongPassword,
  containsIPv6
} from '@workspace/puzzles.js';

describe('Puzzles', () => {
  it('should find prefixed words excluding exceptions', () => {
    const text = 'preview preflight prefix prevent prequel';
    const result = findPrefixedWords(text, 'pre', ['prefix', 'prevent']);
    expect([...result].sort()).toEqual(['preflight', 'prequel', 'preview']);
  });

  it('should find tokens only when embedded after digits', () => {
    const text = 'foo foo1 foo2bar 3foo-bar 4foobar foo5';
    const matches = findEmbeddedToken(text, 'foo');
    expect(matches.sort()).toEqual(['3foo', '4foo']);
  });

  it('should enforce strong password policy', () => {
    const valid = ['Abcd!23456', 'P@ssw0rd!#!'];
    const invalid = ['short1!', 'NoDigitsHere!', 'nouppercase1!', 'AAA111!!!', 'abcabcabcABC1!'];
    valid.forEach((sample) => expect(isStrongPassword(sample)).toBe(true));
    invalid.forEach((sample) => expect(isStrongPassword(sample)).toBe(false));
  });

  it('should detect ipv6 without mistaking ipv4', () => {
    const text = 'IPv6: 2001:db8::1 and IPv4: 192.168.0.1';
    expect(containsIPv6(text)).toBe(true);
    expect(containsIPv6('Just IPv4 127.0.0.1 here')).toBe(false);
  });
});
