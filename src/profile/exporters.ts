import type { Profile, ExportFormat } from '../types.js';
import { truncate } from '../utils.js';

export function exportProfile(profile: Profile, format: ExportFormat): string {
  switch (format) {
    case 'copilot-instructions':
      return exportCopilotInstructions(profile);
    case 'claude':
      return exportClaude(profile);
  }
}

function exportCopilotInstructions(profile: Profile): string {
  const lines: string[] = [];

  lines.push('# Coding Preferences');
  lines.push('');
  lines.push('These preferences were learned from actual code edits using [last-mile-dev](https://github.com/dvelton/last-mile-dev).');
  lines.push('');

  for (const rule of profile.rules) {
    lines.push(`- ${rule.text}`);
  }

  if (profile.rules.length > 0) {
    lines.push('');
    lines.push('When generating code, follow these preferences. They reflect how the developer');
    lines.push('actually writes code, learned from edits to AI-generated output.');
  }

  return lines.join('\n') + '\n';
}

function exportClaude(profile: Profile): string {
  const lines: string[] = [];

  lines.push('# Code Style Preferences');
  lines.push('');
  lines.push('The following coding preferences were learned from actual developer edits');
  lines.push('to AI-generated code. Apply these when writing or modifying code.');
  lines.push('');

  for (const rule of profile.rules) {
    lines.push(`- ${rule.text}`);
  }

  const examples = profile.rules.filter(r => r.example).slice(0, 3);
  if (examples.length > 0) {
    lines.push('');
    lines.push('## Examples');
    lines.push('');
    for (const rule of examples) {
      if (!rule.example) continue;
      lines.push(`AI wrote: \`${truncate(rule.example.before, 80)}\``);
      lines.push(`Developer changed to: \`${truncate(rule.example.after, 80)}\``);
      lines.push('');
    }
  }

  return lines.join('\n') + '\n';
}
