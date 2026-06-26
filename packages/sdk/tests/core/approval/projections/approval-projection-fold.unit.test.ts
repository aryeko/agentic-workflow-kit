import { describe, expect, it } from 'vitest';

import { foldApprovalProjection } from '../../../../src/core/approval/projections/index.js';

import {
  createDecision,
  createEvent,
  createPendingPayload,
  decisionDeadline,
  decisionEventId,
  evaluatedAt,
  requestId,
  runId,
} from '../pending/fixtures.js';

describe('foldApprovalProjection', () => {
  it('deterministically rebuilds pending rows, latest facts, attention, and failure maps', () => {
    const decision = createDecision({ decision: 'human-required', grant: undefined });
    const events = [
      createEvent({
        eventId: 'evt-requested-01',
        sequence: 1,
        type: 'ApprovalRequested',
        payload: {
          schema: 'kit-vnext.approval-requested.v1',
          request: {} as never,
          sourceAgentEventId: 'evt-agent-request-01',
          recordedAt: evaluatedAt,
        },
      }),
      createEvent({
        eventId: 'evt-pending-01',
        sequence: 2,
        type: 'ApprovalPendingPersisted',
        payload: createPendingPayload(),
      }),
      createEvent({
        eventId: decisionEventId,
        sequence: 3,
        type: 'ApprovalDecisionRecorded',
        payload: { schema: 'kit-vnext.approval-decision-recorded.v1', decision, sourceEventIds: ['evt-pending-01'] },
      }),
      createEvent({
        eventId: 'evt-parked-01',
        sequence: 4,
        type: 'ApprovalParked',
        payload: {
          schema: 'kit-vnext.approval-parked.v1',
          requestId,
          runId,
          sessionId: 'session-approval-01',
          reason: 'operator-attention',
          decisionDeadline,
          parkedAt: evaluatedAt,
          sourceEventIds: [decisionEventId],
        },
      }),
      createEvent({
        eventId: 'evt-outcome-01',
        sequence: 5,
        type: 'ApprovalOutcomeRecorded',
        payload: {
          schema: 'kit-vnext.approval-outcome-recorded.v1',
          outcome: {
            schema: 'kit-vnext.approval-outcome.v1',
            outcomeId: 'outcome-01',
            requestId,
            decisionId: decision.decisionId,
            outcome: 'blocked',
            failureState: 'approval-relay-missing',
            recordedAt: evaluatedAt,
          },
          sourceEventIds: ['evt-parked-01'],
        },
      }),
    ];

    const first = foldApprovalProjection(runId, events);
    const second = foldApprovalProjection(runId, [...events].reverse());

    expect(first).toEqual(second);
    expect(first.pendingByRequestId[requestId]).toMatchObject({
      state: 'blocked',
      pendingEventId: 'evt-pending-01',
      latestDecisionEventId: decisionEventId,
      latestOutcomeEventId: 'evt-outcome-01',
      parkedEventId: 'evt-parked-01',
      failureState: 'approval-relay-missing',
    });
    expect(first.latestDecisionByRequestId[requestId]).toEqual(decision);
    expect(first.operatorAttention).toEqual({ requestId, reason: 'parked', sourceEventId: 'evt-parked-01' });
    expect(first.failureStateByRequestId[requestId]).toBe('approval-relay-missing');
  });

  it('folds resumed and answered states while ignoring orphan events', () => {
    const decision = createDecision();
    const events = [
      createEvent({
        eventId: 'evt-orphan-parked-01',
        sequence: 1,
        type: 'ApprovalParked',
        payload: {
          schema: 'kit-vnext.approval-parked.v1',
          requestId: 'unknown-request',
          runId,
          sessionId: 'session-approval-01',
          reason: 'operator-attention',
          decisionDeadline,
          parkedAt: evaluatedAt,
          sourceEventIds: [],
        },
      }),
      createEvent({
        eventId: 'evt-pending-01',
        sequence: 2,
        type: 'ApprovalPendingPersisted',
        payload: createPendingPayload({ liveAnswerDeadline: '2026-06-23T10:01:00.000Z' }),
      }),
      createEvent({
        eventId: decisionEventId,
        sequence: 3,
        type: 'ApprovalDecisionRecorded',
        payload: { schema: 'kit-vnext.approval-decision-recorded.v1', decision, sourceEventIds: ['evt-pending-01'] },
      }),
      createEvent({
        eventId: 'evt-resumed-01',
        sequence: 4,
        type: 'ApprovalResumed',
        payload: {
          schema: 'kit-vnext.approval-resumed.v1',
          requestId,
          runId,
          sessionId: 'session-approval-01',
          decisionEventId,
          grant: decision.grant!,
          resumedAt: evaluatedAt,
          sourceEventIds: [decisionEventId],
        },
      }),
      createEvent({
        eventId: 'evt-outcome-answered-01',
        sequence: 5,
        type: 'ApprovalOutcomeRecorded',
        payload: {
          schema: 'kit-vnext.approval-outcome-recorded.v1',
          outcome: {
            schema: 'kit-vnext.approval-outcome.v1',
            outcomeId: 'outcome-answered-01',
            requestId,
            decisionId: decision.decisionId,
            outcome: 'answered',
            recordedAt: evaluatedAt,
          },
          sourceEventIds: ['evt-resumed-01'],
        },
      }),
      createEvent({
        eventId: 'evt-orphan-resumed-01',
        sequence: 6,
        type: 'ApprovalResumed',
        payload: {
          schema: 'kit-vnext.approval-resumed.v1',
          requestId: 'unknown-request',
          runId,
          sessionId: 'session-approval-01',
          decisionEventId,
          grant: decision.grant!,
          resumedAt: evaluatedAt,
          sourceEventIds: [],
        },
      }),
    ];

    const projection = foldApprovalProjection(runId, events);

    expect(projection.pendingByRequestId[requestId]).toMatchObject({
      state: 'answered',
      liveAnswerDeadline: '2026-06-23T10:01:00.000Z',
      resumedEventId: 'evt-resumed-01',
      latestOutcomeEventId: 'evt-outcome-answered-01',
    });
    expect(projection.operatorAttention).toBeUndefined();
    expect(projection.failureStateByRequestId).toEqual({});
  });

  it('folds grant decisions into auto-granted rows before outcome recording', () => {
    const decision = createDecision();
    const projection = foldApprovalProjection(runId, [
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
        payload: { schema: 'kit-vnext.approval-decision-recorded.v1', decision, sourceEventIds: ['evt-pending-01'] },
      }),
    ]);

    expect(projection.pendingByRequestId[requestId]).toMatchObject({
      state: 'auto-granted',
      latestDecisionEventId: decisionEventId,
    });
    expect(projection.latestDecisionByRequestId[requestId]).toEqual(decision);
  });

  it('folds unknown, orphan decision, and orphan outcome events without pending rows', () => {
    const decision = createDecision({ requestId: 'unknown-request' });
    const projection = foldApprovalProjection(runId, [
      createEvent({ eventId: 'evt-unknown-01', sequence: 1, type: 'UnrelatedEvent', payload: {} }),
      createEvent({
        eventId: 'evt-orphan-decision-02',
        sequence: 2,
        type: 'ApprovalDecisionRecorded',
        payload: { schema: 'kit-vnext.approval-decision-recorded.v1', decision, sourceEventIds: [] },
      }),
      createEvent({
        eventId: 'evt-orphan-decision-01',
        sequence: 2,
        type: 'ApprovalDecisionRecorded',
        payload: { schema: 'kit-vnext.approval-decision-recorded.v1', decision, sourceEventIds: [] },
      }),
      createEvent({
        eventId: 'evt-orphan-outcome-01',
        sequence: 3,
        type: 'ApprovalOutcomeRecorded',
        payload: {
          schema: 'kit-vnext.approval-outcome-recorded.v1',
          outcome: {
            schema: 'kit-vnext.approval-outcome.v1',
            outcomeId: 'outcome-orphan-01',
            requestId: 'unknown-request',
            decisionId: decision.decisionId,
            outcome: 'answered',
            recordedAt: evaluatedAt,
          },
          sourceEventIds: [],
        },
      }),
    ]);

    expect(projection.pendingByRequestId).toEqual({});
    expect(projection.latestDecisionByRequestId['unknown-request']).toEqual(decision);
    expect(projection.latestOutcomeByRequestId['unknown-request']).toMatchObject({ outcome: 'answered' });
  });
});
