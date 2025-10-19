import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isValidEmail,
  isValidUSPhone,
  isValidArgentinePhone,
  isValidName,
  isValidCreditCard
} from '@workspace/validators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gradingRoot = path.resolve(__dirname, '..', '..');
const resultsDir = path.join(gradingRoot, 'results');
const outputPath = path.join(resultsDir, 'validators.json');

const TASKS = [
  'email-validation',
  'us-phone-validation',
  'argentina-phone-validation',
  'name-validation',
  'credit-card-validation'
];
const status = new Map<string, boolean>(TASKS.map((taskId) => [taskId, false]));

describe('validators hidden suite', () => {
  it('validates emails with tricky cases', () => {
    const validSamples = [
      'name+tag@example.co.uk',
      'user.name@example.travel',
      'a_b-c.d@example.io'
    ];
    const invalidSamples = [
      'user..dot@example.com',
      'user.@example.com',
      'user@example_domain.com',
      'user@example.com\nmalicious'
    ];
    validSamples.forEach((sample) => expect(isValidEmail(sample)).toBe(true));
    invalidSamples.forEach((sample) => expect(isValidEmail(sample)).toBe(false));
    status.set('email-validation', true);
  });

  it('validates US phone numbers thoroughly', () => {
    const valid = [
      '+1 (212) 555-7890',
      '212-555-7890',
      '(415)555-0199',
      '4155550199'
    ];
    const invalid = [
      '012-555-7890',
      '212-55-7890',
      '555-012-3456',
      '1 (800) FLOWERS'
    ];
    valid.forEach((sample) => expect(isValidUSPhone(sample)).toBe(true));
    invalid.forEach((sample) => expect(isValidUSPhone(sample)).toBe(false));
    status.set('us-phone-validation', true);
  });

  it('validates Argentine numbers across formats', () => {
    const valid = [
      '+54 9 11 1234-5678',
      '011 1234-5678',
      '+54 341 123 4567',
      '0341-423-4567'
    ];
    const invalid = [
      '+54 123 456',
      '1234-567890',
      '+54 9 111 1234-5678',
      '+54 9 11 123-456'
    ];
    valid.forEach((sample) => expect(isValidArgentinePhone(sample)).toBe(true));
    invalid.forEach((sample) => expect(isValidArgentinePhone(sample)).toBe(false));
    status.set('argentina-phone-validation', true);
  });

  it('validates human names with unicode characters', () => {
    const valid = ['María-José Carreño Quiñones', "O'Connor", 'Anne-Marie'];
    const invalid = ['X Æ A-12', '12345', 'Jane_Doe'];
    valid.forEach((sample) => expect(isValidName(sample)).toBe(true));
    invalid.forEach((sample) => expect(isValidName(sample)).toBe(false));
    status.set('name-validation', true);
  });

  it('validates credit card numbers with luhn', () => {
    const valid = ['4111111111111111', '5500000000000004', '340000000000009'];
    const invalid = ['4111111111111112', '1234567890123456', ''];
    valid.forEach((sample) => expect(isValidCreditCard(sample)).toBe(true));
    invalid.forEach((sample) => expect(isValidCreditCard(sample)).toBe(false));
    status.set('credit-card-validation', true);
  });
});

afterAll(() => {
  const results = TASKS.map((taskId) => ({ taskId, passed: status.get(taskId) === true }));
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
});
