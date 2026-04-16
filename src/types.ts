export type LanguageId = 'typescript' | 'javascript' | 'python' | 'unknown';
export type SnapshotStatus = 'open' | 'committed' | 'learned';
export type PatternStatus = 'candidate' | 'active' | 'stale';

export type PatternCategory =
  | 'formatting'
  | 'imports'
  | 'types'
  | 'syntax'
  | 'control-flow'
  | 'error-handling'
  | 'async'
  | 'naming'
  | 'comments'
  | 'structure';

export interface LineRange {
  startLine: number;
  endLine: number;
}

export interface SnapshotFile {
  path: string;
  language: LanguageId;
  baselineHash: string;
  snapshotHash: string;
  contentFile: string;
  aiLineRanges: LineRange[];
}

export interface Snapshot {
  id: string;
  createdAt: string;
  source: 'manual' | 'hook' | 'watch';
  gitHead: string;
  branch: string;
  status: SnapshotStatus;
  files: SnapshotFile[];
}

export interface PatternOccurrence {
  snapshotId: string;
  commit: string;
  filePath: string;
  language: LanguageId;
  before: string;
  after: string;
  observedAt: string;
}

export interface Pattern {
  id: string;
  fingerprint: string;
  category: PatternCategory;
  subcategory: string;
  summary: string;
  ruleText: string;
  languages: LanguageId[];
  status: PatternStatus;
  supportCount: number;
  contradictionCount: number;
  confidence: number;
  distinctCommits: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  promotedAt?: string;
  occurrences: PatternOccurrence[];
}

export type ExportFormat = 'copilot-instructions' | 'claude';

export interface ProfileRule {
  patternId: string;
  category: PatternCategory;
  text: string;
  confidence: number;
  example?: { before: string; after: string };
}

export interface Profile {
  generatedAt: string;
  basedOn: {
    snapshots: number;
    commits: number;
    activePatterns: number;
    candidatePatterns: number;
  };
  rules: ProfileRule[];
}

export interface Meta {
  version: number;
  repoRoot: string;
  initializedAt: string;
  lastLearnAt?: string;
  totalSnapshots: number;
  totalCommitsAnalyzed: number;
  totalPatternsExtracted: number;
  hookInstalled: boolean;
}
