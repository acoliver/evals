export interface ReportEntry {
  label: string;
  amount: number;
}

export interface ReportData {
  title: string;
  summary: string;
  entries: ReportEntry[];
}

export interface ReportOptions {
  includeTotals: boolean;
}

export type Formatter = (data: ReportData, options: ReportOptions) => string;