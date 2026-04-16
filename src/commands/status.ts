import chalk from 'chalk';
import { findRepoRoot, isHookInstalled } from '../git.js';
import { isInitialized, readMeta, readPatterns, listSnapshots } from '../storage.js';

export function runStatus(): void {
  const repoRoot = findRepoRoot();
  if (!repoRoot) {
    console.error(chalk.red('Not inside a git repository.'));
    process.exit(1);
  }

  if (!isInitialized(repoRoot)) {
    console.error(chalk.red('Not initialized. Run `last-mile-dev init` first.'));
    process.exit(1);
  }

  const meta = readMeta(repoRoot);
  const patterns = readPatterns(repoRoot);
  const snapshots = listSnapshots(repoRoot);
  const hookStatus = isHookInstalled(repoRoot);

  const active = patterns.filter(p => p.status === 'active');
  const candidates = patterns.filter(p => p.status === 'candidate');
  const stale = patterns.filter(p => p.status === 'stale');
  const openSnapshots = snapshots.filter(s => s.status === 'open');
  const committedSnapshots = snapshots.filter(s => s.status === 'committed');
  const learnedSnapshots = snapshots.filter(s => s.status === 'learned');

  console.log(chalk.bold('last-mile-dev status'));
  console.log('');

  console.log(chalk.bold('Learning'));
  console.log(`  Total snapshots:    ${meta?.totalSnapshots ?? 0}`);
  console.log(`  Commits analyzed:   ${meta?.totalCommitsAnalyzed ?? 0}`);
  console.log(`  Last learned:       ${meta?.lastLearnAt ?? 'never'}`);
  console.log('');

  console.log(chalk.bold('Snapshots'));
  console.log(`  Open (waiting):     ${openSnapshots.length}`);
  console.log(`  Committed:          ${committedSnapshots.length}`);
  console.log(`  Learned:            ${learnedSnapshots.length}`);
  console.log('');

  console.log(chalk.bold('Patterns'));
  console.log(chalk.green(`  Active rules:       ${active.length}`));
  console.log(chalk.yellow(`  Emerging:           ${candidates.length}`));
  console.log(chalk.dim(`  Stale:              ${stale.length}`));
  console.log('');

  console.log(chalk.bold('Infrastructure'));
  console.log(`  Post-commit hook:   ${hookStatus ? chalk.green('installed') : chalk.yellow('not installed')}`);

  if (active.length > 0) {
    console.log('');
    console.log(chalk.bold('Active rules:'));
    for (const p of active) {
      console.log(`  ${p.summary} (${p.supportCount} occurrences across ${p.distinctCommits.length} commits)`);
    }
  }
}
