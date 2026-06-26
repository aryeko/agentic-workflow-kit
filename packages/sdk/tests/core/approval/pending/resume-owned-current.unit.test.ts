import { describe, expect, it } from 'vitest';

import { resumePendingApproval } from '../../../../src/core/approval/pending/index.js';

import {
  createAttestationEvent,
  createDecision,
  createEvent,
  createPendingPayload,
  createProjections,
  createReplay,
  createWriter,
  appendFailure,
  appendReceipt,
  decisionEventId,
  evaluatedAt,
  grant,
  requestId,
  runId,
  sessionId,
} from './fixtures.js';

describe('resumePendingApproval', () => {
  it('resumes only a current owned session with grant and fresh positive attestations', async () => {
    const writer = createWriter();
    const replay = createReplay([
      createEvent({
        eventId: 'evt-pending-01',
        sequence: 1,
        type: 'ApprovalPendingPersisted',
        payload: createPendingPayload(),
      }),
      createEvent({
        eventId: decisionEventId,
        sequence: 2,
        type: 'ApprovalDecisionRecorded',
        payload: {
          schema: 'kit-vnext.approval-decision-recorded.v1',
          decision: createDecision(),
          sourceEventIds: ['evt-pending-01'],
        },
      }),
      createAttestationEvent('evt-resume-01', 3, 'canResumeOwned'),
      createAttestationEvent('evt-relay-01', 4, 'canRelayApproval'),
      createAttestationEvent('evt-persist-01', 5, 'canPersistApprovalAnswerChannel'),
    ]);

    const result = await resumePendingApproval(
      { requestId, runId, sessionId, decisionEventId, evaluatedAt, replay, projections: createProjections() },
      writer,
    );

    expect(result.ok).toBe(true);
    expect(result.value.decision).toMatchObject({ outcome: 'resume', grant });
    expect(result.value.decision.sourceEventIds).toEqual([
      'evt-pending-01',
      decisionEventId,
      'evt-session-linked-01',
      'evt-resume-01',
      'evt-relay-01',
      'evt-persist-01',
    ]);
    expect(writer.appendCalls[0]?.map((intent) => intent.type)).toEqual(['ApprovalResumed']);
  });

  it('can resume from a folded approval projection without requiring a persistable-channel attestation', async () => {
    const writer = createWriter();
    const replay = createReplay([
      createEvent({
        eventId: decisionEventId,
        sequence: 2,
        type: 'ApprovalDecisionRecorded',
        payload: {
          schema: 'kit-vnext.approval-decision-recorded.v1',
          decision: createDecision(),
          sourceEventIds: ['evt-pending-01'],
        },
      }),
      createAttestationEvent('evt-resume-01', 3, 'canResumeOwned'),
      createAttestationEvent('evt-relay-01', 4, 'canRelayApproval'),
    ]);

    const result = await resumePendingApproval(
      {
        requestId,
        runId,
        sessionId,
        decisionEventId,
        evaluatedAt,
        replay,
        projections: createProjections(),
        approvalProjection: {
          runId,
          pendingByRequestId: {
            [requestId]: {
              requestId,
              runId,
              sessionId,
              state: 'parked',
              requestEventId: 'evt-requested-01',
              pendingEventId: 'evt-pending-01',
              answerChannelRef: 'channel-01',
              answerChannelPersistable: false,
              decisionDeadline: '2026-06-23T10:15:00.000Z',
              policyRef: 'policy:approval',
            },
          },
          latestDecisionByRequestId: {},
          latestOutcomeByRequestId: {},
          failureStateByRequestId: {},
        },
      },
      writer,
    );

    expect(result.ok).toBe(true);
    expect(result.value.decision.outcome).toBe('resume');
  });

  it('fails closed when the resume fact cannot be appended', async () => {
    const writer = createWriter(() => ({ ok: false, error: appendFailure }));
    const replay = createReplay([
      createEvent({
        eventId: 'evt-pending-01',
        sequence: 1,
        type: 'ApprovalPendingPersisted',
        payload: createPendingPayload(),
      }),
      createEvent({
        eventId: decisionEventId,
        sequence: 2,
        type: 'ApprovalDecisionRecorded',
        payload: {
          schema: 'kit-vnext.approval-decision-recorded.v1',
          decision: createDecision(),
          sourceEventIds: ['evt-pending-01'],
        },
      }),
      createAttestationEvent('evt-resume-01', 3, 'canResumeOwned'),
      createAttestationEvent('evt-relay-01', 4, 'canRelayApproval'),
      createAttestationEvent('evt-persist-01', 5, 'canPersistApprovalAnswerChannel'),
    ]);

    const result = await resumePendingApproval(
      { requestId, runId, sessionId, decisionEventId, evaluatedAt, replay, projections: createProjections() },
      writer,
    );

    expect(result).toMatchObject({ ok: false, error: { reason: 'approval-event-log-unavailable' } });
  });

  it('allows owned-remote recovery linkage and uses event id fallback when needed', async () => {
    const writer = createWriter(() => ({ ok: true, value: appendReceipt([]) }));
    const replay = createReplay([
      createEvent({
        eventId: 'evt-pending-01',
        sequence: 1,
        type: 'ApprovalPendingPersisted',
        payload: createPendingPayload(),
      }),
      createEvent({
        eventId: decisionEventId,
        sequence: 2,
        type: 'ApprovalDecisionRecorded',
        payload: {
          schema: 'kit-vnext.approval-decision-recorded.v1',
          decision: createDecision(),
          sourceEventIds: ['evt-pending-01'],
        },
      }),
      createAttestationEvent('evt-resume-01', 3, 'canResumeOwned'),
      createAttestationEvent('evt-relay-01', 4, 'canRelayApproval'),
      createAttestationEvent('evt-persist-01', 5, 'canPersistApprovalAnswerChannel'),
    ]);

    const result = await resumePendingApproval(
      {
        requestId,
        runId,
        sessionId,
        decisionEventId,
        evaluatedAt,
        replay,
        projections: createProjections({
          launch: {
            linkage: 'known',
            currentSession: {
              linkOrdinal: 2,
              sessionId,
              linkRole: 'recovery',
              startedAt: evaluatedAt,
              sourceEventId: 'evt-session-linked-recovery-01',
            },
            linkHistory: [],
          },
        }),
      },
      writer,
    );

    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({ eventId: 'ApprovalResumed', decision: { outcome: 'resume' } });
  });
});
