import { describe, expect, it } from 'vitest';

import { recordApprovalDecision } from '../../../../src/core/approval/decision/index.js';

import {
  appendFailure,
  createDecision,
  createProtectedPolicyBinding,
  createRequest,
  createWriter,
  expectDecisionPayload,
} from './shared.js';

describe('core-03-s2 recordApprovalDecision', () => {
  it('appends a barrier decision payload and returns the committed event id', async () => {
    const writer = createWriter();
    const decision = createDecision();

    const result = await recordApprovalDecision(
      {
        request: createRequest(),
        decision,
        sourceEventIds: ['evt-agent-request-01', 'evt-risk-01'],
        capabilityGateEventId: 'evt-gate-allow-01',
      },
      writer,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.eventId).toBe('evt-append-01');
    expect(writer.appendCalls[0]?.[0]).toMatchObject({
      domain: 'core-03',
      type: 'ApprovalDecisionRecorded',
      durability: 'barrier',
      occurredAt: decision.decidedAt,
    });
    expectDecisionPayload(result.value.payload, decision);
  });

  it('requires protectedPolicyBinding for protected-policy-change requests', async () => {
    const result = await recordApprovalDecision(
      {
        request: createRequest({ subject: 'protected-policy-change' }),
        decision: createDecision(),
        sourceEventIds: ['evt-agent-request-01'],
      },
      createWriter(),
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.reason).toBe('protected-policy-binding-required');
  });

  it('rejects protectedPolicyBinding for non-protected subjects', async () => {
    const result = await recordApprovalDecision(
      {
        request: createRequest(),
        decision: createDecision(),
        sourceEventIds: ['evt-agent-request-01'],
        protectedPolicyBinding: createProtectedPolicyBinding(),
      },
      createWriter(),
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.reason).toBe('protected-policy-binding-forbidden');
  });

  it('returns approval-event-log-unavailable when the decision append fails', async () => {
    const result = await recordApprovalDecision(
      {
        request: createRequest(),
        decision: createDecision(),
        sourceEventIds: ['evt-agent-request-01'],
      },
      createWriter(() => ({ ok: false, error: appendFailure })),
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.reason).toBe('approval-event-log-unavailable');
  });

  it('records a protected-policy binding when the request subject requires it', async () => {
    const binding = createProtectedPolicyBinding();
    const result = await recordApprovalDecision(
      {
        request: createRequest({ subject: 'protected-policy-change' }),
        decision: createDecision({ reason: 'operator-approved' }),
        sourceEventIds: ['evt-agent-request-01', 'evt-operator-decision-01'],
        operatorDecisionEventId: 'evt-operator-decision-01',
        protectedPolicyBinding: binding,
      },
      createWriter((batch) => ({
        ok: true,
        value: {
          runId: 'run-approval-01',
          firstSequence: 11,
          lastSequence: 11,
          writerEpoch: 2,
          durability: batch[0]?.durability ?? 'barrier',
          eventIds: [],
          payloadDigests: [],
          frameDigest: 'sha256:frame',
          health: 'ok',
        },
      })),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.payload.operatorDecisionEventId).toBe('evt-operator-decision-01');
    expect(result.value.payload.protectedPolicyBinding).toEqual(binding);
    expect(result.value.eventId).toBe('ApprovalDecisionRecorded');
  });
});
