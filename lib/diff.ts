import { diffWords } from 'diff';

export interface DiffSegment {
  value: string;
  type: 'added' | 'removed' | 'unchanged';
}

export function computeWordDiff(original: string, proposed: string): DiffSegment[] {
  const changes = diffWords(original, proposed);
  return changes.map((change) => ({
    value: change.value,
    type: change.added ? 'added' : change.removed ? 'removed' : 'unchanged',
  }));
}
