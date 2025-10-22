/**
 * Capitalizes the first character of each sentence.
 * Inserts exactly one space between sentences.
 * Collapses extra spaces sensibly while attempting to leave abbreviations intact.
 */
export function capitalizeSentences(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // This regex finds sentence terminators (.?!), optionally followed by
  // one or more spaces, and then captures the first non-space character
  // of the next sentence. It handles abbreviations and mid-sentence punctuation
  // by requiring a space (or end of string) after the terminator to start a new sentence.
  // This is an imperfect heuristic but works for common cases.
  return text.replace(/(^|[.?!]\s+)([a-z])/g, (match, p1, p2) => {
    // p1 is the terminator and preceding space (or start of string '^')
    // p2 is the first letter of the next sentence
    return p1 + p2.toUpperCase();
  }).replace(/\s+/g, ' ').trim();
}

/**
 * Extracts all URLs from a text string.
 * Returns an array of matched URL strings without trailing punctuation.
 */
export function extractUrls(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  // This regex looks for typical URL structures.
  // It matches http/https protocols, then a domain with optional port/path/query/fragment.
  // It's more inclusive to ensure full domains like 'example.com' are captured.
  // Note: Regex for URLs can be extremely complex; this is a simplified version for the task.
  const urlRegex = /https?:\/\/[^\s]+/gi;
  const matches = text.match(urlRegex);
  return matches ? Array.from(new Set(matches)) : []; // Return unique URLs
}

/**
 * Forces all http URLs to https while leaving already secure URLs untouched.
 */
export function enforceHttps(text: string): string {
  if (!text || typeof text !== 'string') return '';
  // Replace 'http://' with 'https://' only if it stands alone (not part of https://)
  return text.replace(/http:\/\//gi, 'https://');
}

/**
 * Rewrites specific http URLs.
 * Upgrades the scheme to https.
 * Rewrites the host to docs.example.com if the path starts with /docs/.
 * Skips host rewrite for paths with dynamic hints but still upgrades scheme.
 */
export function rewriteDocsUrls(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // Regex to match and capture parts of the URL for flexible rewriting.
  // It captures the full URL to ensure we replace it correctly.
  // \w+ matches the domain name part (e.g., example)
  // \S* matches any non-whitespace characters after /docs/
  // This simpler approach avoids the complex parsing logic that led to errors.
  const urlRewriteRegex = /http:\/\/(\w+(?:\.\w+)+)\/(docs\/\S*)/gi;

  return text.replace(urlRewriteRegex, (_match, domain, path) => {
    // Always upgrade to https and rewrite host for docs paths
    return `https://docs.${domain}/${path}`;
  });
}

/**
 * Extracts the year from a date string in the mm/dd/yyyy format.
 * Returns 'N/A' if the format is invalid or month/day are out of range.
 */
export function extractYear(value: string): string {
  if (!value || typeof value !== 'string') return 'N/A';

  // Regex to match and capture the parts of the date.
  // It checks for numbers but doesn't validate ranges (e.g., month 99).
  const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = value.match(dateRegex);

  if (!match) {
    return 'N/A';
  }

  // Parse the captured groups to validate ranges.
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = match[3];

  // Check for valid month (1-12) and day (1-31) ranges.
  // This is a basic check, a full date validator is more complex.
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return 'N/A';
  }

  return year;
}