import { describe, expect, it } from 'vitest';

import { recordApprovalRiskClassified } from '../../../../src/core/approval/decision/index.js';

import { appendFailure, createClassification, createWriter, expectRiskPayload } from './shared.js';

describe('core-03-s2 recordApprovalRiskClassified', () => {
  it('appends a durable risk payload and returns the committed event id', async () => {
    const writer = createWriter();
    const classification = createClassification({
      risk: 'high',
      triggeredRuleIds: ['approval-high-relay-missing'],
      evidenceEventIds: ['evt-agent-request-01', 'evt-attest-relay-01'],
    });

    const result = await recordApprovalRiskClassified(
      {
        requestId: 'request-01',
        classification,
      },
      writer,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.failureState);
    }

    expect(result.value.eventId).toBe('evt-append-01');
    expect(writer.appendCalls[0]?.[0]).toMatchObject({
      domain: 'core-03',
      type: 'ApprovalRiskClassified',
      durability: 'durable',
      occurredAt: classification.classifiedAt,
    });
    expectRiskPayload(result.value.payload, classification);
  });

  it('fails closed when the event log append fails', async () => {
    const result = await recordApprovalRiskClassified(
      {
        requestId: 'request-01',
        classification: createClassification(),
      },
      createWriter(() => ({ ok: false, error: appendFailure })),
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.failureState).toBe('approval-event-log-unavailable');
  });

  it('falls back to the event type when the writer receipt omits event ids', async () => {
    const result = await recordApprovalRiskClassified(
      {
        requestId: 'request-01',
        classification: createClassification(),
      },
      createWriter((batch) => ({
        ok: true,
        value: {
          runId: 'run-approval-01',
          firstSequence: 10,
          lastSequence: 10,
          writerEpoch: 2,
          durability: batch[0]?.durability ?? 'durable',
          eventIds: [],
          payloadDigests: [],
          frameDigest: 'sha256:frame',
          health: 'ok',
        },
      })),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.failureState);
    }

    expect(result.value.eventId).toBe('ApprovalRiskClassified');
  });
});
