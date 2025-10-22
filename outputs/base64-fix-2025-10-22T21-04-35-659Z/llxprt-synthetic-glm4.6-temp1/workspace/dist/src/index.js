#!/usr/bin/env node
import { decode, encode } from './base64.js';
function parseArgs(argv) {
    if (argv.length < 2) {
        throw new Error('Usage: --encode <text> | --decode <base64>');
    }
    const [flag, ...rest] = argv;
    const value = rest.join(' ').trim();
    if (!value) {
        throw new Error('Provide a value to encode or decode.');
    }
    if (flag === '--encode') {
        return { command: 'encode', value };
    }
    if (flag === '--decode') {
        return { command: 'decode', value };
    }
    throw new Error(`Unknown flag: ${flag}`);
}
export function run(argv) {
    try {
        const { command, value } = parseArgs(argv);
        const result = command === 'encode' ? encode(value) : decode(value);
        process.stdout.write(`${result}\n`);
        return 0;
    }
    catch (error) {
        const message = error instanceof Error && error.message ? error.message : 'Unexpected error';
        process.stderr.write(`${message}\n`);
        return 1;
    }
}
if (import.meta.url === `file://${process.argv[1]}`) {
    const exitCode = run(process.argv.slice(2));
    process.exitCode = exitCode;
}
