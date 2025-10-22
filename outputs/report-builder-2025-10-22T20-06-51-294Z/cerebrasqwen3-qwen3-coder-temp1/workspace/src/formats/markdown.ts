import { ReportData, RenderOptions } from '../types.js';

export function renderMarkdown(data: ReportData, options: RenderOptions): string {
  let output = `# ${data.title}\n\n${data.summary}\n\n## Entries\n`;
  for (const entry of data.entries) {
    output += `- **${entry.label}** — $${entry.amount.toFixed(2)}\n`;
  }

  if (options.includeTotals) {
    const total = data.entries.reduce((sum, entry) => sum + entry.amount, 0);
    output += `\n**Total:** $${total.toFixed(2)}`;
  }

  return output;
}