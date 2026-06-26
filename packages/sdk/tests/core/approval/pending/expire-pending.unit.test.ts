import { describe, expect, it } from 'vitest';

import { expireApproval, resumePendingApproval } from '../../../../src/core/approval/pending/index.js';

import {
  createEvent,
  createPendingPayload,
  createProjections,
  createReplay,
  createWriter,
  appendFailure,
  appendReceipt,
  decisionEventId,
  requestId,
  runId,
  sessionId,
} from './fixtures.js';

describe('expireApproval', () => {
  it('records an expired outcome with approval-expired failure state', async () => {
    const writer = createWriter();
    const result = await expireApproval(
      {
        pending: createPendingPayload(),
        decisionEventId,
        evaluatedAt: '2026-06-23T10:16:00.000Z',
        sourceEventIds: ['evt-pending-01'],
      },
      writer,
    );

    expect(result.ok).toBe(true);
    expect(result.value.decision.outcome).toBe('expired');
    expect(writer.appendCalls[0]?.[0]?.payload).toMatchObject({
      outcome: { outcome: 'expired', failureState: 'approval-expired' },
    });
  });

  it('expires pending requests during resume after the final deadline', async () => {
    const writer = createWriter();
    const replay = createReplay([
      createEvent({
        eventId: 'evt-pending-01',
        sequence: 1,
        type: 'ApprovalPendingPersisted',
        payload: createPendingPayload(),
      }),
    ]);

    const result = await resumePendingApproval(
      {
        requestId,
        runId,
        sessionId,
        decisionEventId,
        evaluatedAt: '2026-06-23T10:16:00.000Z',
        replay,
        projections: createProjections(),
      },
      writer,
    );

    expect(result.ok).toBe(true);
    expect(result.value.decision).toMatchObject({ outcome: 'expired', failureState: 'approval-expired' });
  });

  it('fails closed when the expired outcome cannot be appended', async () => {
    const writer = createWriter(() => ({ ok: false, error: appendFailure }));

    const result = await expireApproval(
      {
        pending: createPendingPayload(),
        decisionEventId,
        evaluatedAt: '2026-06-23T10:16:00.000Z',
        sourceEventIds: ['evt-pending-01'],
      },
      writer,
    );

    expect(result).toMatchObject({ ok: false, error: { reason: 'approval-event-log-unavailable' } });
  });

  it('uses a deterministic event id fallback when the expiry receipt omits ids', async () => {
    const writer = createWriter(() => ({ ok: true, value: appendReceipt([]) }));

    const result = await expireApproval(
      {
        pending: createPendingPayload(),
        decisionEventId,
        evaluatedAt: '2026-06-23T10:16:00.000Z',
        sourceEventIds: ['evt-pending-01'],
      },
      writer,
    );

    expect(result.ok).toBe(true);
    expect(result.value.eventId).toBe('ApprovalOutcomeRecorded');
  });
});
