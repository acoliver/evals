/**
 * Encode plain text to standard Base64 using RFC 4648 canonical alphabet.
 * Uses the standard Base64 alphabet (A-Z, a-z, 0-9, +, /) with proper padding.
 */
export function encode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64');
}

/**
 * Decode standard Base64 text back to plain UTF-8.
 * Accepts valid Base64 input with or without padding and rejects invalid payloads.
 */
export function decode(input: string): string {
  // Validate the input contains only valid Base64 characters
  const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Pattern.test(input)) {
    throw new Error('Invalid Base64 input: contains non-Base64 characters');
  }

  // Check for invalid padding at the end of string
  if (input.endsWith('===')) {
    throw new Error('Invalid Base64 input: too much padding');
  }

  // Check for non-padding characters after padding
  const paddingIndex = input.indexOf('=');
  if (paddingIndex !== -1) {
    const afterPadding = input.slice(paddingIndex + 1);
    if (afterPadding !== '' && afterPadding !== '=') {
      throw new Error('Invalid Base64 input: padding not at end');
    }
    // Total length must be divisible by 4 when padding is present
    if (input.length % 4 !== 0) {
      throw new Error('Invalid Base64 input: incorrect length with padding');
    }
  }

  try {
    return Buffer.from(input, 'base64').toString('utf8');
  } catch (error) {
    throw new Error('Failed to decode Base64 input');
  }
}
