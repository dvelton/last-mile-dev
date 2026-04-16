import type { Pattern, PatternStatus } from '../types.js';
import {
  MIN_PROMOTION_OCCURRENCES,
  MIN_PROMOTION_COMMITS,
  PROMOTION_CONFIDENCE_THRESHOLD,
  STALE_AFTER_DAYS,
} from '../config.js';
import { daysBetween } from '../utils.js';

export function computeConfidence(pattern: Pattern): number {
  const support = pattern.supportCount;
  const contradiction = pattern.contradictionCount;
  const total = support + contradiction;
  if (total === 0) return 0;

  const ratio = support / total;

  // Reward patterns seen across multiple commits
  const commitSpread = Math.min(pattern.distinctCommits.length / MIN_PROMOTION_COMMITS, 1);

  // Recency boost: patterns seen recently score higher
  const now = new Date().toISOString();
  const daysSinceLast = daysBetween(pattern.lastSeenAt, now);
  const recency = Math.max(0, 1 - daysSinceLast / STALE_AFTER_DAYS);

  return ratio * 0.5 + commitSpread * 0.3 + recency * 0.2;
}

export function shouldPromote(pattern: Pattern): boolean {
  return (
    pattern.status === 'candidate' &&
    pattern.supportCount >= MIN_PROMOTION_OCCURRENCES &&
    pattern.distinctCommits.length >= MIN_PROMOTION_COMMITS &&
    pattern.confidence >= PROMOTION_CONFIDENCE_THRESHOLD
  );
}

export function shouldMarkStale(pattern: Pattern): boolean {
  if (pattern.status !== 'active') return false;
  const now = new Date().toISOString();
  const daysSinceLast = daysBetween(pattern.lastSeenAt, now);
  return daysSinceLast > STALE_AFTER_DAYS;
}

export function updatePatternStatus(pattern: Pattern): PatternStatus {
  if (shouldMarkStale(pattern)) return 'stale';
  if (shouldPromote(pattern)) return 'active';
  return pattern.status;
}
