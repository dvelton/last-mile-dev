import { join } from 'node:path';
import type { LanguageId } from './types.js';

export const STORE_DIR_NAME = '.last-mile-dev';
export const SNAPSHOTS_DIR_NAME = 'snapshots';
export const PATTERNS_FILE_NAME = 'patterns.json';
export const PROFILE_FILE_NAME = 'profile.md';
export const META_FILE_NAME = 'meta.json';

export const SCHEMA_VERSION = 1;

export const MIN_PROMOTION_OCCURRENCES = 3;
export const MIN_PROMOTION_COMMITS = 2;
export const PROMOTION_CONFIDENCE_THRESHOLD = 0.6;
export const STALE_AFTER_DAYS = 90;

export const LANGUAGE_EXTENSIONS: Record<string, LanguageId> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
};

export const IGNORED_DIRS = [
  'node_modules', '.git', 'dist', 'build', '.next',
  '__pycache__', '.venv', 'venv', '.last-mile-dev',
];

export function getStorePaths(repoRoot: string) {
  const store = join(repoRoot, STORE_DIR_NAME);
  return {
    root: repoRoot,
    store,
    snapshots: join(store, SNAPSHOTS_DIR_NAME),
    patterns: join(store, PATTERNS_FILE_NAME),
    profile: join(store, PROFILE_FILE_NAME),
    meta: join(store, META_FILE_NAME),
  };
}
