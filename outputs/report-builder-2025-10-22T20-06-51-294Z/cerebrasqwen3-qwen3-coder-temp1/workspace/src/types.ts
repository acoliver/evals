export interface ReportData {
  title: string;
  summary: string;
  entries: Array<{
    label: string;
    amount: number;
  }>;
}

export interface RenderOptions {
  includeTotals: boolean;
}