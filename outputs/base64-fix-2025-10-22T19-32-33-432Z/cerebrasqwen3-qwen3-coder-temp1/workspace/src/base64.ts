/**
 * Encode plain text to Base64.
 * Uses the canonical Base64 alphabet (A-Z, a-z, 0-9, +, /) and includes padding (=) when required.
 */
export function encode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64');
}

/**
 * Decode Base64 text back to plain UTF-8.
 * Accepts valid Base64 input (with or without padding) and recovers the original Unicode string.
 * Rejects clearly invalid payloads by throwing an error.
 */
export function decode(input: string): string {
  // To reject invalid payloads, we first check if the input string consists only of valid base64 characters.
  // The valid characters are A-Z, a-z, 0-9, '+', '/', and '='.
  // The padding character '=' is only valid at the end of the string.
  // A more robust way is to let Buffer.from try to decode it and catch errors for invalid characters.
  // However, Buffer.from is quite forgiving. We will add a regex check to ensure the input
  // conforms to the general structure of a base64 string before passing it to Buffer.from.
  const cleanedInput = input.replace(/\s/g, ''); // Remove any whitespace as per RFC 4648, Section 3.3
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanedInput)) {
    throw new Error('Invalid Base64 input string');
  }

  try {
    return Buffer.from(cleanedInput, 'base64').toString('utf8');
  } catch (error) {
    // This error case is unlikely to be hit with the regex check, but is here for safety.
    throw new Error('Failed to decode Base64 input');
  }
}