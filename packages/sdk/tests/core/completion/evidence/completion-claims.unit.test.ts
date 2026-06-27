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

describe('core-05-s2 completion evaluator claim and readiness outcomes', () => {
  it('claim-done-no-verify and claim-done-negative-verify emit claim-evidence-mismatch', async () => {
    const local = createEvent('LocalGitEvidenceRecorded', 6, createLocalGitPayload());
    const snapshot = createEvent('ProtectedPolicySnapshotRecorded', 7, snapshotPayload);
    const replay = createReplay(local, snapshot);

    const noVerify = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:11:00.000Z',
        evaluatedThrough: cursor,
        leaseId: 'lease-01',
        policyRef: 'policy:merge',
        allowedChangePaths: ['packages/sdk/src/core/completion/evidence/**'],
        workerClaim: { ref: toRef(createEvent('WorkerClaimRecorded', 9, {})), claim: { assertsDone: true } },
      },
      { replay, projections, writer: createWriter() },
    );

    expect(noVerify.ok && noVerify.value.decision.state).toBe('claim-evidence-mismatch');

    const verifyCommand = createEvent('RunnerCommandCaptured', 8, createVerifyCommand({ exitCode: 1 }));
    const negativeVerify = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:11:00.000Z',
        evaluatedThrough: cursor,
        leaseId: 'lease-01',
        policyRef: 'policy:merge',
        allowedChangePaths: ['packages/sdk/src/core/completion/evidence/**'],
        workerClaim: { ref: toRef(createEvent('WorkerClaimRecorded', 9, {})), claim: { assertsDone: true } },
        verification: {
          commandRef: toRef(verifyCommand),
          command: verifyCommand.payload,
          preLocalGitRef: toRef(local),
          preLocalGit: local.payload,
          postLocalGitRef: toRef(createEvent('LocalGitEvidenceRecorded', 10, createLocalGitPayload())),
          postLocalGit: createLocalGitPayload(),
        },
      },
      { replay, projections, writer: createWriter() },
    );

    expect(negativeVerify.ok && negativeVerify.value.decision.state).toBe('claim-evidence-mismatch');
  });

  it('maps pending evidence, forge evidence unavailable, and completion verified correctly', async () => {
    const local = createEvent('LocalGitEvidenceRecorded', 6, createLocalGitPayload());
    const snapshot = createEvent('ProtectedPolicySnapshotRecorded', 7, snapshotPayload);
    const verify = createEvent('RunnerCommandCaptured', 8, createVerifyCommand());
    const post = createEvent('LocalGitEvidenceRecorded', 9, createLocalGitPayload());
    const replay = createReplay(local, snapshot, verify, post);

    const pending = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:12:00.000Z',
        evaluatedThrough: cursor,
        leaseId: 'lease-01',
        policyRef: 'policy:merge',
        allowedChangePaths: ['packages/sdk/src/core/completion/evidence/**'],
      },
      { replay: createReplay(local, snapshot), projections, writer: createWriter() },
    );
    expect(pending.ok && pending.value.decision.state).toBe('completion-pending-evidence');

    const forgeUnavailable = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:12:00.000Z',
        evaluatedThrough: cursor,
        leaseId: 'lease-01',
        policyRef: 'policy:merge',
        allowedChangePaths: ['packages/sdk/src/core/completion/evidence/**'],
        workerClaim: {
          ref: toRef(createEvent('WorkerClaimRecorded', 10, {})),
          claim: { assertsDone: true, assertsMergeReady: true, headSha: 'head-01' },
        },
        verification: {
          commandRef: toRef(verify),
          command: verify.payload,
          preLocalGitRef: toRef(local),
          preLocalGit: local.payload,
          postLocalGitRef: toRef(post),
          postLocalGit: post.payload,
        },
        forgeEvidenceAvailable: false,
      },
      { replay, projections, writer: createWriter() },
    );
    expect(forgeUnavailable.ok && forgeUnavailable.value.decision.state).toBe('forge-evidence-unavailable');

    const completionVerified = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:12:00.000Z',
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
      { replay, projections, writer: createWriter() },
    );
    expect(completionVerified.ok && completionVerified.value.decision.state).toBe('completion-verified');
  });

  it('fails closed when verification refs are not replayed through the evaluation cursor', async () => {
    const local = createEvent('LocalGitEvidenceRecorded', 6, createLocalGitPayload());
    const snapshot = createEvent('ProtectedPolicySnapshotRecorded', 7, snapshotPayload);
    const verify = createEvent('RunnerCommandCaptured', 8, createVerifyCommand());
    const replay = createReplay(local, snapshot, verify);

    const missingPostRef = await evaluateCompletion(
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
          postLocalGitRef: toRef(createEvent('LocalGitEvidenceRecorded', 9, createLocalGitPayload())),
          postLocalGit: createLocalGitPayload(),
        },
      },
      { replay, projections, writer: createWriter() },
    );

    expect(missingPostRef.ok && missingPostRef.value.decision.state).toBe('verification-uncertain');

    const futurePost = createEvent('LocalGitEvidenceRecorded', 21, createLocalGitPayload());
    const futureRef = await evaluateCompletion(
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
          postLocalGitRef: toRef(futurePost),
          postLocalGit: futurePost.payload,
        },
      },
      { replay: createReplay(local, snapshot, verify, futurePost), projections, writer: createWriter() },
    );

    expect(futureRef.ok && futureRef.value.decision.state).toBe('verification-uncertain');
  });
});
