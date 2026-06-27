import { describe, expect, it } from 'vitest';

import { recordPostMergeOutcome } from '../../../../src/core/completion/post-merge/index.js';

import { createInput, createWriter, evaluatedAt, exactHeadEvidenceRefs, expectedHeadSha, runId } from './shared.js';

describe('core-05-s5 post-merge outcome recording', () => {
  it('post-merge-record-fields appends the recorded outcome payload with exact-head evidence refs', async () => {
    const writer = createWriter();
    const result = await recordPostMergeOutcome(createInput(), { writer });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.token);
    }

    expect(result.value.outcome).toEqual({
      schema: 'kit-vnext.post-merge-outcome-recorded.v1',
      runId,
      state: 'post-merge-confirmed',
      headSha: expectedHeadSha,
      sourceActionEventId: 'evt-source-action-01',
      evidenceRefs: exactHeadEvidenceRefs,
      lifecycleTarget: 'completed',
      recordedAt: evaluatedAt,
    });
    expect(result.value.outcomeEventId).toBe('evt-post-merge-01');
    expect(writer.appendCalls.at(-1)?.[0]).toMatchObject({
      domain: 'core-05',
      type: 'PostMergeOutcomeRecorded',
      durability: 'barrier',
    });
  });

  it('post-merge-record-unwritable returns no success fact when the append fails', async () => {
    const result = await recordPostMergeOutcome(createInput(), {
      writer: createWriter(() => ({
        ok: false,
        error: { code: 'event-log-unavailable', message: 'down', retryable: true },
      })),
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.token).toBe('event-log-unwritable');
  });
});
