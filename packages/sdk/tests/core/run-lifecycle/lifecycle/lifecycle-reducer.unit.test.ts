import { describe, expect, it } from 'vitest';

import { reduceRunLifecycle } from '../../../../src/core/run-lifecycle/lifecycle/index.js';
import { makeEventEnvelope, makeLifecycleEnvelope, makeReference, makeTransitionPayload } from './fixtures.js';

describe('core-01-s3 lifecycle reducer', () => {
  it('moves lifecycle only on RunLifecycleTransitioned events', () => {
    const configured = reduceRunLifecycle([
      makeEventEnvelope('RunCreated', 1, { idempotencyKey: 'idem', requestedBy: 'operator' }),
      makeLifecycleEnvelope(
        2,
        makeTransitionPayload({
          from: null,
          to: 'created',
          sourceEventIds: [makeReference('RunCreated', 'created')],
        }),
      ),
      makeEventEnvelope('RunPolicyBound', 3, {
        policyDigest: 'sha256:policy',
        provenanceRef: 'artifact://policy',
      }),
      makeLifecycleEnvelope(
        4,
        makeTransitionPayload({
          from: 'created',
          to: 'configured',
          sourceEventIds: [makeReference('RunPolicyBound', 'configured')],
        }),
      ),
    ]);

    const factualOnly = reduceRunLifecycle([
      makeEventEnvelope('RunCreated', 1, { idempotencyKey: 'idem', requestedBy: 'operator' }),
      makeEventEnvelope('RunPolicyBound', 2, {
        policyDigest: 'sha256:policy',
        provenanceRef: 'artifact://policy',
      }),
      makeEventEnvelope('TaskSnapshotRecorded', 3, {
        taskId: 'task-1',
        sourceRef: 'tracker://task-1',
        snapshotDigest: 'sha256:snapshot',
      }),
      makeEventEnvelope('SessionLinked', 4, {
        linkOrdinal: 1,
        sessionId: 'session-1',
        linkRole: 'primary',
        startedAt: '2026-06-23T12:00:00.000Z',
        sourceEventId: 'evt-session-linked',
      }),
    ]);

    expect(configured.lifecycle).toBe('configured');
    expect(factualOnly.lifecycle).toBeNull();
    expect(factualOnly.currentSequence).toBeUndefined();
  });
});
