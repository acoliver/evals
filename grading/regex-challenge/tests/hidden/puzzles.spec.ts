import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findPrefixedWords,
  findEmbeddedToken,
  isStrongPassword,
  containsIPv6
} from '@workspace/puzzles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gradingRoot = path.resolve(__dirname, '..', '..');
const resultsDir = path.join(gradingRoot, 'results');
const outputPath = path.join(resultsDir, 'puzzles.json');

const TASKS = [
  'prefixed-words',
  'embedded-token',
  'strong-password',
  'ipv6-detection'
];
const status = new Map<string, boolean>(TASKS.map((taskId) => [taskId, false]));

describe('puzzles hidden suite', () => {
  it('finds prefixed words excluding exceptions', () => {
    const text = 'preview preflight prefix prevent prequel';
    const result = findPrefixedWords(text, 'pre', ['prefix', 'prevent']);
    expect([...result].sort()).toEqual(['preflight', 'prequel', 'preview']);
    status.set('prefixed-words', true);
  });

  it('finds tokens only when embedded after digits', () => {
    const text = 'foo foo1 foo2bar 3foo-bar 4foobar foo5';
    const matches = findEmbeddedToken(text, 'foo');
    expect(matches.sort()).toEqual(['3foo', '4foo']);
    status.set('embedded-token', true);
  });

  it('enforces strong password policy', () => {
    const valid = ['Abcd!23456', 'P@ssw0rd!#!'];
    const invalid = ['short1!', 'NoDigitsHere!', 'nouppercase1!', 'AAA111!!!', 'abcabcabcABC1!'];
    valid.forEach((sample) => expect(isStrongPassword(sample)).toBe(true));
    invalid.forEach((sample) => expect(isStrongPassword(sample)).toBe(false));
    status.set('strong-password', true);
  });

  it('detects ipv6 without mistaking ipv4', () => {
    const text = 'IPv6: 2001:db8::1 and IPv4: 192.168.0.1';
    expect(containsIPv6(text)).toBe(true);
    expect(containsIPv6('Just IPv4 127.0.0.1 here')).toBe(false);
    status.set('ipv6-detection', true);
  });
});

afterAll(() => {
  const results = TASKS.map((taskId) => ({ taskId, passed: status.get(taskId) === true }));
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
});
