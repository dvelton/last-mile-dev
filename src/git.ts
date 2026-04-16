import { execSync, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { STORE_DIR_NAME } from './config.js';
import type { Snapshot, SnapshotFile } from './types.js';
import { normalizePath } from './utils.js';

function git(args: string[], cwd: string): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

export function findRepoRoot(startDir?: string): string | null {
  const dir = startDir ?? process.cwd();
  const root = git(['rev-parse', '--show-toplevel'], dir);
  return root || null;
}

export function getHeadCommit(repoRoot: string): string {
  return git(['rev-parse', 'HEAD'], repoRoot);
}

export function getCurrentBranch(repoRoot: string): string {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot) || 'HEAD';
}

export function getCommitChangedFiles(repoRoot: string, commitSha: string): string[] {
  const output = git(['diff-tree', '--no-commit-id', '--name-only', '--root', '-r', commitSha], repoRoot);
  return output ? output.split('\n').filter(Boolean) : [];
}

export function readBlobAtCommit(repoRoot: string, commitSha: string, filePath: string): string | null {
  try {
    return execFileSync(
      'git', ['show', `${commitSha}:${filePath}`],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch {
    return null;
  }
}

export function readBlobBeforeCommit(repoRoot: string, commitSha: string, filePath: string): string | null {
  return readBlobAtCommit(repoRoot, `${commitSha}~1`, filePath);
}

export function getRecentCommits(repoRoot: string, count: number = 10): string[] {
  const output = git(['log', `--format=%H`, `-n`, `${count}`], repoRoot);
  return output ? output.split('\n').filter(Boolean) : [];
}

// -- Git hooks --

const HOOK_MARKER = '# last-mile-dev hook';

export function installPostCommitHook(repoRoot: string): boolean {
  const hooksDir = join(repoRoot, '.git', 'hooks');
  const hookPath = join(hooksDir, 'post-commit');

  const hookScript = [
    '#!/bin/sh',
    HOOK_MARKER,
    'if command -v last-mile-dev >/dev/null 2>&1; then',
    '  last-mile-dev _post-commit',
    'elif [ -x ./node_modules/.bin/last-mile-dev ]; then',
    '  ./node_modules/.bin/last-mile-dev _post-commit',
    'fi',
  ].join('\n') + '\n';

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf8');
    if (existing.includes(HOOK_MARKER)) {
      return true; // already installed
    }
    // chain with existing hook
    writeFileSync(hookPath, existing.trimEnd() + '\n\n' + hookScript);
  } else {
    writeFileSync(hookPath, hookScript);
  }

  chmodSync(hookPath, 0o755);
  return true;
}

export function isHookInstalled(repoRoot: string): boolean {
  const hookPath = join(repoRoot, '.git', 'hooks', 'post-commit');
  if (!existsSync(hookPath)) return false;
  const content = readFileSync(hookPath, 'utf8');
  return content.includes(HOOK_MARKER);
}

// -- AI change detection --

export function findCommittedSnapshotMatches(
  repoRoot: string,
  commitSha: string,
  openSnapshots: Snapshot[]
): Array<{ snapshot: Snapshot; matchedFiles: SnapshotFile[]; commitSha: string }> {
  const changedFiles = getCommitChangedFiles(repoRoot, commitSha);
  if (changedFiles.length === 0) return [];

  const changedSet = new Set(changedFiles.map(f => normalizePath(f)));
  const matches: Array<{ snapshot: Snapshot; matchedFiles: SnapshotFile[]; commitSha: string }> = [];

  for (const snapshot of openSnapshots) {
    const matchedFiles = snapshot.files.filter(f => changedSet.has(normalizePath(f.path)));
    if (matchedFiles.length > 0) {
      matches.push({ snapshot, matchedFiles, commitSha });
    }
  }

  return matches;
}

export function ensureGitignore(repoRoot: string): void {
  const gitignorePath = join(repoRoot, '.gitignore');
  const entry = STORE_DIR_NAME + '/';

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf8');
    if (content.includes(entry)) return;
    writeFileSync(gitignorePath, content.trimEnd() + '\n' + entry + '\n');
  } else {
    writeFileSync(gitignorePath, entry + '\n');
  }
}
