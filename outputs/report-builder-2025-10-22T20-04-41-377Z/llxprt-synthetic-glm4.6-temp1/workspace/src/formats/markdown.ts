import type { ReportData, ReportOptions, Formatter } from '../types.js';

function formatAmount(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function calculateTotal(entries: ReportData['entries']): number {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

export const renderMarkdown: Formatter = (data: ReportData, options: ReportOptions): string => {
  const lines: string[] = [];
  
  // Title
  lines.push(`# ${data.title}`);
  lines.push('');
  
  // Summary
  lines.push(data.summary);
  lines.push('');
  
  // Entries heading
  lines.push('## Entries');
  
  // Entries list
  for (const entry of data.entries) {
    lines.push(`- **${entry.label}** — ${formatAmount(entry.amount)}`);
  }
  
  // Total if requested
  if (options.includeTotals) {
    const total = calculateTotal(data.entries);
    lines.push(`**Total:** ${formatAmount(total)}`);
  }
  
  return lines.join('\n');
};