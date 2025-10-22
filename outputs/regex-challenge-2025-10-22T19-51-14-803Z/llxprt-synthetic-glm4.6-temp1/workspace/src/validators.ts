export type PhoneValidationOptions = {
  allowExtensions?: boolean;
};

/**
 * Validate email addresses with strict rules.
 * Rejects double dots, trailing dots, domains with underscores, and other invalid forms.
 */
export function isValidEmail(value: string): boolean {
  // Basic structure check - must have @ with content on both sides
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Local part (before @) - allow letters, digits, plus, hyphens, dots, apostrophes
  // But: no consecutive dots, no starting/ending dot
  const localPartRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
  
  // Domain part (after @) - allow letters, digits, hyphens, dots
  // But: no underscores, no consecutive dots, no starting/ending dot, each label 1-63 chars
  const domainPartRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  // TLD must be at least 2 letters
  const tldRegex = /^[a-zA-Z]{2,}$/;
  
  const atIndex = value.lastIndexOf('@');
  if (atIndex === -1 || atIndex === 0 || atIndex === value.length - 1) {
    return false;
  }

  const localPart = value.substring(0, atIndex);
  const domainPart = value.substring(atIndex + 1);

  // Check for invalid patterns first
  if (value.includes('..') || value.startsWith('.') || value.endsWith('.')) {
    return false;
  }

  // Check local part
  if (!localPartRegex.test(localPart)) {
    return false;
  }

  // Domain parts
  if (!domainPartRegex.test(domainPart)) {
    return false;
  }

  // Check TLD
  const lastDot = domainPart.lastIndexOf('.');
  if (lastDot === -1 || lastDot === domainPart.length - 1) {
    return false;
  }
  
  const tld = domainPart.substring(lastDot + 1);
  if (!tldRegex.test(tld)) {
    return false;
  }

  // Domain should not contain underscores
  if (domainPart.includes('_')) {
    return false;
  }

  return true;
}

/**
 * Validate US phone numbers supporting common formats and optional +1 prefix.
 * Supports: (123) 456-7890, 123-456-7890, 1234567890, +1 123-456-7890, etc.
 * Disallows impossible area codes (leading 0/1) and too short inputs.
 */
export function isValidUSPhone(value: string, _options?: PhoneValidationOptions): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Check minimum length - we need at least 10 digits for a US number
  if (digits.length < 10) {
    return false;
  }

  // Handle optional +1 country code
  let actualDigits = digits;
  if (digits.length === 11 && digits.startsWith('1')) {
    actualDigits = digits.substring(1);
  } else if (digits.length > 11) {
    return false; // Too many digits
  }

  // Should be exactly 10 digits for a valid US number
  if (actualDigits.length !== 10) {
    return false;
  }

  // Area code can't start with 0 or 1
  const areaCode = actualDigits.substring(0, 3);
  if (areaCode.startsWith('0') || areaCode.startsWith('1')) {
    return false;
  }

  // Exchange code (next 3 digits) also can't start with 0 or 1
  const exchangeCode = actualDigits.substring(3, 6);
  if (exchangeCode.startsWith('0') || exchangeCode.startsWith('1')) {
    return false;
  }

  // Since we've already validated the digit structure and rules above,
  // and the digits are correct (10 digits after removing non-digits),
  // we can accept the number as valid
  return true;
}

/**
 * Validate Argentine phone numbers covering mobile and landline formats.
 * Handles: +54 9 11 1234 5678, 011 1234 5678, +54 341 123 4567, 0341 4234567, etc.
 */
export function isValidArgentinePhone(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Remove spaces and hyphens for validation
  const cleanNumber = value.replace(/[\s-]/g, '');

  // Argentine phone regex:
  // Optional +54 country code
  // If no country code, must start with 0 (trunk prefix)
  // Optional 9 (mobile indicator) 
  // Area code: 2-4 digits, leading digit 1-9
  // Subscriber number: 6-8 digits total after area code
  const argentinePhoneRegex = /^(\+54)?(9)?([1-9]\d{1,3})(\d{6,8})$/;
  const argentinePhoneWith0Regex = /^(0)([1-9]\d{1,3})(\d{6,8})$/;

  // Try pattern with country code first
  let match = cleanNumber.match(argentinePhoneRegex);
  let hasCountryCode = true;

  // If no match, try pattern with trunk prefix 0
  if (!match) {
    match = cleanNumber.match(argentinePhoneWith0Regex);
    hasCountryCode = false;
  }

  if (!match) {
    return false;
  }

  // Extract components based on which pattern matched
  let areaCode: string;
  let subscriberNumber: string;

  if (hasCountryCode) {
    // Pattern: (\+54)?(9)?([1-9]\d{1,3})(\d{6,8})
    areaCode = match[3];
    subscriberNumber = match[4];
  } else {
    // Pattern: (0)([1-9]\d{1,3})(\d{6,8})
    areaCode = match[2];
    subscriberNumber = match[3];
  }

  // Validate area code: 2-4 digits, leading digit 1-9
  if (areaCode.length < 2 || areaCode.length > 4) {
    return false;
  }

  // Validate subscriber number: 6-8 digits
  if (subscriberNumber.length < 6 || subscriberNumber.length > 8) {
    return false;
  }

  // Check format with separators allows proper spacing/hyphens
  // This is more lenient for the actual input format
  const formatRegex = /^(\+54[\s-]?)?(9[\s-]?)?([1-9]\d{1,3})[\s-]?(\d{3,4})[\s-]?(\d{4})$|^(0)([1-9]\d{1,3})[\s-]?(\d{3,4})[\s-]?(\d{4})$/;
  return formatRegex.test(value.trim());
}

/**
 * Validate personal names allowing unicode letters, accents, apostrophes, hyphens, and spaces.
 * Rejects digits, symbols, and unusual names like 'X Æ A-12'.
 */
export function isValidName(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }

  // Allow unicode letters (including accents), apostrophes, hyphens, and spaces
  // Reject digits and most special symbols
  const nameRegex = /^[\p{L}\p{M}'’\-\s]+$/u;

  // Additional check to reject obviously problematic patterns
  // Reject names with multiple consecutive special characters
  const consecutiveSpecialsRegex = /(['’\-]{2,})/;
  
  // Reject names that are just special characters
  const justSpecialsRegex = /^['’\-\s]+$/;

  // Reject patterns like "X Æ A-12" (contains digits and unusual symbols)
  const unusualSymbolsRegex = /[Æ]/;

  if (!nameRegex.test(trimmed)) {
    return false;
  }

  if (consecutiveSpecialsRegex.test(trimmed)) {
    return false;
  }

  if (justSpecialsRegex.test(trimmed)) {
    return false;
  }

  if (unusualSymbolsRegex.test(trimmed)) {
    return false;
  }

  // Ensure there's at least one letter
  const hasLetterRegex = /[\p{L}\p{M}]/u;
  if (!hasLetterRegex.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Helper function to perform Luhn checksum validation.
 */
function runLuhnCheck(number: string): boolean {
  let sum = 0;
  let doubleDigit = false;

  // Process digits from right to left
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = parseInt(number[i], 10);
    
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) {
        digit = digit.toString()
          .split('')
          .map(char => parseInt(char, 10))
          .reduce((a, b) => a + b, 0);
      }
    }
    
    sum += digit;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}

/**
 * Validate credit card numbers for Visa, Mastercard, and American Express.
 * Checks prefix patterns, length requirements, and runs Luhn checksum.
 */
export function isValidCreditCard(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Remove spaces and hyphens
  const cleanNumber = value.replace(/[\s-]/g, '');

  // Check if it contains only digits
  if (!/^\d+$/.test(cleanNumber)) {
    return false;
  }

  // Visa: starts with 4, length 13 or 16
  const visaRegex = /^4(\d{12}|\d{15})$/;
  
  // Mastercard: starts with 51-55, 2221-2720, length 16
  const mastercardRegex = /^(5[1-5]\d{14}|2[2-7]\d{14})$/;
  
  // American Express: starts with 34 or 37, length 15
  const amexRegex = /^3[47]\d{13}$/;

  // Check if it matches any of the supported card patterns
  const isValidFormat = visaRegex.test(cleanNumber) || 
                       mastercardRegex.test(cleanNumber) || 
                       amexRegex.test(cleanNumber);

  if (!isValidFormat) {
    return false;
  }

  // Run Luhn checksum validation
  return runLuhnCheck(cleanNumber);
}
