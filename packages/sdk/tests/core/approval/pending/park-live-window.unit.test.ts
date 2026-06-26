import { describe, expect, it } from 'vitest';

import { parkApproval } from '../../../../src/core/approval/pending/index.js';

import {
  appendFailure,
  appendReceipt,
  createRequest,
  createWriter,
  decisionDeadline,
  evaluatedAt,
} from './fixtures.js';

describe('parkApproval recording', () => {
  it.each([
    'live-window-elapsed',
    'live-only-channel',
  ] as const)('records ApprovalParked without an expired outcome for %s before final deadline', async (reason) => {
    const writer = createWriter();

    const result = await parkApproval(
      { request: createRequest(), reason, decisionDeadline, parkedAt: evaluatedAt, sourceEventIds: ['evt-pending-01'] },
      writer,
    );

    expect(result.ok).toBe(true);
    expect(writer.appendCalls[0]?.map((intent) => intent.type)).toEqual(['ApprovalParked']);
    expect(writer.appendCalls[0]?.some((intent) => intent.type === 'ApprovalOutcomeRecorded')).toBe(false);
  });

  it('fails closed when the parked fact cannot be appended', async () => {
    const writer = createWriter(() => ({ ok: false, error: appendFailure }));

    const result = await parkApproval(
      {
        request: createRequest(),
        reason: 'operator-attention',
        decisionDeadline,
        parkedAt: evaluatedAt,
        sourceEventIds: ['evt-pending-01'],
      },
      writer,
    );

    expect(result).toMatchObject({ ok: false, error: { reason: 'approval-event-log-unavailable' } });
  });

  it('uses a deterministic event id fallback when the park receipt omits ids', async () => {
    const writer = createWriter(() => ({ ok: true, value: appendReceipt([]) }));

    const result = await parkApproval(
      {
        request: createRequest(),
        reason: 'operator-attention',
        decisionDeadline,
        parkedAt: evaluatedAt,
        sourceEventIds: ['evt-pending-01'],
      },
      writer,
    );

    expect(result.ok).toBe(true);
    expect(result.value.eventId).toBe('ApprovalParked');
  });
});
