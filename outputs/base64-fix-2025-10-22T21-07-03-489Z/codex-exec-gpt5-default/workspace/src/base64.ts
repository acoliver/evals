import { TextDecoder } from 'node:util';

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

export function encode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64');
}

export function decode(input: string): string {
  const normalized = input.trim();

  if (normalized === '') {
    return '';
  }

  if (!BASE64_PATTERN.test(normalized)) {
    throw new Error('Invalid Base64 input');
  }

  if (normalized.replace(/=/g, '').length === 0) {
    throw new Error('Invalid Base64 input');
  }

  const remainder = normalized.length % 4;

  if (remainder === 1) {
    throw new Error('Invalid Base64 input');
  }

  let padded = normalized;

  if (remainder === 2) {
    padded += '==';
  } else if (remainder === 3) {
    padded += '=';
  }

  let binary: Buffer;

  try {
    binary = Buffer.from(padded, 'base64');
  } catch {
    throw new Error('Invalid Base64 input');
  }

  try {
    return utf8Decoder.decode(binary);
  } catch {
    throw new Error('Invalid Base64 input');
  }
}
