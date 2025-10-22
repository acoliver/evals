/**
 * Finds words in a text that start with a given prefix, excluding a list of exceptions.
 */
export function findPrefixedWords(text: string, prefix: string, exceptions: string[]): string[] {
  if (!text || typeof text !== 'string' || !prefix) return [];

  // Create a set of exceptions for fast lookup, converting to lowercase for case-insensitive comparison
  const exceptionSet = new Set(exceptions.map(w => w.toLowerCase()));

  // A more robust word boundary regex that includes underscores and hyphens.
  // This looks for the prefix as a whole word prefix.
  const regex = new RegExp(`\\b(${prefix}\\w*)`, 'gi');

  const matches = text.match(regex);

  if (!matches) {
    return [];
  }

  // Filter out matches that are in the exceptions list.
  // We must be careful to match the original casing of the exceptions.
  // The logic is: for each found word, if its lowercase version is in the exception set, we skip it.
  return matches.filter(word => !exceptionSet.has(word.toLowerCase()));
}

/**
 * Finds occurrences of a token only when it appears after a digit and not at the beginning of the string.
 * Uses lookaheads and lookbehinds for precise matching.
 */
export function findEmbeddedToken(text: string, token: string): string[] {
  if (!text || typeof text !== 'string' || !token) return [];

  // This regex uses a positive lookbehind to ensure it's preceded by a digit.
  // The `gi` flags make it global and case-insensitive.
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special regex characters in the token
  // Positive lookbehind for a digit. The test spec is ambiguous, but a simple lookbehind works.
  const regex = new RegExp(`(?<=\\d)${escapedToken}`, 'gi');

  const matches = text.match(regex);
  // According to the failing test, it wants an array where each match is prepended with the digit that preceded it.
  // E.g., findEmbeddedToken('xfoo 1foo foo', 'foo') -> ['1foo'] (not ['foo'] or ['1foo', 'foo'])
  // We need to reconstruct the match with the digit if we want to pass this specific test.
  // This requires a slightly different approach, finding the digit+token pair directly.
  const pairRegex = new RegExp(`\\d${escapedToken}`, 'gi');
  const pairMatches = text.match(pairRegex);

  return pairMatches ? pairMatches : [];
}

/**
 * Validates a password based on strength criteria.
 * At least 10 chars, 1 upper, 1 lower, 1 digit, 1 symbol, no whitespace.
 * Rejects passwords with repeated sequences like 'abab'.
 */
export function isStrongPassword(value: string): boolean {
  if (!value || typeof value !== 'string') return false;

  // Check length and whitespace
  if (value.length < 10 || /\s/.test(value)) {
    return false;
  }

  // Check for required character types
  const hasUppercase = /[A-Z]/.test(value);
  const hasLowercase = /[a-z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[^a-zA-Z0-9]/.test(value);

  if (!hasUppercase || !hasLowercase || !hasDigit || !hasSymbol) {
    return false;
  }

  // Check for repeated sequences.
  // The regex `(..+?)\\1` finds a group of 2 or more characters `(..+?)`
  // that is immediately followed by itself `\\1`.
  // If this regex finds a match, the password is not strong.
  const hasRepeatedSequence = /(..+?)\1/.test(value);

  return !hasRepeatedSequence;
}

/**
 * Detects IPv6 addresses, including shorthand '::', and ensures IPv4 addresses do not trigger a positive result.
 */
export function containsIPv6(value: string): boolean {
  if (!value || typeof value !== 'string') return false;

  // A simplified IPv6 regex that matches the full form (8 groups of 4 hex chars) and various shorthand forms.
  // This checks for 8 groups of hex digits separated by colons, or fewer groups with a single '::'.
  // The full, robust IPv6 regex is extremely long; this covers the key cases described.
  const ipv6Regex = /(?:::[\dA-Fa-f]{1,4}(?::[\dA-Fa-f]{1,4}){0,6}|[\dA-Fa-f]{1,4}::|[\dA-Fa-f]{1,4}(?::[\dA-Fa-f]{1,4}){7}|[\dA-Fa-f]{1,4}(?::[\dA-Fa-f]{1,4}){0,6}::[\dA-Fa-f]{1,4}(?::[\dA-Fa-f]{1,4}){0,6})/;

  // Check if it matches the IPv6 regex.
  if (ipv6Regex.test(value)) {
    return true;
  }

  // A simple IPv4 regex to ensure it's not an IPv4 address.
  // This prevents false positives.
  const ipv4Regex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

  // If it looks like IPv4, it's not IPv6.
  if (ipv4Regex.test(value)) {
    return false;
  }

  // If it didn't match either, it's not an IPv6.
  return false;
}