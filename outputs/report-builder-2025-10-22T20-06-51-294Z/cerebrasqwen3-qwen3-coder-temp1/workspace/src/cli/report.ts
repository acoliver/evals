#!/usr/bin/env node

import * as fs from 'fs';
import { ReportData } from '../types.js';
import { renderMarkdown } from '../formats/markdown.js';
import { renderText } from '../formats/text.js';

interface CliOptions {
  dataFile: string;
  format: string;
  outputFile?: string;
  includeTotals: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    dataFile: '',
    format: '',
    outputFile: undefined,
    includeTotals: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('-') && !options.dataFile) {
      options.dataFile = arg;
    } else if (arg === '--format') {
      options.format = args[++i];
    } else if (arg === '--output') {
      options.outputFile = args[++i];
    } else if (arg === '--includeTotals') {
      options.includeTotals = true;
    }
  }

  if (!options.dataFile) {
    throw new Error('Missing required argument: <data.json>');
  }
  if (!options.format) {
    throw new Error('Missing required argument: --format');
  }

  return options;
}

function validateAndLoadData(filePath: string): ReportData {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Data file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  let data: ReportData;
  try {
    data = JSON.parse(fileContent) as ReportData;
  } catch (e) {
    throw new Error(`Invalid JSON in file: ${filePath}`);
  }

  if (typeof data.title !== 'string') {
    throw new Error(`Missing or invalid field in JSON data: title`);
  }
  if (typeof data.summary !== 'string') {
    throw new Error(`Missing or invalid field in JSON data: summary`);
  }
  if (!Array.isArray(data.entries)) {
    throw new Error(`Missing or invalid field in JSON data: entries`);
  }
  for (const entry of data.entries) {
    if (typeof entry.label !== 'string' || typeof entry.amount !== 'number') {
      throw new Error(`Invalid entry format in JSON data`);
    }
  }

  return data;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const data = validateAndLoadData(options.dataFile);

    let output: string;
    if (options.format === 'markdown') {
      output = renderMarkdown(data, { includeTotals: options.includeTotals });
    } else if (options.format === 'text') {
      output = renderText(data, { includeTotals: options.includeTotals });
    } else {
      throw new Error(`Unsupported format: ${options.format}`);
    }

    if (options.outputFile) {
      fs.writeFileSync(options.outputFile, output);
      console.log(`Report written to ${options.outputFile}`);
    } else {
      console.log(output);
    }
  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
