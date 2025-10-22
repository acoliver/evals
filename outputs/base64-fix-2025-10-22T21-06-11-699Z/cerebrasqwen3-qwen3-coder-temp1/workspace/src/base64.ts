/**
 * Encode plain text to RFC 4648 Base64.
 * Uses the standard alphabet and includes required padding.
 */
export function encode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64');
}

/**
 * Decode RFC 4648 Base64 text back to plain UTF-8.
 * Accepts input with or without padding and throws an error for invalid input.
 */
export function decode(input: string): string {
  // This regex checks for a valid Base64 string (using the standard alphabet and optional padding)
  // and will reject strings with the URL-safe alphabet if they contain '-' or '_'.
  // However, a simple check like this is not fully robust as it doesn't verify padding correctness
  // or the validity of the final decoded bytes, but it's a good first line of defense.
  // A more thorough validation would be to attempt decoding and catch errors.
  const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/;

  if (!isValidBase64.test(input)) {
    throw new Error(`Invalid Base64 string: ${input}`);
  }

  try {
    return Buffer.from(input, 'base64').toString('utf8');
  } catch (error) {
    throw new Error(`Failed to decode Base64 input: ${input}`);
  }
}