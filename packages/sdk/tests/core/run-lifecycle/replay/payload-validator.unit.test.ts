import { describe, expect, it } from 'vitest';

import {
  getTailRepairPayload,
  hasValidDeclaredPayload,
} from '../../../../src/core/run-lifecycle/replay/payload-validator.js';

import { lifecycleTransitionPayload, makeEnvelope, runId, tailRepairedPayload } from './test-support.js';

describe('core-01-s2 payload validator', () => {
  it('accepts declared relevant payloads for all replay-owned event types', () => {
    expect(hasValidDeclaredPayload(makeEnvelope(1, 'RunLifecycleTransitioned', lifecycleTransitionPayload))).toBe(true);
    expect(
      hasValidDeclaredPayload(
        makeEnvelope(2, 'SessionLinked', {
          linkOrdinal: 1,
          sessionId: 'session-1',
          linkRole: 'primary',
          startedAt: '2026-06-23T12:02:00.000Z',
          sourceEventId: 'evt-session',
          supersedesOrdinal: 0,
        }),
      ),
    ).toBe(true);
    expect(
      hasValidDeclaredPayload(
        makeEnvelope(3, 'SessionLinkSuperseded', {
          supersededOrdinal: 1,
          replacementOrdinal: 2,
          reason: 'handoff',
          sourceEventId: 'evt-handoff',
        }),
      ),
    ).toBe(true);
    expect(
      hasValidDeclaredPayload(
        makeEnvelope(4, 'RunAppendRejected', {
          attemptedEventId: 'evt-attempt',
          attemptedType: 'RunLifecycleTransitioned',
          attemptedDomain: 'core-01',
          failureCode: 'stale-writer-fenced',
          expectedSequence: 4,
          observedSequence: 5,
          writerEpoch: 4,
          recordedReason: 'writer fenced',
        }),
      ),
    ).toBe(true);
    expect(hasValidDeclaredPayload(makeEnvelope(5, 'RunLogTailRepaired', tailRepairedPayload))).toBe(true);
  });

  it('rejects malformed declared relevant payloads and preserves unknown future types', () => {
    expect(
      hasValidDeclaredPayload(
        makeEnvelope(1, 'RunLifecycleTransitioned', { ...lifecycleTransitionPayload, to: 'bogus' }),
      ),
    ).toBe(false);
    expect(hasValidDeclaredPayload(makeEnvelope(2, 'SessionLinked', { linkOrdinal: 'bad' }))).toBe(false);
    expect(hasValidDeclaredPayload(makeEnvelope(3, 'SessionLinkSuperseded', null))).toBe(false);
    expect(
      hasValidDeclaredPayload(
        makeEnvelope(4, 'RunAppendRejected', { attemptedType: 'x', attemptedDomain: 'core-01', failureCode: 'bad' }),
      ),
    ).toBe(false);
    expect(
      hasValidDeclaredPayload(
        makeEnvelope(5, 'RunAppendRejected', {
          attemptedType: 'RunLifecycleTransitioned',
          attemptedDomain: 'core-01',
          recordedReason: 'missing failure code',
        }),
      ),
    ).toBe(false);
    expect(hasValidDeclaredPayload(makeEnvelope(6, 'UnknownFutureEvent', { runId }))).toBe(true);
  });

  it('finds the latest valid tail repair payload and returns undefined when absent', () => {
    expect(
      getTailRepairPayload([
        makeEnvelope(1, 'RunLogTailRepaired', { repairedAt: 'bad', lastCommittedSequence: 1 }),
        makeEnvelope(2, 'RunLogTailRepaired', tailRepairedPayload),
      ]),
    ).toEqual(tailRepairedPayload);
    expect(
      getTailRepairPayload([makeEnvelope(3, 'RunCreated', { idempotencyKey: 'idem-1', requestedBy: 'runner' })]),
    ).toBeUndefined();
  });
});
