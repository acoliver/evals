export type PhoneValidationOptions = {
  allowExtensions?: boolean;
};

/**
 * TODO: Implement robust email validation.
 * Requirements are described in problem.md.
 */
export function isValidEmail(value: string): boolean {
  throw new Error('TODO: implement isValidEmail');
}

/**
 * TODO: Implement US phone number validation supporting common separators and optional +1.
 */
export function isValidUSPhone(value: string, options?: PhoneValidationOptions): boolean {
  throw new Error('TODO: implement isValidUSPhone');
}

/**
 * TODO: Implement Argentine phone number validation covering mobile/landline formats.
 */
export function isValidArgentinePhone(value: string): boolean {
  throw new Error('TODO: implement isValidArgentinePhone');
}

/**
 * TODO: Validate personal names allowing unicode letters, accents, apostrophes, and hyphenation.
 */
export function isValidName(value: string): boolean {
  throw new Error('TODO: implement isValidName');
}

/**
 * TODO: Validate credit card numbers (length/prefix + Luhn checksum).
 */
export function isValidCreditCard(value: string): boolean {
  throw new Error('TODO: implement isValidCreditCard');
}
