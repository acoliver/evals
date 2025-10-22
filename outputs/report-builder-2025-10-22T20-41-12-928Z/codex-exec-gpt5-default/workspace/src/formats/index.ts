import type { RenderOptions, ReportData } from '../report.js';
import { renderMarkdown } from './markdown.js';
import { renderText } from './text.js';

export type ReportRenderer = (
  report: ReportData,
  options: RenderOptions,
) => string;

const renderers: Record<string, ReportRenderer> = {
  markdown: renderMarkdown,
  text: renderText,
};

export function getRenderer(format: string): ReportRenderer {
  const renderer = renderers[format];

  if (!renderer) {
    throw new Error(`Unsupported format "${format}"`);
  }

  return renderer;
}

export function availableFormats(): string[] {
  return Object.keys(renderers);
}
