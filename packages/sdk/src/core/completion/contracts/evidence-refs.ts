import type { EvidenceEventRef } from '../../run-lifecycle/contracts/index.js';

export interface DedupeEvidenceEventRefsOptions {
  readonly duplicate?: 'first' | 'last';
}

export const dedupeEvidenceEventRefs = (
  refs: readonly EvidenceEventRef[] | undefined,
  options: DedupeEvidenceEventRefsOptions = {},
): readonly EvidenceEventRef[] => {
  if (refs === undefined || refs.length === 0) {
    return [];
  }

  if (options.duplicate === 'last') {
    return [...new Map(refs.map((ref) => [ref.eventId, ref])).values()];
  }

  const seen = new Set<string>();
  const unique: EvidenceEventRef[] = [];
  for (const ref of refs) {
    if (seen.has(ref.eventId)) {
      continue;
    }

    seen.add(ref.eventId);
    unique.push(ref);
  }

  return unique;
};
