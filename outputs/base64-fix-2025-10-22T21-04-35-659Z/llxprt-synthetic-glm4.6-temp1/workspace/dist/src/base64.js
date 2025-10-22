/**
 * Encode plain text to Base64 using canonical RFC 4648 alphabet.
 * Includes proper padding with '=' characters when required.
 */
export function encode(input) {
    // Use standard Base64 encoding which includes '+' and '/' characters
    // and automatically adds padding
    return Buffer.from(input, 'utf8').toString('base64');
}
/**
 * Decode Base64 text back to plain UTF-8 using canonical RFC 4648.
 * Accepts valid Base64 input (with or without padding) and throws error for invalid input.
 */
export function decode(input) {
    if (!input) {
        throw new Error('Empty input cannot be decoded');
    }
    // Validate Base64 input - check for valid Base64 characters only
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(input)) {
        throw new Error('Invalid Base64 input: contains invalid characters');
    }
    // Check for invalid padding
    const paddingStart = input.indexOf('=');
    if (paddingStart !== -1) {
        const padding = input.slice(paddingStart);
        if (!/^[=]{1,2}$/.test(padding)) {
            throw new Error('Invalid Base64 input: invalid padding');
        }
        // Padding can only appear at the end
        if (paddingStart < input.length - 2) {
            throw new Error('Invalid Base64 input: padding in wrong position');
        }
    }
    try {
        // Use standard Base64 decoding
        const result = Buffer.from(input, 'base64').toString('utf8');
        return result;
    }
    catch (error) {
        throw new Error('Failed to decode Base64 input');
    }
}
