import { describe, expect, it } from 'vitest';

import { classifyReplayHealth } from '../../../../src/core/run-lifecycle/replay/health-classifier.js';

import { lifecycleTransitionPayload, makeEnvelope, runId } from './test-support.js';

describe('core-01-s2 health classifier', () => {
  it('classifies ok health with empty replay state', () => {
    expect(classifyReplayHealth(runId, [], 'ok')).toEqual({
      ok: true,
      value: {
        health: 'ok',
        healthRecords: [],
        lastSequence: 0,
        writerEpoch: undefined,
      },
    });
  });

  it('classifies tail-repaired health without a committed repair event deterministically', () => {
    expect(
      classifyReplayHealth(
        runId,
        [makeEnvelope(2, 'RunLifecycleTransitioned', lifecycleTransitionPayload)],
        'log-tail-repaired',
      ),
    ).toEqual({
      ok: true,
      value: {
        health: 'tail-repaired',
        healthRecords: [
          {
            kind: 'tail-repaired',
            detectedAt: '2026-06-23T12:02:01.000Z',
            lastValidSequence: 2,
            storageHealth: 'log-tail-repaired',
            detail: 'fnd-02 replay reported repaired tail bytes',
          },
        ],
        lastSequence: 2,
        writerEpoch: 4,
      },
    });
  });
});
