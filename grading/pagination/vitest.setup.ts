import '@testing-library/jest-dom/vitest';
import fetch from 'cross-fetch';

// Polyfill fetch for React tests
if (!globalThis.fetch) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
  globalThis.fetch = fetch as any;
}
