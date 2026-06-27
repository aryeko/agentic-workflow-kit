import { describe, expect, it } from 'vitest';

import { evaluateMergeReadiness } from '../../../../src/core/completion/merge-readiness/index.js';

import { createEvaluateInput, createWriter, forgeRef, runId } from './shared.js';

describe('core-05-s3 merge decision recording', () => {
  it('merge-decision-append-fields records the expected payload', async () => {
    const input = createEvaluateInput();
    const writer = createWriter();

    const result = await evaluateMergeReadiness(input, { writer });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.token);
    }

    expect(result.value.decision).toMatchObject({
      schema: 'kit-vnext.merge-decision-recorded.v1',
      runId,
      state: 'merge-ready',
      headSha: input.candidateHeadSha,
      completionEventId: input.completionDecision.eventId,
      gateRef: input.gate?.record,
      forgeRefs: [forgeRef],
      evaluatedAt: input.evaluatedAt,
    });
    expect(result.value.decisionEventId).toBe('evt-merge-decision-01');
    expect(writer.appendCalls.at(-1)?.[0]).toMatchObject({
      domain: 'core-05',
      type: 'MergeDecisionRecorded',
      durability: 'barrier',
    });
  });

  it('merge-decision-unwritable returns merge-intent-unwritable with no success payload', async () => {
    const result = await evaluateMergeReadiness(createEvaluateInput(), {
      writer: createWriter(() => ({
        ok: false,
        error: { code: 'event-log-unavailable', message: 'down', retryable: true },
      })),
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.token).toBe('merge-intent-unwritable');
  });
});
