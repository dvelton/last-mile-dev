import type { Pattern, Profile, ProfileRule } from '../types.js';

export function buildProfile(patterns: Pattern[]): Profile {
  const active = patterns.filter(p => p.status === 'active');
  const candidates = patterns.filter(p => p.status === 'candidate');

  const uniqueCommits = new Set<string>();
  const uniqueSnapshots = new Set<string>();
  for (const p of patterns) {
    for (const c of p.distinctCommits) uniqueCommits.add(c);
    for (const o of p.occurrences) uniqueSnapshots.add(o.snapshotId);
  }

  const rules: ProfileRule[] = active
    .sort((a, b) => b.confidence - a.confidence)
    .map(p => {
      const bestOccurrence = p.occurrences[0];
      return {
        patternId: p.id,
        category: p.category,
        text: p.ruleText,
        confidence: p.confidence,
        example: bestOccurrence
          ? { before: bestOccurrence.before, after: bestOccurrence.after }
          : undefined,
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    basedOn: {
      snapshots: uniqueSnapshots.size,
      commits: uniqueCommits.size,
      activePatterns: active.length,
      candidatePatterns: candidates.length,
    },
    rules,
  };
}
