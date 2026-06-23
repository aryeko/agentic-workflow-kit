import type { StorageHealth } from '../../../foundation/storage/index.js';
import type { Result, RunEventEnvelope, RunLogHealthRecord, RunReplay, RunReplayFailure } from '../contracts/index.js';

import { getTailRepairPayload } from './payload-validator.js';

const tailRepairedDetail = 'fnd-02 replay reported repaired tail bytes';
const interiorCorruptDetail = 'fnd-02 replay reported interior corruption in committed history';

const getDetectedAt = (events: readonly RunEventEnvelope[], runId: string): string =>
  events[events.length - 1]?.recordedAt ?? runId;

const getWriterEpoch = (events: readonly RunEventEnvelope[]): number | undefined =>
  events[events.length - 1]?.writerEpoch;

const getLastSequence = (events: readonly RunEventEnvelope[]): number => events[events.length - 1]?.sequence ?? 0;

export const classifyReplayHealth = (
  runId: string,
  events: readonly RunEventEnvelope[],
  storageHealth: StorageHealth,
): Result<Pick<RunReplay, 'health' | 'healthRecords' | 'lastSequence' | 'writerEpoch'>, RunReplayFailure> => {
  const lastSequence = getLastSequence(events);
  const writerEpoch = getWriterEpoch(events);

  switch (storageHealth) {
    case 'ok':
      return {
        ok: true,
        value: {
          health: 'ok',
          healthRecords: [],
          lastSequence,
          writerEpoch,
        },
      };
    case 'log-tail-repaired': {
      const tailRepairPayload = getTailRepairPayload(events);
      const healthRecord: RunLogHealthRecord = {
        kind: 'tail-repaired',
        detectedAt: tailRepairPayload?.repairedAt ?? getDetectedAt(events, runId),
        lastValidSequence: tailRepairPayload?.lastCommittedSequence ?? lastSequence,
        storageHealth: 'log-tail-repaired',
        detail: tailRepairedDetail,
      };

      return {
        ok: true,
        value: {
          health: 'tail-repaired',
          healthRecords: [healthRecord],
          lastSequence,
          writerEpoch,
        },
      };
    }
    case 'log-interior-corrupt': {
      const healthRecord: RunLogHealthRecord = {
        kind: 'interior-corrupt',
        detectedAt: getDetectedAt(events, runId),
        storageHealth: 'log-interior-corrupt',
        detail: interiorCorruptDetail,
      };

      return {
        ok: false,
        error: {
          code: 'interior-corrupt',
          message: 'Committed run history is interior-corrupt and cannot be replayed safely.',
          healthRecords: [healthRecord],
        },
      };
    }
    case 'network-fs-degraded':
    case 'read-only':
    case 'unusable': {
      const healthRecord: RunLogHealthRecord = {
        kind: 'event-log-unavailable',
        detectedAt: getDetectedAt(events, runId),
        storageHealth,
        detail: `fnd-02 replay reported storage health ${storageHealth}`,
      };

      return {
        ok: false,
        error: {
          code: 'event-log-unavailable',
          message: 'Event log is unavailable for authoritative replay.',
          healthRecords: [healthRecord],
        },
      };
    }
    default: {
      const _exhaustive: never = storageHealth;
      return _exhaustive;
    }
  }
};
