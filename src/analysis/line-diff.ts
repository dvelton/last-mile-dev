import { diffLines, type Change } from 'diff';
import type { LineRange } from '../types.js';

export interface LineDiffResult {
  removed: string[];
  added: string[];
  hunks: DiffHunk[];
}

export interface DiffHunk {
  removedStart: number;
  removedLines: string[];
  addedStart: number;
  addedLines: string[];
}

export function computeLineDiff(original: string, modified: string): LineDiffResult {
  const changes = diffLines(original, modified);
  const removed: string[] = [];
  const added: string[] = [];
  const hunks: DiffHunk[] = [];

  let lineNum = 0;
  let currentHunk: DiffHunk | null = null;

  for (const change of changes) {
    const lines = splitClean(change.value);

    if (change.removed) {
      if (!currentHunk) {
        currentHunk = { removedStart: lineNum, removedLines: [], addedStart: lineNum, addedLines: [] };
      }
      currentHunk.removedLines.push(...lines);
      removed.push(...lines);
      lineNum += lines.length;
    } else if (change.added) {
      if (!currentHunk) {
        currentHunk = { removedStart: lineNum, removedLines: [], addedStart: lineNum, addedLines: [] };
      }
      currentHunk.addedLines.push(...lines);
      added.push(...lines);
    } else {
      if (currentHunk) {
        hunks.push(currentHunk);
        currentHunk = null;
      }
      lineNum += lines.length;
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return { removed, added, hunks };
}

export function computeAiTouchedRanges(baseline: string, snapshot: string): LineRange[] {
  const changes = diffLines(baseline, snapshot);
  const ranges: LineRange[] = [];
  let lineNum = 0;

  for (const change of changes) {
    const lines = splitClean(change.value);

    if (change.added) {
      ranges.push({ startLine: lineNum, endLine: lineNum + lines.length - 1 });
      lineNum += lines.length;
    } else if (change.removed) {
      // removed lines from baseline don't advance snapshot line numbers
    } else {
      lineNum += lines.length;
    }
  }

  return mergeRanges(ranges);
}

function mergeRanges(ranges: LineRange[]): LineRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.startLine - b.startLine);
  const merged: LineRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    if (current.startLine <= last.endLine + 2) {
      last.endLine = Math.max(last.endLine, current.endLine);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

export function filterToRanges(hunks: DiffHunk[], ranges: LineRange[]): DiffHunk[] {
  if (ranges.length === 0) return hunks;
  return hunks.filter(hunk => {
    const hunkStart = hunk.removedStart;
    const hunkEnd = hunkStart + Math.max(hunk.removedLines.length, hunk.addedLines.length);
    return ranges.some(r =>
      hunkStart <= r.endLine + 3 && hunkEnd >= r.startLine - 3
    );
  });
}

function splitClean(text: string): string[] {
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}
