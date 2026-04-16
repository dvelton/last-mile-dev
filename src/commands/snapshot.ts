import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import chalk from 'chalk';
import { findRepoRoot, getHeadCommit, getCurrentBranch, readBlobAtCommit } from '../git.js';
import { ensureStore, saveSnapshot, isInitialized, readMeta } from '../storage.js';
import { detectLanguage, contentHash, generateId, normalizePath } from '../utils.js';
import { computeAiTouchedRanges } from '../analysis/line-diff.js';
import type { Snapshot, SnapshotFile } from '../types.js';

export function runSnapshot(filePaths: string[]): void {
  const repoRoot = findRepoRoot();
  if (!repoRoot) {
    console.error(chalk.red('Not inside a git repository.'));
    process.exit(1);
  }

  if (!isInitialized(repoRoot)) {
    console.error(chalk.red('Not initialized. Run `last-mile-dev init` first.'));
    process.exit(1);
  }

  if (filePaths.length === 0) {
    console.error(chalk.red('Provide one or more file paths to snapshot.'));
    console.error('  last-mile-dev snapshot src/auth.ts src/utils.ts');
    process.exit(1);
  }

  const head = getHeadCommit(repoRoot);
  const branch = getCurrentBranch(repoRoot);
  const snapshotId = generateId();

  const files: SnapshotFile[] = [];

  for (const fp of filePaths) {
    const absPath = resolve(fp);
    const relPath = normalizePath(relative(repoRoot, absPath));

    if (!existsSync(absPath)) {
      console.warn(chalk.yellow(`Skipping (not found): ${relPath}`));
      continue;
    }

    const language = detectLanguage(relPath);
    const baseline = readBlobAtCommit(repoRoot, head, relPath);
    const baselineHash = baseline ? contentHash(baseline) : '';

    // Compute AI-touched ranges by comparing baseline to current file
    let aiLineRanges: SnapshotFile['aiLineRanges'] = [];
    if (baseline) {
      const currentContent = readFileSync(absPath, 'utf8');
      aiLineRanges = computeAiTouchedRanges(baseline, currentContent);
    }

    files.push({
      path: relPath,
      language,
      baselineHash,
      snapshotHash: '', // filled by saveSnapshot
      contentFile: '',  // filled by saveSnapshot
      aiLineRanges,
    });
  }

  if (files.length === 0) {
    console.error(chalk.red('No valid files to snapshot.'));
    process.exit(1);
  }

  const snapshot: Snapshot = {
    id: snapshotId,
    createdAt: new Date().toISOString(),
    source: 'manual',
    gitHead: head,
    branch,
    status: 'open',
    files,
  };

  saveSnapshot(repoRoot, snapshot);

  console.log(chalk.green(`Snapshot saved: ${snapshotId}`));
  for (const f of files) {
    console.log(`  ${f.path} (${f.language})`);
  }
}
