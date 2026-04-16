import chalk from 'chalk';
import { findRepoRoot, installPostCommitHook, ensureGitignore } from '../git.js';
import { ensureStore, initMeta, writeMeta, readMeta, isInitialized } from '../storage.js';
import { writeTextFile } from '../utils.js';
import { getStorePaths } from '../config.js';

export function runInit(): void {
  const repoRoot = findRepoRoot();
  if (!repoRoot) {
    console.error(chalk.red('Not inside a git repository. Run this from a project with git initialized.'));
    process.exit(1);
  }

  if (isInitialized(repoRoot)) {
    console.log(chalk.yellow('Already initialized in this repository.'));
    return;
  }

  const paths = ensureStore(repoRoot);

  const meta = initMeta(repoRoot);
  const hookOk = installPostCommitHook(repoRoot);
  meta.hookInstalled = hookOk;
  writeMeta(repoRoot, meta);

  ensureGitignore(repoRoot);

  // Create initial empty profile
  writeTextFile(paths.profile, [
    '# Code Style Profile',
    '',
    'No patterns learned yet. Use AI coding tools, edit the output, and commit.',
    'Patterns are extracted from the difference between what the AI wrote and what you shipped.',
    '',
    'Run `last-mile-dev learn` after a few commits to see emerging patterns.',
    '',
  ].join('\n'));

  console.log(chalk.green('Initialized last-mile-dev'));
  console.log(`  Store: ${paths.store}`);
  console.log(`  Hook: ${hookOk ? 'installed' : 'skipped (install manually)'}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Have an AI tool write or modify code in this repo');
  console.log('  2. Run: last-mile-dev snapshot <files...>');
  console.log('  3. Edit the code and commit');
  console.log('  4. Run: last-mile-dev learn');
}
