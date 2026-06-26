import { describe, expect, it } from 'vitest';

import { recordApprovalPending } from '../../../../src/core/approval/pending/index.js';

import {
  appendReceipt,
  createEvent,
  createReplay,
  createRequest,
  createWriter,
  decisionDeadline,
  requestId,
  requestedAt,
  runId,
  sessionId,
} from './fixtures.js';

describe('recordApprovalPending', () => {
  it('appends ApprovalRequested before ApprovalPendingPersisted in one barrier batch', async () => {
    const writer = createWriter();
    const request = createRequest();

    const result = await recordApprovalPending({ request, recordedAt: requestedAt }, writer);

    expect(result.ok).toBe(true);
    expect(writer.appendCalls).toHaveLength(1);
    expect(writer.appendCalls[0]?.map((intent) => intent.type)).toEqual([
      'ApprovalRequested',
      'ApprovalPendingPersisted',
    ]);
    expect(writer.appendCalls[0]?.every((intent) => intent.durability === 'barrier')).toBe(true);
    expect(writer.appendCalls[0]?.some((intent) => intent.type === 'ApprovalDecisionRecorded')).toBe(false);
    expect(writer.appendCalls[0]?.[0]?.eventId).toBe(result.value.requestEventId);
    expect(result.value.pendingPayload.sourceRequestEventId).toBe(result.value.requestEventId);
  });

  it('fails closed when the request or pending batch cannot be recorded', async () => {
    const writer = createWriter(() => ({
      ok: false,
      error: { code: 'event-log-unavailable', message: 'unavailable', retryable: true },
    }));

    const result = await recordApprovalPending({ request: createRequest(), recordedAt: requestedAt }, writer);

    expect(result).toMatchObject({ ok: false, error: { reason: 'approval-request-unrecordable' } });
    expect(writer.appendCalls).toHaveLength(1);
  });

  it('uses deterministic event id fallbacks when the append receipt omits ids', async () => {
    const writer = createWriter(() => ({ ok: true, value: appendReceipt([]) }));

    const result = await recordApprovalPending(
      { request: createRequest(), recordedAt: requestedAt, liveAnswerDeadline: '2026-06-23T10:01:00.000Z' },
      writer,
    );

    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({
      requestEventId: 'ApprovalRequested',
      pendingEventId: 'ApprovalPendingPersisted',
      pendingPayload: { liveAnswerDeadline: '2026-06-23T10:01:00.000Z' },
    });
  });

  it('fails closed without appending when replay evidence already contains the request', async () => {
    const writer = createWriter();
    const request = createRequest();

    const result = await recordApprovalPending(
      {
        request,
        recordedAt: requestedAt,
        replay: createReplay([
          createEvent({
            eventId: 'evt-requested-01',
            sequence: 1,
            type: 'ApprovalRequested',
            payload: {
              schema: 'kit-vnext.approval-requested.v1',
              request,
              sourceAgentEventId: request.agentRequestEventId,
              recordedAt: requestedAt,
            },
          }),
        ]),
      },
      writer,
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        reason: 'approval-request-unrecordable',
        appendFailure: { code: 'sequence-conflict' },
      },
    });
    expect(writer.appendCalls).toEqual([]);
  });

  it('fails closed without appending when projection evidence already contains the request', async () => {
    const writer = createWriter();

    const result = await recordApprovalPending(
      {
        request: createRequest(),
        recordedAt: requestedAt,
        approvalProjection: {
          runId,
          pendingByRequestId: {
            [requestId]: {
              requestId,
              runId,
              sessionId,
              state: 'pending',
              requestEventId: 'evt-requested-01',
              pendingEventId: 'evt-pending-01',
              answerChannelRef: 'channel-01',
              answerChannelPersistable: true,
              decisionDeadline,
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

    expect(result).toMatchObject({
      ok: false,
      error: {
        reason: 'approval-request-unrecordable',
        appendFailure: { code: 'sequence-conflict' },
      },
    });
    expect(writer.appendCalls).toEqual([]);
  });
});
