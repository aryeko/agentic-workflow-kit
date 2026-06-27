import { describe, expect, it } from 'vitest';

import { recordMergeIntent } from '../../../../src/core/completion/intents/index.js';

import {
  appendReceipt,
  createGateRecord,
  createMergeDecision,
  createMergeInput,
  createWriter,
  gateRef,
  headSha,
  policyRef,
} from './shared.js';

describe('core-05-s4 merge intent recording', () => {
  it('merge-intent-ready records enqueue and merge only after merge-ready', async () => {
    const operations = ['enqueue', 'merge'] as const;
    const writer = createWriter();

    for (const operation of operations) {
      const result = await recordMergeIntent(createMergeInput({ operation }), { writer });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(result.error.token);
      }

      expect(result.value.intent).toMatchObject({
        schema: 'kit-vnext.merge-intent-recorded.v1',
        operation,
        expectedHeadSha: headSha,
        policyRef,
        gateEventId: gateRef.eventId,
        mergeDecisionEventId: 'evt-merge-decision-01',
      });
      expect(writer.appendCalls.at(-1)?.[0]).toMatchObject({
        domain: 'core-05',
        type: 'MergeIntentRecorded',
        durability: 'barrier',
      });
    }
  });

  it('merge-intent-not-ready-rejected returns the producer state with no append', async () => {
    const states = [
      'merge-policy-disabled',
      'merge-required-check-missing',
      'merge-required-check-failed',
      'merge-review-not-approved',
      'merge-unresolved-review-threads',
      'merge-protection-snapshot-stale',
      'merge-branch-not-fresh',
      'merge-forge-unavailable',
      'merge-capability-denied',
      'merge-intent-unwritable',
    ] as const;

    for (const state of states) {
      const writer = createWriter();
      const result = await recordMergeIntent(
        createMergeInput({ mergeDecision: { eventId: 'evt-merge-decision-01', decision: createMergeDecision(state) } }),
        { writer },
      );

      expect(result.ok).toBe(false);
      expect(result.ok ? undefined : result.error.token).toBe(state);
      expect(writer.appendCalls).toHaveLength(0);
    }
  });

  it('rejects ambiguous head and gate mismatches exactly', async () => {
    const missingGate = await recordMergeIntent(createMergeInput({ gateEventId: undefined }), {
      writer: createWriter(),
    });
    expect(missingGate.ok).toBe(false);
    expect(missingGate.ok ? undefined : missingGate.error.token).toBe('merge-capability-denied');

    const deniedGate = await recordMergeIntent(
      createMergeInput({
        mergeDecision: {
          eventId: 'evt-merge-decision-01',
          decision: createMergeDecision('merge-ready', { gateRef: createGateRecord({ decision: 'deny' }) }),
        },
      }),
      { writer: createWriter() },
    );
    expect(deniedGate.ok).toBe(false);
    expect(deniedGate.ok ? undefined : deniedGate.error.token).toBe('merge-capability-denied');

    const policyMismatch = await recordMergeIntent(
      createMergeInput({
        mergeDecision: {
          eventId: 'evt-merge-decision-01',
          decision: createMergeDecision('merge-ready', { gateRef: createGateRecord({ policyRef: 'policy:other' }) }),
        },
      }),
      { writer: createWriter() },
    );
    expect(policyMismatch.ok).toBe(false);
    expect(policyMismatch.ok ? undefined : policyMismatch.error.token).toBe('merge-capability-denied');

    const headMismatch = await recordMergeIntent(
      createMergeInput({
        mergeDecision: {
          eventId: 'evt-merge-decision-01',
          decision: createMergeDecision('merge-ready', {
            headSha: 'head-other-01',
            gateRef: createGateRecord({ scope: { ...createGateRecord().scope, expectedHeadSha: headSha } }),
          }),
        },
      }),
      { writer: createWriter() },
    );
    expect(headMismatch.ok).toBe(false);
    expect(headMismatch.ok ? undefined : headMismatch.error.token).toBe('merge-head-ambiguous');
  });

  it('intent-append-unwritable returns merge-intent-unwritable with no success payload', async () => {
    const writer = createWriter(() => ({
      ok: false,
      error: { code: 'event-log-unavailable', message: 'down', retryable: true },
    }));

    const result = await recordMergeIntent(createMergeInput(), { writer });

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.token).toBe('merge-intent-unwritable');
  });

  it('falls back to the default merge intent event id when the append receipt omits event ids', async () => {
    const writer = createWriter(() => ({
      ok: true,
      value: {
        ...appendReceipt,
        eventIds: [],
      },
    }));

    const result = await recordMergeIntent(createMergeInput(), { writer });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.value.intentEventId : undefined).toBe('MergeIntentRecorded');
  });
});
