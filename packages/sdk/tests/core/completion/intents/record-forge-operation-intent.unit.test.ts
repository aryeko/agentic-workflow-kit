import { describe, expect, it } from 'vitest';

import { recordForgeOperationIntent } from '../../../../src/core/completion/intents/index.js';

import { appendReceipt, createForgeInput, createWriter, headSha, policyRef, runId } from './shared.js';

describe('core-05-s4 forge operation intent recording', () => {
  it('forge-operation-intent-kind-and-head records each allowed operation with the exact head', async () => {
    const operations = ['push-branch', 'upsert-pr', 'publish-blocker-evidence', 'update-branch'] as const;
    const writer = createWriter();

    for (const operation of operations) {
      const result = await recordForgeOperationIntent(createForgeInput({ operation }), { writer });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(result.error.token);
      }

      expect(result.value.intent).toMatchObject({
        schema: 'kit-vnext.forge-operation-intent-recorded.v1',
        runId,
        operation,
        expectedHeadSha: headSha,
        policyRef,
      });
      expect(writer.appendCalls.at(-1)?.[0]).toMatchObject({
        domain: 'core-05',
        type: 'ForgeOperationIntentRecorded',
        durability: 'barrier',
      });
    }
  });

  it('rejects ambiguous or dirty exact-head evidence before append', async () => {
    const ambiguous = await recordForgeOperationIntent(
      createForgeInput({ expectedHeadSha: undefined, localHead: { headSha, clean: true } }),
      { writer: createWriter() },
    );
    expect(ambiguous.ok).toBe(false);
    expect(ambiguous.ok ? undefined : ambiguous.error.token).toBe('head-ambiguous');

    const mismatched = await recordForgeOperationIntent(
      createForgeInput({ localHead: { headSha: 'head-other-01', clean: true } }),
      { writer: createWriter() },
    );
    expect(mismatched.ok).toBe(false);
    expect(mismatched.ok ? undefined : mismatched.error.token).toBe('head-ambiguous');

    const dirtyWriter = createWriter();
    const dirty = await recordForgeOperationIntent(createForgeInput({ localHead: { headSha, clean: false } }), {
      writer: dirtyWriter,
    });
    expect(dirty.ok).toBe(false);
    expect(dirty.ok ? undefined : dirty.error.token).toBe('workspace-dirty');
    expect(dirtyWriter.appendCalls).toHaveLength(0);
  });

  it('intent-append-unwritable returns event-log-unwritable with no success payload', async () => {
    const writer = createWriter(() => ({
      ok: false,
      error: { code: 'event-log-unavailable', message: 'down', retryable: true },
    }));

    const result = await recordForgeOperationIntent(createForgeInput(), { writer });

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.token).toBe('event-log-unwritable');
  });

  it('falls back to the default event id when the append receipt omits event ids', async () => {
    const writer = createWriter(() => ({
      ok: true,
      value: {
        ...appendReceipt,
        eventIds: [],
      },
    }));

    const result = await recordForgeOperationIntent(createForgeInput({ localHead: { headSha, clean: true } }), {
      writer,
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.value.intentEventId : undefined).toBe('ForgeOperationIntentRecorded');
  });

  it('dedupes evidence refs by event id before recording the intent', async () => {
    const result = await recordForgeOperationIntent(
      createForgeInput({
        evidenceRefs: [
          { eventId: 'evt-local-git-01', sequence: 21, payloadDigest: 'sha256:dupe', type: 'LocalGitEvidenceRecorded' },
          { eventId: 'evt-extra-01', sequence: 25, payloadDigest: 'sha256:extra', type: 'RunnerCommandCaptured' },
        ],
      }),
      { writer: createWriter() },
    );

    expect(result.ok).toBe(true);
    expect(result.ok ? result.value.intent.evidenceRefs : undefined).toEqual([
      {
        eventId: 'evt-local-git-01',
        sequence: 21,
        payloadDigest: 'sha256:evt-local-git-01',
        type: 'LocalGitEvidenceRecorded',
      },
      {
        eventId: 'evt-extra-01',
        sequence: 25,
        payloadDigest: 'sha256:extra',
        type: 'RunnerCommandCaptured',
      },
    ]);
  });
});
