#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { loadReportData, type RenderOptions } from '../report.js';
import { availableFormats, getRenderer } from '../formats/index.js';

interface ParsedArgs extends RenderOptions {
  dataPath?: string;
  format?: string;
  outputPath?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const result: ParsedArgs = { includeTotals: false };

  let index = 0;
  while (index < args.length) {
    const token = args[index];

    if (token === '--includeTotals') {
      result.includeTotals = true;
      index += 1;
      continue;
    }

    if (token === '--format') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('The "--format" option requires a value');
      }
      result.format = value;
      index += 2;
      continue;
    }

    if (token.startsWith('--format=')) {
      const value = token.slice('--format='.length);
      if (!value) {
        throw new Error('The "--format" option requires a value');
      }
      result.format = value;
      index += 1;
      continue;
    }

    if (token === '--output') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('The "--output" option requires a value');
      }
      result.outputPath = value;
      index += 2;
      continue;
    }

    if (token.startsWith('--output=')) {
      const value = token.slice('--output='.length);
      if (!value) {
        throw new Error('The "--output" option requires a value');
      }
      result.outputPath = value;
      index += 1;
      continue;
    }

    if (token.startsWith('--')) {
      throw new Error(`Unknown option "${token}"`);
    }

    if (!result.dataPath) {
      result.dataPath = token;
      index += 1;
      continue;
    }

    throw new Error(`Unexpected argument "${token}"`);
  }

  return result;
}

function ensureOptions(parsed: ParsedArgs): asserts parsed is Required<Omit<ParsedArgs, 'outputPath'>> & { outputPath?: string } {
  if (!parsed.dataPath) {
    throw new Error('Missing required <data.json> argument');
  }

  if (!parsed.format) {
    throw new Error('Missing required "--format" option');
  }
}

function writeOutput(content: string, outputPath: string | undefined): void {
  if (!outputPath) {
    process.stdout.write(`${content}\n`);
    return;
  }

  const resolvedOutput = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, `${content}\n`, 'utf8');
}

function main(): void {
  try {
    const parsed = parseArgs(process.argv);
    ensureOptions(parsed);

    const renderer = getRenderer(parsed.format);
    const report = loadReportData(parsed.dataPath);
    const output = renderer(report, { includeTotals: parsed.includeTotals });
    writeOutput(output, parsed.outputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Unsupported format')) {
      const formatsStr = availableFormats().join(', ');
      process.stderr.write(`${message}. Available formats: ${formatsStr}\n`);
    } else {
      process.stderr.write(`${message}\n`);
    }
    process.exitCode = 1;
  }
}

main();
