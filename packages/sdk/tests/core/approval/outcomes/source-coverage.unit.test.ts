import { describe, expect, it } from 'vitest';

import { recordApprovalOutcome } from '../../../../src/core/approval/outcomes/index.js';

import {
  appendFailure,
  appendReceipt,
  createDecision,
  createRequest,
  createWriter,
  decisionEventId,
  recordedAt,
} from './fixtures.js';

describe('approval outcomes source coverage', () => {
  it('covers outcome append source branches', async () => {
    const answered = await recordApprovalOutcome(
      {
        request: createRequest(),
        decision: createDecision(),
        outcome: 'answered',
        agentAnswerEventId: 'evt-agent-answer-01',
        failureState: 'approval-outcome-ambiguous',
        sourceEventIds: [decisionEventId, 'evt-agent-answer-01'],
        recordedAt,
        ids: () => 'outcome-answered-01',
      },
      createWriter(),
    );
    const fallbackEventId = await recordApprovalOutcome(
      {
        request: createRequest(),
        decision: createDecision(),
        outcome: 'resumed',
        lifecycleEventId: 'evt-resumed-01',
        sourceEventIds: [decisionEventId, 'evt-resumed-01'],
        recordedAt,
        ids: () => 'outcome-resumed-01',
      },
      createWriter(() => ({ ok: true, value: appendReceipt([]) })),
    );
    const appendFailed = await recordApprovalOutcome(
      {
        request: createRequest(),
        decision: createDecision(),
        outcome: 'failed',
        sourceEventIds: [decisionEventId],
        recordedAt,
        ids: () => 'outcome-failed-01',
      },
      createWriter(() => ({ ok: false, error: appendFailure })),
    );

    expect(answered.ok).toBe(true);
    expect(fallbackEventId.ok).toBe(true);
    if (fallbackEventId.ok) {
      expect(fallbackEventId.value.eventId).toBe('ApprovalOutcomeRecorded');
    }
    expect(appendFailed.ok).toBe(false);
  });
});
