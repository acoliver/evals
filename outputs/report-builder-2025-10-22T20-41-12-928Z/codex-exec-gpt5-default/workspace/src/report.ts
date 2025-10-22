import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ReportEntry {
  label: string;
  amount: number;
}

export interface ReportData {
  title: string;
  summary: string;
  entries: ReportEntry[];
}

export interface RenderOptions {
  includeTotals: boolean;
}

export interface LoadOptions {
  /**
   * Base directory used to resolve the JSON file path.
   * Defaults to process.cwd().
   */
  baseDir?: string;
}

export function loadReportData(
  inputPath: string,
  options: LoadOptions = {},
): ReportData {
  if (!inputPath) {
    throw new Error('Input path is required');
  }

  const baseDir = options.baseDir ?? process.cwd();
  const absolutePath = resolve(baseDir, inputPath);

  let raw: string;
  try {
    raw = readFileSync(absolutePath, 'utf8');
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to read input file';
    throw new Error(`Failed to read report data: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON input');
  }

  return validateReportData(parsed);
}

export function validateReportData(data: unknown): ReportData {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Report data must be an object');
  }

  const candidate = data as Record<string, unknown>;

  if (typeof candidate.title !== 'string' || candidate.title.trim() === '') {
    throw new Error('Report "title" must be a non-empty string');
  }

  if (
    typeof candidate.summary !== 'string' ||
    candidate.summary.trim() === ''
  ) {
    throw new Error('Report "summary" must be a non-empty string');
  }

  if (!Array.isArray(candidate.entries)) {
    throw new Error('Report "entries" must be an array');
  }

  const entries = candidate.entries.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Report entry at index ${index} must be an object`);
    }

    const entryRecord = entry as Record<string, unknown>;
    const { label, amount } = entryRecord;

    if (typeof label !== 'string' || label.trim() === '') {
      throw new Error(`Report entry ${index} "label" must be a non-empty string`);
    }

    if (typeof amount !== 'number' || Number.isNaN(amount) || !isFinite(amount)) {
      throw new Error(`Report entry ${index} "amount" must be a finite number`);
    }

    return {
      label,
      amount,
    };
  });

  return {
    title: candidate.title,
    summary: candidate.summary,
    entries,
  };
}

export function computeTotal(report: ReportData): number {
  return report.entries.reduce((total, entry) => total + entry.amount, 0);
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
