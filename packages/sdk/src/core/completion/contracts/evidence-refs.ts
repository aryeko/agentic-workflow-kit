import type { EvidenceEventRef } from '../../run-lifecycle/contracts/index.js';

export const dedupeEvidenceEventRefs = (refs: readonly EvidenceEventRef[] | undefined): readonly EvidenceEventRef[] => {
  if (refs === undefined || refs.length === 0) {
    return [];
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
