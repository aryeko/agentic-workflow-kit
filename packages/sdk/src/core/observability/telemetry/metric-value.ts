import type { EvidenceEventRef } from '../../run-lifecycle/contracts/index.js';

export type MetricValue<T> =
  | {
      state: 'available';
      value: T;
      unit: string;
      evidenceRefs: EvidenceEventRef[];
    }
  | {
      state: 'partial';
      value?: T;
      unit: string;
      missing: string[];
      evidenceRefs: EvidenceEventRef[];
    }
  | {
      state: 'unavailable';
      reason: string;
      evidenceRefs: EvidenceEventRef[];
    };
