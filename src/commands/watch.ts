import { watch } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import chalk from 'chalk';
import { findRepoRoot, getHeadCommit, getCurrentBranch, readBlobAtCommit } from '../git.js';
import { isInitialized, saveSnapshot } from '../storage.js';
import { detectLanguage, generateId, contentHash, normalizePath } from '../utils.js';
import { computeAiTouchedRanges } from '../analysis/line-diff.js';
import { LANGUAGE_EXTENSIONS, IGNORED_DIRS } from '../config.js';
import type { Snapshot, SnapshotFile } from '../types.js';

export function runWatch(): void {
  const repoRoot = findRepoRoot();
  if (!repoRoot) {
    console.error(chalk.red('Not inside a git repository.'));
    process.exit(1);
  }

  if (!isInitialized(repoRoot)) {
    console.error(chalk.red('Not initialized. Run `last-mile-dev init` first.'));
    process.exit(1);
  }

  console.log(chalk.bold('Watching for file changes...'));
  console.log(chalk.dim('Snapshots will be created when supported files are modified.'));
  console.log(chalk.dim('Press Ctrl+C to stop.'));
  console.log('');

  const debounceMap = new Map<string, NodeJS.Timeout>();
  const snapshotted = new Set<string>();
  let lastHead = getHeadCommit(repoRoot);

  // Poll for new commits to reset per-file tracking
  const commitPoller = setInterval(() => {
    const currentHead = getHeadCommit(repoRoot);
    if (currentHead && currentHead !== lastHead) {
      lastHead = currentHead;
      snapshotted.clear();
    }
  }, 5000);

  try {
    const watcher = watch(repoRoot, { recursive: true }, (eventType, filename) => {
      if (!filename) return;

      // Handle both 'change' and 'rename' (which covers creates)
      if (eventType !== 'change' && eventType !== 'rename') return;

      // Skip ignored directories
      if (IGNORED_DIRS.some(dir => filename.startsWith(dir + '/'))) return;
      if (filename.startsWith('.')) return;

      // Only supported file types
      const ext = extname(filename);
      if (!LANGUAGE_EXTENSIONS[ext]) return;

      // Debounce rapid changes to same file
      const existing = debounceMap.get(filename);
      if (existing) clearTimeout(existing);

      debounceMap.set(filename, setTimeout(() => {
        debounceMap.delete(filename);
        handleFileChange(repoRoot, filename, snapshotted);
      }, 1000));
    });

    process.on('SIGINT', () => {
      clearInterval(commitPoller);
      watcher.close();
      console.log('\nStopped watching.');
      process.exit(0);
    });
  } catch (err) {
    clearInterval(commitPoller);
    console.error(chalk.red('Failed to start watcher. Your OS may not support recursive watching.'));
    process.exit(1);
  }
}

function handleFileChange(repoRoot: string, relPath: string, snapshotted: Set<string>): void {
  const absPath = resolve(repoRoot, relPath);
  if (!existsSync(absPath)) return;

  // Only snapshot each file once per watch session
  // (subsequent changes are edits we want to learn from)
  if (snapshotted.has(relPath)) return;

  const head = getHeadCommit(repoRoot);
  const baseline = readBlobAtCommit(repoRoot, head, relPath);
  const current = readFileSync(absPath, 'utf8');

  // Only snapshot if the file actually changed from HEAD
  if (baseline && contentHash(baseline) === contentHash(current)) return;

  const language = detectLanguage(relPath);
  const aiLineRanges = baseline ? computeAiTouchedRanges(baseline, current) : [];

  const snapshot: Snapshot = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    source: 'watch',
    gitHead: head,
    branch: getCurrentBranch(repoRoot),
    status: 'open',
    files: [{
      path: relPath,
      language,
      baselineHash: baseline ? contentHash(baseline) : '',
      snapshotHash: '',
      contentFile: '',
      aiLineRanges,
    }],
  };

  saveSnapshot(repoRoot, snapshot);
  snapshotted.add(relPath);

  console.log(chalk.green(`  Snapshotted: ${relPath}`));
}
