#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import type { ReportData, ReportOptions, Formatter } from '../types.js';
import { renderMarkdown } from '../formats/markdown.js';
import { renderText } from '../formats/text.js';

interface CliArgs {
  inputFile: string;
  format: string;
  outputPath?: string;
  includeTotals: boolean;
}

function parseArguments(args: string[]): CliArgs {
  const parsed: CliArgs = {
    inputFile: '',
    format: '',
    includeTotals: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (arg === '--format' && i + 1 < args.length) {
      parsed.format = args[i + 1];
      i += 2;
    } else if (arg === '--output' && i + 1 < args.length) {
      parsed.outputPath = args[i + 1];
      i += 2;
    } else if (arg === '--includeTotals') {
      parsed.includeTotals = true;
      i += 1;
    } else if (!parsed.inputFile) {
      parsed.inputFile = arg;
      i += 1;
    } else {
      i += 1;
    }
  }

  return parsed;
}

function validateReportData(data: unknown): ReportData {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid JSON: expected an object');
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.title !== 'string') {
    throw new Error('Invalid JSON: missing or invalid "title" field');
  }

  if (typeof obj.summary !== 'string') {
    throw new Error('Invalid JSON: missing or invalid "summary" field');
  }

  if (!Array.isArray(obj.entries)) {
    throw new Error('Invalid JSON: missing or invalid "entries" field');
  }

  const entries = obj.entries.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Invalid JSON: entry ${index} is not an object`);
    }

    const entryObj = entry as Record<string, unknown>;

    if (typeof entryObj.label !== 'string') {
      throw new Error(`Invalid JSON: entry ${index} has missing or invalid "label" field`);
    }

    if (typeof entryObj.amount !== 'number') {
      throw new Error(`Invalid JSON: entry ${index} has missing or invalid "amount" field`);
    }

    return {
      label: entryObj.label,
      amount: entryObj.amount,
    };
  });

  return {
    title: obj.title,
    summary: obj.summary,
    entries,
  };
}

function getFormatter(format: string): Formatter {
  switch (format) {
    case 'markdown':
      return renderMarkdown;
    case 'text':
      return renderText;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

function main(): void {
  try {
    const args = parseArguments(process.argv.slice(2));

    if (!args.inputFile) {
      console.error('Error: Missing input file');
      console.error('Usage: node dist/cli/report.js <data.json> --format <format> [--output <path>] [--includeTotals]');
      process.exit(1);
    }

    if (!args.format) {
      console.error('Error: Missing format');
      console.error('Usage: node dist/cli/report.js <data.json> --format <format> [--output <path>] [--includeTotals]');
      process.exit(1);
    }

    // Read and parse JSON file
    let jsonData: unknown;
    try {
      const fileContent = readFileSync(args.inputFile, 'utf8');
      jsonData = JSON.parse(fileContent);
    } catch (error) {
      console.error(`Error reading or parsing file "${args.inputFile}":`, error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    // Validate data structure
    const reportData = validateReportData(jsonData);

    // Get formatter
    const formatter = getFormatter(args.format);

    // Generate report
    const options: ReportOptions = {
      includeTotals: args.includeTotals,
    };

    const output = formatter(reportData, options);

    // Write output
    if (args.outputPath) {
      try {
        writeFileSync(args.outputPath, output, 'utf8');
      } catch (error) {
        console.error(`Error writing to file "${args.outputPath}":`, error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    } else {
      console.log(output);
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
