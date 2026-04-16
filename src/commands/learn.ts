import chalk from 'chalk';
import { findRepoRoot, getRecentCommits, findCommittedSnapshotMatches } from '../git.js';
import {
  isInitialized, listLearnableSnapshots, readPatterns, writePatterns,
  updateSnapshotStatus, readMeta, writeMeta, listSnapshots,
} from '../storage.js';
import {
  analyzeSnapshotAgainstCommit, mergeDetectedIntoPatterns,
} from '../analysis/analyzer.js';
import { buildProfile } from '../profile/generator.js';
import { renderProfileMarkdown } from '../profile/renderer.js';
import { writeTextFile } from '../utils.js';
import { getStorePaths } from '../config.js';
import type { Pattern } from '../types.js';

interface LearnOptions {
  apply?: boolean;
}

export function runLearn(options: LearnOptions): void {
  const repoRoot = findRepoRoot();
  if (!repoRoot) {
    console.error(chalk.red('Not inside a git repository.'));
    process.exit(1);
  }

  if (!isInitialized(repoRoot)) {
    console.error(chalk.red('Not initialized. Run `last-mile-dev init` first.'));
    process.exit(1);
  }

  const learnableSnapshots = listLearnableSnapshots(repoRoot);
  if (learnableSnapshots.length === 0) {
    const allSnapshots = listSnapshots(repoRoot);
    if (allSnapshots.length === 0) {
      console.log('No snapshots found. Snapshot some AI-generated code first:');
      console.log('  last-mile-dev snapshot <files...>');
    } else {
      console.log('No unprocessed snapshots. All snapshots have been learned.');
    }
    return;
  }

  const recentCommits = getRecentCommits(repoRoot, 20);
  let existingPatterns = readPatterns(repoRoot);
  let totalFilesAnalyzed = 0;
  let totalNewPatterns = 0;
  const processedSnapshots: string[] = [];

  for (const snapshot of learnableSnapshots) {
    // Only consider commits made after this snapshot's baseline
    const snapshotCommitIdx = recentCommits.indexOf(snapshot.gitHead);
    const candidateCommits = snapshotCommitIdx >= 0
      ? recentCommits.slice(0, snapshotCommitIdx)
      : recentCommits;

    for (const commitSha of candidateCommits) {
      const matches = findCommittedSnapshotMatches(repoRoot, commitSha, [snapshot]);

      for (const match of matches) {
        const result = analyzeSnapshotAgainstCommit(
          repoRoot, match.snapshot, match.matchedFiles, commitSha
        );

        totalFilesAnalyzed += result.filesAnalyzed;

        if (result.patternsFound.length > 0) {
          // Merge once per analysis result (not per file) to avoid inflating counts
          const representativeFile = match.matchedFiles[0];
          existingPatterns = mergeDetectedIntoPatterns(
            existingPatterns,
            result.patternsFound,
            match.snapshot.id,
            commitSha,
            representativeFile.path,
            representativeFile.language
          );
          totalNewPatterns += result.patternsFound.length;
        }

        if (!processedSnapshots.includes(match.snapshot.id)) {
          processedSnapshots.push(match.snapshot.id);
        }
      }
    }
  }

  if (totalFilesAnalyzed === 0) {
    console.log('Found snapshots but no matching commits yet. Edit the snapshotted files and commit.');
    return;
  }

  // Display results
  const active = existingPatterns.filter(p => p.status === 'active');
  const candidates = existingPatterns.filter(p => p.status === 'candidate');

  console.log(chalk.bold(`Analyzed ${totalFilesAnalyzed} file(s) across ${processedSnapshots.length} snapshot(s)`));
  console.log('');

  if (active.length > 0) {
    console.log(chalk.green.bold(`Active rules (${active.length}):`));
    for (const p of active) {
      console.log(chalk.green(`  [${p.category}] ${p.summary} (${p.supportCount} occurrences, ${p.distinctCommits.length} commits)`));
    }
    console.log('');
  }

  if (candidates.length > 0) {
    console.log(chalk.yellow(`Emerging patterns (${candidates.length}):`));
    for (const p of candidates) {
      console.log(chalk.yellow(`  [${p.category}] ${p.summary} (${p.supportCount} occurrence${p.supportCount !== 1 ? 's' : ''})`));
    }
    console.log('');
  }

  if (active.length === 0 && candidates.length === 0 && totalNewPatterns === 0) {
    console.log('No patterns detected in the edits. The AI-generated code may have been committed without changes,');
    console.log('or the changes were too small to classify.');
    return;
  }

  if (options.apply) {
    // Save patterns
    writePatterns(repoRoot, existingPatterns);

    // Mark processed snapshots
    for (const sid of processedSnapshots) {
      updateSnapshotStatus(repoRoot, sid, 'learned');
    }

    // Generate and write profile
    const profile = buildProfile(existingPatterns);
    const markdown = renderProfileMarkdown(profile);
    const paths = getStorePaths(repoRoot);
    writeTextFile(paths.profile, markdown);

    // Update meta
    const meta = readMeta(repoRoot);
    if (meta) {
      meta.lastLearnAt = new Date().toISOString();
      meta.totalCommitsAnalyzed += processedSnapshots.length;
      meta.totalPatternsExtracted += totalNewPatterns;
      writeMeta(repoRoot, meta);
    }

    console.log(chalk.green('Profile updated.'));
    console.log(`  Patterns saved to ${paths.patterns}`);
    console.log(`  Profile written to ${paths.profile}`);
  } else {
    console.log(chalk.dim('Run `last-mile-dev learn --apply` to save these patterns and update your profile.'));
  }
}
