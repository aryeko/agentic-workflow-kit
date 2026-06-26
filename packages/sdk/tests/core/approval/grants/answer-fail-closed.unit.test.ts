import { describe, expect, it } from 'vitest';

import { answerApprovalDecision } from 'sdk';

import { createDecision, createRelay, createRequest, decisionEventId } from './fixtures.js';

describe('answerApprovalDecision fail-closed behavior', () => {
  it('returns approval-relay-missing when no relay is available', async () => {
    const result = await answerApprovalDecision({
      request: createRequest(),
      decision: createDecision(),
      decisionEventId,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        failureState: 'approval-relay-missing',
        reason: 'approval relay is missing',
      },
    });
  });

  it('returns approval-answer-channel-lost when the relay cannot deliver or persist the answer', async () => {
    const result = await answerApprovalDecision({
      request: createRequest(),
      decision: createDecision(),
      decisionEventId,
      relay: createRelay({
        delivered: false,
        persisted: false,
        channelRef: 'channel-01',
        evidenceRef: 'evidence:answer-01',
        at: '2026-06-26T09:05:00.000Z',
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.failureState).toBe('approval-answer-channel-lost');
    }
  });

  it('returns approval-answer-channel-lost when the relay reports a failed answer write', async () => {
    const relay = {
      answerApproval() {
        return { ok: false as const, error: { reason: 'channel-lost' as const } };
      },
    };

    const result = await answerApprovalDecision({
      request: createRequest(),
      decision: createDecision(),
      decisionEventId,
      relay,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.failureState).toBe('approval-answer-channel-lost');
    }
  });

  it('returns approval-outcome-ambiguous when Agent answer evidence contradicts the request channel', async () => {
    const result = await answerApprovalDecision({
      request: createRequest(),
      decision: createDecision(),
      decisionEventId,
      relay: createRelay({
        delivered: true,
        persisted: true,
        channelRef: 'other-channel',
        evidenceRef: 'evidence:answer-01',
        at: '2026-06-26T09:05:00.000Z',
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.failureState).toBe('approval-outcome-ambiguous');
    }
  });

  it('returns approval-outcome-ambiguous when Agent answer evidence is missing', async () => {
    const result = await answerApprovalDecision({
      request: createRequest(),
      decision: createDecision(),
      decisionEventId,
      relay: createRelay({
        delivered: true,
        persisted: true,
        channelRef: 'channel-01',
        at: '2026-06-26T09:05:00.000Z',
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.failureState).toBe('approval-outcome-ambiguous');
    }
  });
});
