import { join, relative } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import {
  getStorePaths, SCHEMA_VERSION, STORE_DIR_NAME,
} from './config.js';
import type {
  Meta, Snapshot, SnapshotFile, Pattern, Profile,
} from './types.js';
import {
  ensureDir, readJsonFile, writeJsonFile,
  readTextFile, writeTextFile, generateId,
  sanitizePath, contentHash,
} from './utils.js';

export function ensureStore(repoRoot: string): ReturnType<typeof getStorePaths> {
  const paths = getStorePaths(repoRoot);
  ensureDir(paths.store);
  ensureDir(paths.snapshots);
  return paths;
}

// -- Meta --

export function readMeta(repoRoot: string): Meta | null {
  const paths = getStorePaths(repoRoot);
  return readJsonFile<Meta>(paths.meta);
}

export function writeMeta(repoRoot: string, meta: Meta): void {
  const paths = getStorePaths(repoRoot);
  writeJsonFile(paths.meta, meta);
}

export function initMeta(repoRoot: string): Meta {
  return {
    version: SCHEMA_VERSION,
    repoRoot,
    initializedAt: new Date().toISOString(),
    totalSnapshots: 0,
    totalCommitsAnalyzed: 0,
    totalPatternsExtracted: 0,
    hookInstalled: false,
  };
}

// -- Snapshots --

export function saveSnapshot(repoRoot: string, snapshot: Snapshot): void {
  const paths = getStorePaths(repoRoot);
  const snapshotDir = join(paths.snapshots, snapshot.id);
  const filesDir = join(snapshotDir, 'files');
  ensureDir(filesDir);

  for (const file of snapshot.files) {
    const srcPath = join(repoRoot, file.path);
    if (existsSync(srcPath)) {
      const content = readFileSync(srcPath, 'utf8');
      const destName = sanitizePath(file.path) + '.ai';
      const destPath = join(filesDir, destName);
      writeTextFile(destPath, content);
      file.contentFile = join('files', destName);
      file.snapshotHash = contentHash(content);
    }
  }

  writeJsonFile(join(snapshotDir, 'manifest.json'), snapshot);

  const meta = readMeta(repoRoot);
  if (meta) {
    meta.totalSnapshots++;
    writeMeta(repoRoot, meta);
  }
}

export function listSnapshots(repoRoot: string): Snapshot[] {
  const paths = getStorePaths(repoRoot);
  if (!existsSync(paths.snapshots)) return [];

  const entries = readdirSync(paths.snapshots, { withFileTypes: true });
  const snapshots: Snapshot[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifest = readJsonFile<Snapshot>(
      join(paths.snapshots, entry.name, 'manifest.json')
    );
    if (manifest) snapshots.push(manifest);
  }

  return snapshots.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function listOpenSnapshots(repoRoot: string): Snapshot[] {
  return listSnapshots(repoRoot).filter(s => s.status === 'open');
}

export function listLearnableSnapshots(repoRoot: string): Snapshot[] {
  return listSnapshots(repoRoot).filter(s => s.status === 'open' || s.status === 'committed');
}

export function updateSnapshotStatus(
  repoRoot: string, snapshotId: string, status: Snapshot['status']
): void {
  const paths = getStorePaths(repoRoot);
  const manifestPath = join(paths.snapshots, snapshotId, 'manifest.json');
  const snapshot = readJsonFile<Snapshot>(manifestPath);
  if (snapshot) {
    snapshot.status = status;
    writeJsonFile(manifestPath, snapshot);
  }
}

export function readSnapshotFileContent(
  repoRoot: string, snapshotId: string, file: SnapshotFile
): string | null {
  const paths = getStorePaths(repoRoot);
  const contentPath = join(paths.snapshots, snapshotId, file.contentFile);
  return readTextFile(contentPath);
}

// -- Patterns --

export function readPatterns(repoRoot: string): Pattern[] {
  const paths = getStorePaths(repoRoot);
  return readJsonFile<Pattern[]>(paths.patterns) ?? [];
}

export function writePatterns(repoRoot: string, patterns: Pattern[]): void {
  const paths = getStorePaths(repoRoot);
  writeJsonFile(paths.patterns, patterns);
}

// -- Profile --

export function readProfileText(repoRoot: string): string | null {
  const paths = getStorePaths(repoRoot);
  return readTextFile(paths.profile);
}

export function writeProfileText(repoRoot: string, content: string): void {
  const paths = getStorePaths(repoRoot);
  writeTextFile(paths.profile, content);
}

export function isInitialized(repoRoot: string): boolean {
  const paths = getStorePaths(repoRoot);
  return existsSync(paths.meta);
}
