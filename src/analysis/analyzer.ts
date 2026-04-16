import type { Pattern, PatternOccurrence, LanguageId, Snapshot, SnapshotFile } from '../types.js';
import { computeLineDiff, computeAiTouchedRanges, filterToRanges } from './line-diff.js';
import { extractPatterns, type DetectedPattern } from './detectors.js';
import { computeConfidence, updatePatternStatus } from './confidence.js';
import { readSnapshotFileContent } from '../storage.js';
import { readBlobAtCommit } from '../git.js';
import { contentHash, detectLanguage } from '../utils.js';

export interface AnalysisResult {
  snapshotId: string;
  commitSha: string;
  filesAnalyzed: number;
  patternsFound: DetectedPattern[];
}

export function analyzeSnapshotAgainstCommit(
  repoRoot: string,
  snapshot: Snapshot,
  matchedFiles: SnapshotFile[],
  commitSha: string
): AnalysisResult {
  const allPatterns: DetectedPattern[] = [];

  for (const file of matchedFiles) {
    const aiContent = readSnapshotFileContent(repoRoot, snapshot.id, file);
    if (!aiContent) continue;

    const committedContent = readBlobAtCommit(repoRoot, commitSha, file.path);
    if (!committedContent) continue;

    // If AI content matches committed content, no edits were made
    if (contentHash(aiContent) === contentHash(committedContent)) continue;

    const language = file.language || detectLanguage(file.path);

    // Compute which lines the AI touched (relative to baseline)
    let aiRanges = file.aiLineRanges;
    if (aiRanges.length === 0 && file.baselineHash) {
      // Try to get baseline content to compute ranges
      const baselineContent = readBlobAtCommit(repoRoot, `${commitSha}~1`, file.path);
      if (baselineContent) {
        aiRanges = computeAiTouchedRanges(baselineContent, aiContent);
      }
    }

    // Diff the AI version against what was committed
    const diff = computeLineDiff(aiContent, committedContent);

    // Filter to only changes within AI-touched regions
    const relevantHunks = aiRanges.length > 0
      ? filterToRanges(diff.hunks, aiRanges)
      : diff.hunks;

    if (relevantHunks.length === 0) continue;

    // Collect all removed/added lines from relevant hunks
    const removed = relevantHunks.flatMap(h => h.removedLines);
    const added = relevantHunks.flatMap(h => h.addedLines);

    const detected = extractPatterns(removed, added, language, file.path);
    allPatterns.push(...detected);
  }

  return {
    snapshotId: snapshot.id,
    commitSha,
    filesAnalyzed: matchedFiles.length,
    patternsFound: allPatterns,
  };
}

export function mergeDetectedIntoPatterns(
  existing: Pattern[],
  detected: DetectedPattern[],
  snapshotId: string,
  commitSha: string,
  filePath: string,
  language: LanguageId
): Pattern[] {
  const patternMap = new Map<string, Pattern>();
  for (const p of existing) {
    patternMap.set(p.fingerprint, p);
  }

  const now = new Date().toISOString();

  for (const d of detected) {
    const occurrence: PatternOccurrence = {
      snapshotId,
      commit: commitSha,
      filePath,
      language,
      before: d.before,
      after: d.after,
      observedAt: now,
    };

    const existingPattern = patternMap.get(d.fingerprint);

    if (existingPattern) {
      existingPattern.supportCount++;
      existingPattern.lastSeenAt = now;
      existingPattern.occurrences.push(occurrence);
      if (!existingPattern.distinctCommits.includes(commitSha)) {
        existingPattern.distinctCommits.push(commitSha);
      }
      if (!existingPattern.languages.includes(language)) {
        existingPattern.languages.push(language);
      }
      // Update example if this one is shorter/cleaner
      if (d.before.length < (existingPattern.occurrences[0]?.before.length ?? Infinity)) {
        existingPattern.occurrences[0] = occurrence;
      }
      existingPattern.confidence = computeConfidence(existingPattern);
      existingPattern.status = updatePatternStatus(existingPattern);
      if (existingPattern.status === 'active' && !existingPattern.promotedAt) {
        existingPattern.promotedAt = now;
      }
    } else {
      const newPattern: Pattern = {
        id: d.fingerprint,
        fingerprint: d.fingerprint,
        category: d.category,
        subcategory: d.subcategory,
        summary: d.summary,
        ruleText: d.ruleText,
        languages: [language],
        status: 'candidate',
        supportCount: 1,
        contradictionCount: 0,
        confidence: 0,
        distinctCommits: [commitSha],
        firstSeenAt: now,
        lastSeenAt: now,
        occurrences: [occurrence],
      };
      newPattern.confidence = computeConfidence(newPattern);
      patternMap.set(d.fingerprint, newPattern);
    }
  }

  return Array.from(patternMap.values());
}
