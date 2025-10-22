const BASE64_PADDED_REGEX =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BASE64_UNPADDED_REGEX = /^[A-Za-z0-9+/]*$/;

/**
 * Encode plain text to RFC 4648 Base64 (standard alphabet with padding).
 */
export function encode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64');
}

/**
 * Decode RFC 4648 Base64 text (with or without trailing padding).
 */
export function decode(input: string): string {
  const normalized = input.trim();

  if (normalized === '') {
    if (input === '') {
      return '';
    }
    throw new Error('Invalid Base64 input');
  }

  const hasPadding = normalized.includes('=');

  if (hasPadding) {
    if (!BASE64_PADDED_REGEX.test(normalized)) {
      throw new Error('Invalid Base64 input');
    }
    return Buffer.from(normalized, 'base64').toString('utf8');
  }

  if (!BASE64_UNPADDED_REGEX.test(normalized)) {
    throw new Error('Invalid Base64 input');
  }

  const remainder = normalized.length % 4;
  if (remainder === 1) {
    throw new Error('Invalid Base64 input');
  }

  const padded = normalized + '='.repeat((4 - remainder) % 4);

  return Buffer.from(padded, 'base64').toString('utf8');
}
