import { describe, expect, it } from 'vitest';

import { evaluateCompletion } from '../../../../src/core/completion/evidence/index.js';

import {
  createEvent,
  createLocalGitPayload,
  createReplay,
  createVerifyCommand,
  createWriter,
  cursor,
  projections,
  runId,
  toRef,
} from './shared.js';

const snapshotPayload = {
  schema: 'kit-vnext.protected-policy-snapshot-recorded.v1' as const,
  runId,
  policyRef: 'policy:merge',
  policyDigest: 'sha256:policy',
  baseSha: 'base-01',
  verifierCommandDigest: 'sha256:verify-command',
  protectedPathSets: [{ label: 'ci', digest: 'sha256:ci', paths: ['.github/workflows/**'] }],
  recordedAt: '2026-06-27T09:09:00.000Z',
};

describe('core-05-s2 completion evaluator append and fail-closed states', () => {
  it('records completion decisions and maps decision append failures', async () => {
    const local = createEvent('LocalGitEvidenceRecorded', 6, createLocalGitPayload());
    const snapshot = createEvent('ProtectedPolicySnapshotRecorded', 7, snapshotPayload);
    const verify = createEvent('RunnerCommandCaptured', 8, createVerifyCommand());
    const post = createEvent('LocalGitEvidenceRecorded', 9, createLocalGitPayload());
    const replay = createReplay(local, snapshot, verify, post);
    const writer = createWriter();

    const success = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:13:00.000Z',
        evaluatedThrough: cursor,
        leaseId: 'lease-01',
        policyRef: 'policy:merge',
        allowedChangePaths: ['packages/sdk/src/core/completion/evidence/**'],
        verification: {
          commandRef: toRef(verify),
          command: verify.payload,
          preLocalGitRef: toRef(local),
          preLocalGit: local.payload,
          postLocalGitRef: toRef(post),
          postLocalGit: post.payload,
        },
      },
      { replay, projections, writer },
    );

    expect(success.ok).toBe(true);
    if (!success.ok) {
      throw new Error(success.error.token);
    }

    expect(writer.appendCalls.at(-1)?.[0]).toMatchObject({
      type: 'CompletionDecisionRecorded',
      durability: 'barrier',
      payload: {
        runId,
        state: 'completion-verified',
        headSha: 'head-01',
        cursor,
        evaluatedAt: '2026-06-27T09:13:00.000Z',
      },
    });

    const unwritable = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:13:00.000Z',
        evaluatedThrough: cursor,
        leaseId: 'lease-01',
        policyRef: 'policy:merge',
        allowedChangePaths: ['packages/sdk/src/core/completion/evidence/**'],
        verification: {
          commandRef: toRef(verify),
          command: verify.payload,
          preLocalGitRef: toRef(local),
          preLocalGit: local.payload,
          postLocalGitRef: toRef(post),
          postLocalGit: post.payload,
        },
      },
      {
        replay,
        projections,
        writer: createWriter(() => ({
          ok: false,
          error: { code: 'event-log-unavailable', message: 'down', retryable: true },
        })),
      },
    );

    expect(unwritable.ok).toBe(false);
    expect(unwritable.ok ? undefined : unwritable.error.token).toBe('event-log-unwritable');
  });

  it('returns verification-failed and verification-uncertain without converting them to claim mismatch', async () => {
    const local = createEvent('LocalGitEvidenceRecorded', 6, createLocalGitPayload());
    const snapshot = createEvent('ProtectedPolicySnapshotRecorded', 7, snapshotPayload);
    const failedVerify = createEvent('RunnerCommandCaptured', 8, createVerifyCommand({ exitCode: 1 }));
    const uncertainVerify = createEvent(
      'RunnerCommandCaptured',
      8,
      createVerifyCommand({ commandDigest: 'sha256:other' }),
    );
    const post = createEvent('LocalGitEvidenceRecorded', 9, createLocalGitPayload());

    const failed = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:14:00.000Z',
        evaluatedThrough: cursor,
        leaseId: 'lease-01',
        policyRef: 'policy:merge',
        allowedChangePaths: ['packages/sdk/src/core/completion/evidence/**'],
        verification: {
          commandRef: toRef(failedVerify),
          command: failedVerify.payload,
          preLocalGitRef: toRef(local),
          preLocalGit: local.payload,
          postLocalGitRef: toRef(post),
          postLocalGit: post.payload,
        },
      },
      { replay: createReplay(local, snapshot, failedVerify, post), projections, writer: createWriter() },
    );
    expect(failed.ok && failed.value.decision.state).toBe('verification-failed');

    const uncertain = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:14:00.000Z',
        evaluatedThrough: cursor,
        leaseId: 'lease-01',
        policyRef: 'policy:merge',
        allowedChangePaths: ['packages/sdk/src/core/completion/evidence/**'],
        verification: {
          commandRef: toRef(uncertainVerify),
          command: uncertainVerify.payload,
          preLocalGitRef: toRef(local),
          preLocalGit: local.payload,
          postLocalGitRef: toRef(post),
          postLocalGit: post.payload,
        },
      },
      { replay: createReplay(local, snapshot, uncertainVerify, post), projections, writer: createWriter() },
    );
    expect(uncertain.ok && uncertain.value.decision.state).toBe('verification-uncertain');
  });

  it('handles snapshot append failure and candidate fail-closed states', async () => {
    const snapshotFailure = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:15:00.000Z',
        evaluatedThrough: cursor,
        leaseId: 'lease-01',
        policyRef: 'policy:merge',
        allowedChangePaths: ['packages/sdk/src/core/completion/evidence/**'],
        protectedPolicySnapshot: {
          runId,
          policyRef: 'policy:merge',
          policyDigest: 'sha256:policy',
          baseSha: 'base-01',
          verifierCommandDigest: 'sha256:verify-command',
          protectedPathSets: [{ label: 'ci', digest: 'sha256:ci', paths: ['.github/workflows/**'] }],
          recordedAt: '2026-06-27T09:09:00.000Z',
        },
      },
      {
        replay: createReplay(createEvent('LocalGitEvidenceRecorded', 6, createLocalGitPayload())),
        projections,
        writer: createWriter(() => ({
          ok: false,
          error: { code: 'event-log-unavailable', message: 'down', retryable: true },
        })),
      },
    );
    expect(snapshotFailure.ok).toBe(false);

    const ambiguous = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:16:00.000Z',
        evaluatedThrough: cursor,
        leaseId: 'lease-01',
        policyRef: 'policy:merge',
      },
      { replay: createReplay(), projections, writer: createWriter() },
    );
    expect(ambiguous.ok && ambiguous.value.decision.state).toBe('head-ambiguous');
    expect(ambiguous.ok && ambiguous.value.decision.headSha).toBeUndefined();

    const dirty = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:16:00.000Z',
        evaluatedThrough: cursor,
        leaseId: 'lease-01',
        policyRef: 'policy:merge',
      },
      {
        replay: createReplay(createEvent('LocalGitEvidenceRecorded', 6, createLocalGitPayload({ clean: false }))),
        projections,
        writer: createWriter(),
      },
    );
    expect(dirty.ok && dirty.value.decision.state).toBe('workspace-dirty');
  });
});
