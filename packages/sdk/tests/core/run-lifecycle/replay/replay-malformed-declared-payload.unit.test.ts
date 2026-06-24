import { describe, expect, it } from 'vitest';

import { replay } from '../../../../src/core/run-lifecycle/replay/index.js';

import { digestPayload, makeEnvelope, makeReplayStore, makeStoredRecord, runId } from './test-support.js';

describe('core-01-s2 malformed declared payload replay failures', () => {
  it('fails when a declared relevant payload is malformed', () => {
    for (const envelope of [
      makeEnvelope(1, 'RunCreated', { idempotencyKey: 'idem-1' }),
      makeEnvelope(1, 'RunPolicyBound', { provenanceRef: 'artifact://policy' }),
      makeEnvelope(1, 'TaskSnapshotRecorded', { taskId: 'task-1', sourceRef: 'tracker://task-1' }),
      makeEnvelope(1, 'RunLifecycleTransitioned', {}),
    ]) {
      const result = replay(
        runId,
        makeReplayStore({
          health: 'ok',
          records: [makeStoredRecord(1, envelope)],
        }),
        digestPayload,
      );

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'malformed-declared-payload',
        },
      });
    }
  });
});
