import type { Profile, PatternCategory } from '../types.js';
import { truncate } from '../utils.js';

const CATEGORY_LABELS: Record<PatternCategory, string> = {
  formatting: 'Formatting',
  imports: 'Imports',
  types: 'Type System',
  syntax: 'Syntax Preferences',
  'control-flow': 'Control Flow',
  'error-handling': 'Error Handling',
  async: 'Async Patterns',
  naming: 'Naming Conventions',
  comments: 'Comments & Documentation',
  structure: 'Code Organization',
};

export function renderProfileMarkdown(profile: Profile): string {
  const lines: string[] = [];

  lines.push('# Code Style Profile');
  lines.push(
    `*Based on ${profile.basedOn.commits} commit${profile.basedOn.commits !== 1 ? 's' : ''} ` +
    `across ${profile.basedOn.snapshots} snapshot${profile.basedOn.snapshots !== 1 ? 's' : ''}*`
  );
  lines.push('');

  if (profile.rules.length === 0) {
    lines.push('No strong patterns detected yet. Keep using AI coding tools and editing the output.');
    lines.push('Patterns become rules after appearing consistently across multiple commits.');
    return lines.join('\n');
  }

  // Group rules by category
  const grouped = new Map<PatternCategory, typeof profile.rules>();
  for (const rule of profile.rules) {
    const existing = grouped.get(rule.category) ?? [];
    existing.push(rule);
    grouped.set(rule.category, existing);
  }

  for (const [category, rules] of grouped) {
    const label = CATEGORY_LABELS[category] ?? category;
    lines.push(`## ${label}`);
    lines.push('');

    for (const rule of rules) {
      lines.push(`- ${rule.text}`);
    }
    lines.push('');

    // Include up to 2 examples per category
    const withExamples = rules.filter(r => r.example && r.example.before && r.example.after !== '(removed)');
    const examples = withExamples.slice(0, 2);

    if (examples.length > 0) {
      for (const rule of examples) {
        if (!rule.example) continue;
        lines.push('```');
        lines.push(`// AI wrote:`);
        lines.push(truncate(rule.example.before, 120));
        lines.push('');
        lines.push(`// Developer changed to:`);
        lines.push(truncate(rule.example.after, 120));
        lines.push('```');
        lines.push('');
      }
    }
  }

  if (profile.basedOn.candidatePatterns > 0) {
    lines.push('---');
    lines.push(
      `*${profile.basedOn.candidatePatterns} emerging pattern${profile.basedOn.candidatePatterns !== 1 ? 's' : ''} ` +
      `not yet included (need more consistent observations to confirm).*`
    );
  }

  return lines.join('\n');
}
