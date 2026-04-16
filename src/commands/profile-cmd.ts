import { existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { findRepoRoot } from '../git.js';
import { isInitialized, readPatterns, readProfileText } from '../storage.js';
import { getStorePaths } from '../config.js';
import { buildProfile } from '../profile/generator.js';
import { renderProfileMarkdown } from '../profile/renderer.js';
import { exportProfile } from '../profile/exporters.js';
import { writeTextFile } from '../utils.js';
import type { ExportFormat } from '../types.js';

interface ProfileOptions {
  export?: string;
  raw?: boolean;
  reset?: boolean;
}

export function runProfile(options: ProfileOptions): void {
  const repoRoot = findRepoRoot();
  if (!repoRoot) {
    console.error(chalk.red('Not inside a git repository.'));
    process.exit(1);
  }

  if (!isInitialized(repoRoot)) {
    console.error(chalk.red('Not initialized. Run `last-mile-dev init` first.'));
    process.exit(1);
  }

  if (options.reset) {
    const paths = getStorePaths(repoRoot);
    writeTextFile(paths.profile, [
      '# Code Style Profile',
      '',
      'Profile reset. Existing patterns will still be used on next `learn --apply`.',
      '',
    ].join('\n'));
    console.log(chalk.green('Profile reset.'));
    return;
  }

  if (options.export) {
    const format = normalizeExportFormat(options.export);
    if (!format) {
      console.error(chalk.red(`Unknown export format: ${options.export}`));
      console.error('Available: copilot-instructions, claude');
      process.exit(1);
    }

    const patterns = readPatterns(repoRoot);
    const profile = buildProfile(patterns);
    const content = exportProfile(profile, format);

    const outputPath = getExportPath(repoRoot, format);
    writeTextFile(outputPath, content);
    console.log(chalk.green(`Exported to ${outputPath}`));
    return;
  }

  // Show profile
  const profileText = readProfileText(repoRoot);
  if (!profileText) {
    console.log('No profile generated yet. Run `last-mile-dev learn --apply` first.');
    return;
  }

  if (options.raw) {
    process.stdout.write(profileText);
  } else {
    console.log(profileText);
  }
}

function normalizeExportFormat(input: string): ExportFormat | null {
  const map: Record<string, ExportFormat> = {
    'copilot-instructions': 'copilot-instructions',
    'copilot': 'copilot-instructions',
    'claude': 'claude',
  };
  return map[input.toLowerCase()] ?? null;
}

function getExportPath(repoRoot: string, format: ExportFormat): string {
  switch (format) {
    case 'copilot-instructions':
      return join(repoRoot, '.github', 'copilot-instructions.md');
    case 'claude':
      return join(repoRoot, 'CLAUDE.md');
  }
}
