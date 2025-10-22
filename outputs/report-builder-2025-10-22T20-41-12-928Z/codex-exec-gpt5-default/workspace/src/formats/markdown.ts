import type { RenderOptions, ReportData } from '../report.js';
import { computeTotal, formatCurrency } from '../report.js';

export function renderMarkdown(
  report: ReportData,
  options: RenderOptions,
): string {
  const lines = [
    `# ${report.title}`,
    '',
    report.summary,
    '',
    '## Entries',
  ];

  for (const entry of report.entries) {
    lines.push(`- **${entry.label}** — ${formatCurrency(entry.amount)}`);
  }

  if (options.includeTotals) {
    const total = computeTotal(report);
    lines.push('', `**Total:** ${formatCurrency(total)}`);
  }

  return lines.join('\n');
}
