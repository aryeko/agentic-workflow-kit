import { describe, expect, it } from 'vitest';

import type {
  RunAppendRejectedPayload,
  RunCreatedPayload,
  RunLifecycleTransitionPayload,
  RunLogTailRepairedPayload,
  RunPolicyBoundPayload,
  SessionLinkedPayload,
  SessionLinkSupersededPayload,
  TaskSnapshotRecordedPayload,
} from '../../../../src/index.js';

import {
  runAppendRejectedPayloadFixture,
  runCreatedPayloadFixture,
  runLifecycleTransitionPayloadFixture,
  runLogTailRepairedPayloadFixture,
  runPolicyBoundPayloadFixture,
  sessionLinkedPayloadFixture,
  sessionLinkSupersededPayloadFixture,
  taskSnapshotRecordedPayloadFixture,
} from './fixtures.js';

describe('core-01-s1 payload types', () => {
  it('constructs the declared payload fixtures', () => {
    const created: RunCreatedPayload = runCreatedPayloadFixture;
    const policyBound: RunPolicyBoundPayload = runPolicyBoundPayloadFixture;
    const snapshot: TaskSnapshotRecordedPayload = taskSnapshotRecordedPayloadFixture;
    const lifecycle: RunLifecycleTransitionPayload = runLifecycleTransitionPayloadFixture;
    const linked: SessionLinkedPayload = sessionLinkedPayloadFixture;
    const superseded: SessionLinkSupersededPayload = sessionLinkSupersededPayloadFixture;
    const appendRejected: RunAppendRejectedPayload = runAppendRejectedPayloadFixture;
    const tailRepaired: RunLogTailRepairedPayload = runLogTailRepairedPayloadFixture;

    expect(created.operatorRef).toBe('operator://arye');
    expect(policyBound.profile).toBe('strict');
    expect(snapshot.snapshotDigest).toBe('sha256:task-snapshot');
    expect(lifecycle.authority).toBe('policy');
    expect(linked.linkRole).toBe('primary');
    expect(superseded.replacementOrdinal).toBe(2);
    expect(appendRejected.failureCode).toBe('stale-writer-fenced');
    expect(tailRepaired.storageHealth).toBe('log-tail-repaired');
  });
});
