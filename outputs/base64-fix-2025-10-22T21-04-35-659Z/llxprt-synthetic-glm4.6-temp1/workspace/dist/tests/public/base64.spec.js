import { describe, expect, it } from 'vitest';
import { decode, encode } from '../../src/base64.js';
describe('Base64 helpers (public)', () => {
    it('encodes plain ASCII text with padding', () => {
        const result = encode('hello');
        expect(result).toBe('aGVsbG8=');
    });
    it('decodes standard Base64 text', () => {
        const result = decode('aGVsbG8=');
        expect(result).toBe('hello');
    });
});
