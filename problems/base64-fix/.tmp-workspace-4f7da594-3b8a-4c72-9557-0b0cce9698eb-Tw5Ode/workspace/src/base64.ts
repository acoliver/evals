/**
 * Encode plain text to Base64.
 * Uses standard Base64 alphabet with padding.
 */
export function encode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64');
}

/**
 * Decode Base64 text back to plain UTF-8.
 * Uses standard Base64 alphabet, accepts padded and unpadded input.
 * Throws error for invalid Base64 input.
 */
export function decode(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Invalid Base64 input: input must be a string');
  }

  const trimmed = input.trim();
  
  // Empty input should decode to empty string
  if (trimmed === '') {
    return '';
  }
  
  // Check for invalid Base64 characters
  const validBase64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  if (!validBase64Regex.test(trimmed)) {
    throw new Error('Invalid Base64 input: contains invalid characters');
  }

  // Check for correct padding length and position
  if (trimmed.includes('=')) {
    const paddingIndex = trimmed.indexOf('=');
    const paddingLength = trimmed.length - paddingIndex;
    
    if (paddingLength > 3) {
      throw new Error('Invalid Base64 input: incorrect padding');
    }
    
    // All padding must be at the end
    if (!/^[=]*$/.test(trimmed.slice(paddingIndex))) {
      throw new Error('Invalid Base64 input: padding in middle');
    }
  }

  try {
    const result = Buffer.from(trimmed, 'base64').toString('utf8');
    return result;
  } catch (error) {
    throw new Error('Failed to decode Base64 input');
  }
}
