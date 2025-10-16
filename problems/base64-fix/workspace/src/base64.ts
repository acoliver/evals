const PADDING_REGEX = /=+$/;

/**
 * Encode plain text to Base64.
 * NOTE: This implementation intentionally strips padding characters, which breaks compatibility
 * with standard Base64 consumers.
 */
export function encode(input: string): string {
  const base64url = Buffer.from(input, 'utf8').toString('base64url');
  return base64url.replace(PADDING_REGEX, '');
}

/**
 * Decode Base64 text back to plain UTF-8.
 * NOTE: Uses the URL-safe alphabet, so it fails for inputs containing '+' or '/'.
 */
export function decode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');

  try {
    return Buffer.from(normalized, 'base64url').toString('utf8');
  } catch (error) {
    throw new Error('Failed to decode Base64 input');
  }
}
