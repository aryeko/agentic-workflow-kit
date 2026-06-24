import type { StorageHealth } from '../../../foundation/storage/index.js';

export type RunLogCorruptionRecord = {
  kind: 'tail-repaired' | 'interior-corrupt';
  detectedAt: string;
  firstAffectedSequence?: number;
  lastValidSequence?: number;
  storageHealth: Extract<StorageHealth, 'log-tail-repaired' | 'log-interior-corrupt'>;
  detail: string;
};

export type RunLogHealthRecord =
  | RunLogCorruptionRecord
  | {
      kind: 'event-log-unavailable';
      detectedAt: string;
      storageHealth: Extract<StorageHealth, 'network-fs-degraded' | 'read-only' | 'unusable'>;
      detail: string;
    };
