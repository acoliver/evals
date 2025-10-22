import { ReportData, RenderOptions } from '../types.js';

export function renderText(data: ReportData, options: RenderOptions): string {
  let output = `${data.title}\n${data.summary}\n\nEntries:\n`;
  for (const entry of data.entries) {
    output += `- ${entry.label}: $${entry.amount.toFixed(2)}\n`;
  }

  if (options.includeTotals) {
    const total = data.entries.reduce((sum, entry) => sum + entry.amount, 0);
    output += `\nTotal: $${total.toFixed(2)}`;
  }

  return output;
}