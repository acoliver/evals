import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  isValidUSPhone,
  isValidArgentinePhone,
  isValidName,
  isValidCreditCard
} from '@workspace/validators.js';

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
  });

  it('validates Argentine numbers across formats', () => {
    const valid = [
      '+54 9 11 1234 5678',
      '011 1234 5678',
      '+54 341 123 4567',
      '0341 4234567'
    ];
    const invalid = [
      '+54 123 456',
      '1234 567890',
      '+54 9 01 1234 5678',
      '+54 9 11 123-456'
    ];
    valid.forEach((sample) => expect(isValidArgentinePhone(sample)).toBe(true));
    invalid.forEach((sample) => expect(isValidArgentinePhone(sample)).toBe(false));
  });

  it('validates human names with unicode characters', () => {
    const valid = ['María-José Carreño Quiñones', "O'Connor", 'Anne-Marie'];
    const invalid = ['X Æ A-12', '12345', 'Jane_Doe'];
    valid.forEach((sample) => expect(isValidName(sample)).toBe(true));
    invalid.forEach((sample) => expect(isValidName(sample)).toBe(false));
  });

  it('validates credit card numbers with luhn', () => {
    const valid = ['4111111111111111', '5500000000000004', '340000000000009'];
    const invalid = ['4111111111111112', '1234567890123456', ''];
    valid.forEach((sample) => expect(isValidCreditCard(sample)).toBe(true));
    invalid.forEach((sample) => expect(isValidCreditCard(sample)).toBe(false));
  });
});
