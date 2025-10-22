/**
 * Find words beginning with the prefix but excluding the listed exceptions.
 */
export function findPrefixedWords(text: string, prefix: string, exceptions: string[]): string[] {
  if (!text || typeof text !== 'string' || !prefix || typeof prefix !== 'string') {
    return [];
  }

  // Helper function to escape special regex characters in a string.
  function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Create a regex pattern to match words starting with the prefix
  // Word boundaries ensure we match whole words
  const wordPattern = new RegExp(`\\b${escapeRegExp(prefix)}\\w+\\b`, 'gi');
  
  const matches = text.match(wordPattern) || [];
  
  // Filter out exceptions (case-insensitive)
  return matches.filter(word => {
    const lowerWord = word.toLowerCase();
    return !exceptions.some(exception => 
      exception.toLowerCase() === lowerWord
    );
  });
}

/**
 * Find occurrences of a token only when it appears after a digit and not at the beginning of the string.
 * Uses lookaheads and lookbehinds to find the token in the right context.
 */
export function findEmbeddedToken(text: string, token: string): string[] {
  if (!text || typeof text !== 'string' || !token || typeof token !== 'string') {
    return [];
  }

  // Helper function to escape special regex characters in a string.
  function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Escape the token for regex
  const escapedToken = escapeRegExp(token);
  
  // Pattern: look for the token preceded by a digit
  // Using a different approach since lookbehind support may be limited
  const pattern = new RegExp(`(\\d${escapedToken})`, 'g');
  
  const matches = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

/**
 * Validate passwords according to security policy:
 * - At least 10 characters
 * - One uppercase, one lowercase, one digit, one symbol
 * - No whitespace
 * - No immediate repeated sequences (e.g., abab should fail)
 */
export function isStrongPassword(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Minimum length check
  if (value.length < 10) {
    return false;
  }

  // No whitespace allowed
  if (/\s/.test(value)) {
    return false;
  }

  // Character class requirements
  const hasUppercase = /[A-Z]/.test(value);
  const hasLowercase = /[a-z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(value);

  if (!hasUppercase || !hasLowercase || !hasDigit || !hasSymbol) {
    return false;
  }

  // Check for repeated sequences (e.g., abab, 1212, xyxy)
  // Look for any 2-character sequence repeated consecutively
  for (let i = 0; i < value.length - 3; i++) {
    const pair = value.substring(i, i + 2);
    const nextPair = value.substring(i + 2, i + 4);
    if (pair === nextPair) {
      return false;
    }
  }

  // Check for longer repeated patterns (3+ characters)
  for (let length = 3; length <= value.length / 2; length++) {
    for (let i = 0; i <= value.length - length * 2; i++) {
      const pattern = value.substring(i, i + length);
      const nextPattern = value.substring(i + length, i + length * 2);
      if (pattern === nextPattern) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Detect IPv6 addresses (including shorthand ::) and ensure IPv4 addresses do not trigger a positive result.
 */
export function containsIPv6(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // IPv6 address patterns
  // Full IPv6: eight groups of four hex digits separated by colons
  // Shortened forms with ::
  // Can have IPv4-mapped addresses (::ffff:192.168.0.1)
  
  // First, exclude pure IPv4 addresses
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(value.trim())) {
    return false;
  }

  // IPv6 regex patterns
  const ipv6Patterns = [
    // Full IPv6: x:x:x:x:x:x:x:x (8 groups)
    /(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}/,
    
    // IPv6 with :: (compressing one or more groups of zeros)
    /(?:[0-9a-fA-F]{1,4}:){1,7}:/,
    /::(?:[0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}/,
    /(?:[0-9a-fA-F]{1,4}:){1,6}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}/,
    /(?:[0-9a-fA-F]{1,4}:){1,5}::(?:[0-9a-fA-F]{1,4}:){0,4}[0-9a-fA-F]{1,4}/,
    /(?:[0-9a-fA-F]{1,4}:){1,4}::(?:[0-9a-fA-F]{1,4}:){0,3}[0-9a-fA-F]{1,4}/,
    /(?:[0-9a-fA-F]{1,4}:){1,3}::(?:[0-9a-fA-F]{1,4}:){0,2}[0-9a-fA-F]{1,4}/,
    /(?:[0-9a-fA-F]{1,4}:){1,2}::(?:[0-9a-fA-F]{1,4}:){0,1}[0-9a-fA-F]{1,4}/,
    /[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}/,
    
    // IPv6 loopback and unspecified
    /::1/,
    /::/,
    
    // IPv4-mapped IPv6 addresses
    /::ffff:(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/,
    
    // IPv6 with port
    /\[[0-9a-fA-F:]+]/
  ];

  // Check if any IPv6 pattern matches
  for (const pattern of ipv6Patterns) {
    if (pattern.test(value)) {
      return true;
    }
  }

  // More comprehensive IPv6 detection using word boundaries
  const comprehensiveIPv6Regex = /(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|::(?:[0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,6}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}::(?:[0-9a-fA-F]{1,4}:){0,4}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,4}::(?:[0-9a-fA-F]{1,4}:){0,3}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,3}::(?:[0-9a-fA-F]{1,4}:){0,2}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}::(?:[0-9a-fA-F]{1,4}:){0,1}[0-9a-fA-F]{1,4}|[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}|::1|::|::ffff:(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))/;

  return comprehensiveIPv6Regex.test(value);
}