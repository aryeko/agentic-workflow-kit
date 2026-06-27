import { describe, expect, it } from 'vitest';

import {
  BLOCKER_EVIDENCE_ELIGIBLE_COMPLETION_STATES,
  BLOCKER_EVIDENCE_ELIGIBLE_MERGE_STATES,
} from '../../../../src/core/completion/contracts/index.js';
import { recordBlockerEvidenceIntent } from '../../../../src/core/completion/intents/index.js';

import {
  createBlockerCompletionInput,
  createBlockerMergeInput,
  createWriter,
  headSha,
  policyRef,
  runId,
} from './shared.js';

describe('core-05-s4 blocker evidence intent recording', () => {
  it('blocker-intent-eligible-state-matrix accepts each eligible completion and merge state', async () => {
    for (const state of BLOCKER_EVIDENCE_ELIGIBLE_COMPLETION_STATES) {
      const result = await recordBlockerEvidenceIntent(createBlockerCompletionInput(state), {
        writer: createWriter(),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(result.error.token);
      }

      expect(result.value.intent).toMatchObject({
        schema: 'kit-vnext.forge-operation-intent-recorded.v1',
        runId,
        operation: 'publish-blocker-evidence',
        expectedHeadSha: headSha,
        policyRef,
        purpose: 'blocker-evidence-pr',
        blockerState: state,
      });
    }

    for (const state of BLOCKER_EVIDENCE_ELIGIBLE_MERGE_STATES) {
      const result = await recordBlockerEvidenceIntent(createBlockerMergeInput(state), {
        writer: createWriter(),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(result.error.token);
      }

      expect(result.value.intent).toMatchObject({
        schema: 'kit-vnext.forge-operation-intent-recorded.v1',
        runId,
        operation: 'publish-blocker-evidence',
        expectedHeadSha: headSha,
        policyRef,
        purpose: 'blocker-evidence-pr',
        blockerState: state,
      });
    }
  });

  it('blocker-intent-forbidden-state-matrix rejects forbidden states and unsafe local evidence', async () => {
    const cases = [
      ['event-log-unwritable', createBlockerCompletionInput('event-log-unwritable')],
      ['head-ambiguous', createBlockerCompletionInput('head-ambiguous')],
      ['workspace-dirty', createBlockerCompletionInput('workspace-dirty')],
      ['changed-files-outside-allowlist', createBlockerCompletionInput('changed-files-outside-allowlist')],
      ['changed-file-policy-absent', createBlockerCompletionInput('changed-file-policy-absent')],
      ['forge-evidence-unavailable', createBlockerCompletionInput('forge-evidence-unavailable')],
      ['completion-verified', createBlockerCompletionInput('completion-verified')],
      ['merge-ready', createBlockerMergeInput('merge-ready')],
      ['merge-intent-unwritable', createBlockerMergeInput('merge-intent-unwritable')],
      ['merge-head-ambiguous', createBlockerMergeInput('merge-head-ambiguous')],
      ['merge-forge-unavailable', createBlockerMergeInput('merge-forge-unavailable')],
      ['head-ambiguous', createBlockerCompletionInput('completion-pending-evidence', { localHead: { clean: true } })],
      ['merge-head-ambiguous', createBlockerMergeInput('merge-policy-disabled', { localHead: { clean: true } })],
      ['workspace-dirty', createBlockerMergeInput('merge-policy-disabled', { localHead: { headSha, clean: false } })],
      [
        'merge-policy-disabled',
        createBlockerCompletionInput('verification-failed', { runnerMayPush: false, runnerMayOpenPr: true }),
      ],
    ] as const;

    for (const [expected, input] of cases) {
      const writer = createWriter();
      const result = await recordBlockerEvidenceIntent(input, { writer });

      expect(result.ok).toBe(false);
      expect(result.ok ? undefined : result.error.token).toBe(expected);
      expect(writer.appendCalls).toHaveLength(0);
    }
  });

  it('intent-append-unwritable returns event-log-unwritable with no success event', async () => {
    const writer = createWriter(() => ({
      ok: false,
      error: { code: 'event-log-unavailable', message: 'down', retryable: true },
    }));

    const result = await recordBlockerEvidenceIntent(createBlockerCompletionInput('verification-failed'), { writer });

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.token).toBe('event-log-unwritable');
  });

  it('records blocker intents when local exact-head evidence omits explicit evidence refs', async () => {
    const completion = await recordBlockerEvidenceIntent(
      createBlockerCompletionInput('verification-failed', { localHead: { headSha, clean: true } }),
      { writer: createWriter() },
    );
    expect(completion.ok).toBe(true);

    const merge = await recordBlockerEvidenceIntent(
      createBlockerMergeInput('merge-policy-disabled', { localHead: { headSha, clean: true } }),
      { writer: createWriter() },
    );
    expect(merge.ok).toBe(true);
  });
});
