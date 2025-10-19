import { describe, expect, it } from 'vitest';
import { isValidEmail, isValidUSPhone, isValidArgentinePhone, isValidName, isValidCreditCard } from '../../src/validators.js';

// Public tests are intentionally light; hidden tests cover tricky cases.
describe('validators (public smoke)', () => {
  it('accepts a simple email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('rejects an obviously bad email', () => {
    expect(isValidEmail('user@@example..com')).toBe(false);
  });

  it('accepts a standard US phone number', () => {
    expect(isValidUSPhone('123-456-7890')).toBe(true);
  });

  it('accepts a common Argentine phone format', () => {
    expect(isValidArgentinePhone('+54 341 123 4567')).toBe(true);
  });

  it('accepts a basic name', () => {
    expect(isValidName('Jane Doe')).toBe(true);
  });

  it('accepts a plausible credit card number', () => {
    expect(isValidCreditCard('4111111111111111')).toBe(true);
  });
});
