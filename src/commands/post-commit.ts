import { findRepoRoot, getHeadCommit, findCommittedSnapshotMatches } from '../git.js';
import { isInitialized, listOpenSnapshots, updateSnapshotStatus } from '../storage.js';

export function runPostCommit(): void {
  const repoRoot = findRepoRoot();
  if (!repoRoot || !isInitialized(repoRoot)) return;

  const openSnapshots = listOpenSnapshots(repoRoot);
  if (openSnapshots.length === 0) return;

  const head = getHeadCommit(repoRoot);
  if (!head) return;

  const matches = findCommittedSnapshotMatches(repoRoot, head, openSnapshots);

  for (const match of matches) {
    updateSnapshotStatus(repoRoot, match.snapshot.id, 'committed');
  }
}
