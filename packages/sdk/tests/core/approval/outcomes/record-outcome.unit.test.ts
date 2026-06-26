import { describe, expect, it } from 'vitest';

import { foldApprovalProjection, recordApprovalOutcome } from 'sdk';

import {
  appendFailure,
  createDecision,
  createEvent,
  createRequest,
  createWriter,
  decisionEventId,
  recordedAt,
  runId,
} from './fixtures.js';

describe('recordApprovalOutcome', () => {
  it('appends ApprovalOutcomeRecorded at barrier with minted outcome id and preserved source event ids', async () => {
    const writer = createWriter();
    const result = await recordApprovalOutcome(
      {
        request: createRequest(),
        decision: createDecision(),
        outcome: 'answered',
        agentAnswerEventId: 'evt-agent-answer-01',
        sourceEventIds: [decisionEventId, 'evt-agent-answer-01'],
        recordedAt,
        ids: () => 'outcome-01',
      },
      writer,
    );

    expect(result.ok).toBe(true);
    expect(writer.appendCalls).toHaveLength(1);
    expect(writer.appendCalls[0]).toEqual([
      {
        domain: 'core-03',
        type: 'ApprovalOutcomeRecorded',
        durability: 'barrier',
        occurredAt: recordedAt,
        payload: {
          schema: 'kit-vnext.approval-outcome-recorded.v1',
          outcome: {
            schema: 'kit-vnext.approval-outcome.v1',
            outcomeId: 'outcome-01',
            requestId: 'request-01',
            decisionId: 'decision-01',
            outcome: 'answered',
            agentAnswerEventId: 'evt-agent-answer-01',
            recordedAt,
          },
          sourceEventIds: [decisionEventId, 'evt-agent-answer-01'],
        },
      },
    ]);
    if (result.ok) {
      expect(result.value.eventId).toBe('evt-ApprovalOutcomeRecorded');
      expect(result.value.payload.outcome.outcomeId).toBe('outcome-01');
    }
  });

  it('records failure state and folds into approval projection', async () => {
    const writer = createWriter();
    const result = await recordApprovalOutcome(
      {
        request: createRequest(),
        decision: createDecision({ decision: 'blocked', grant: undefined }),
        outcome: 'blocked',
        failureState: 'approval-grant-mapping-invalid',
        sourceEventIds: [decisionEventId],
        recordedAt,
        ids: () => 'outcome-blocked-01',
      },
      writer,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const projection = foldApprovalProjection(runId, [
      createEvent({
        eventId: result.value.eventId,
        sequence: 31,
        type: 'ApprovalOutcomeRecorded',
        payload: result.value.payload,
      }),
    ]);

    expect(projection.latestOutcomeByRequestId['request-01']).toEqual(result.value.payload.outcome);
    expect(projection.failureStateByRequestId['request-01']).toBe('approval-grant-mapping-invalid');
  });

  it('returns approval-event-log-unavailable when append fails', async () => {
    const writer = createWriter(() => ({ ok: false, error: appendFailure }));
    const result = await recordApprovalOutcome(
      {
        request: createRequest(),
        decision: createDecision(),
        outcome: 'failed',
        lifecycleEventId: 'evt-parked-01',
        sourceEventIds: [decisionEventId, 'evt-parked-01'],
        recordedAt,
        ids: () => 'outcome-failed-01',
      },
      writer,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        reason: 'approval-event-log-unavailable',
        appendFailure,
      },
    });
  });
});
