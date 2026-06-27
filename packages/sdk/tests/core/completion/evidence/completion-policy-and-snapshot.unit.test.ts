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

describe('core-05-s2 completion evaluator policy and snapshot behavior', () => {
  it('honors a recorded protected-policy approval bound to the exact snapshot and head', async () => {
    const protectedLocal = createEvent(
      'LocalGitEvidenceRecorded',
      6,
      createLocalGitPayload({ changedPaths: ['.github/workflows/check.yml'] }),
    );
    const protectedSnapshot = createEvent('ProtectedPolicySnapshotRecorded', 7, snapshotPayload);
    const approval = createEvent('ApprovalDecisionRecorded', 8, {
      schema: 'kit-vnext.approval-decision-recorded.v1',
      decision: { decision: 'grant' },
      sourceEventIds: [],
      protectedPolicyBinding: {
        runId,
        candidateHeadSha: 'head-01',
        protectedPolicySnapshotEventId: protectedSnapshot.eventId,
      },
    });

    const approvalResult = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:17:00.000Z',
        evaluatedThrough: cursor,
        leaseId: 'lease-01',
        policyRef: 'policy:merge',
        allowedChangePaths: ['packages/sdk/src/core/completion/evidence/**'],
      },
      { replay: createReplay(protectedLocal, protectedSnapshot, approval), projections, writer: createWriter() },
    );

    expect(approvalResult.ok && approvalResult.value.decision.state).toBe('completion-pending-evidence');
  });

  it('returns completion-verified after appending a supplied snapshot and uses fallback ids when append receipts omit them', async () => {
    const local = createEvent('LocalGitEvidenceRecorded', 6, createLocalGitPayload());
    const verify = createEvent('RunnerCommandCaptured', 8, createVerifyCommand());
    const post = createEvent('LocalGitEvidenceRecorded', 9, createLocalGitPayload());
    let appendCount = 0;

    const result = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:15:30.000Z',
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
        replay: createReplay(local),
        projections,
        writer: createWriter(() => {
          appendCount += 1;
          return {
            ok: true,
            value: {
              runId,
              firstSequence: 20 + appendCount,
              lastSequence: 20 + appendCount,
              writerEpoch: 1,
              durability: 'barrier',
              eventIds: [],
              payloadDigests: [],
              frameDigest: `sha256:frame-${appendCount}`,
              health: 'ok',
            },
          };
        }),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.token);
    }

    expect(result.value.decision.state).toBe('completion-verified');
    expect(result.value.decisionEventId).toBe('CompletionDecisionRecorded');
    expect(result.value.protectedPolicySnapshotEventId).toBe('ProtectedPolicySnapshotRecorded');
  });

  it('fails closed when the latest protected-policy snapshot identity mismatches run, policy, or base inputs', async () => {
    const cases = [
      { name: 'run', snapshot: { ...snapshotPayload, runId: 'run-other' } },
      { name: 'policy', snapshot: { ...snapshotPayload, policyRef: 'policy:other' } },
      { name: 'base', snapshot: { ...snapshotPayload, baseSha: 'base-02' } },
    ] as const;

    for (const testCase of cases) {
      const local = createEvent('LocalGitEvidenceRecorded', 6, createLocalGitPayload());
      const snapshot = createEvent('ProtectedPolicySnapshotRecorded', 7, testCase.snapshot);

      const result = await evaluateCompletion(
        {
          runId,
          evaluatedAt: '2026-06-27T09:18:00.000Z',
          evaluatedThrough: cursor,
          leaseId: 'lease-01',
          policyRef: 'policy:merge',
          allowedChangePaths: ['packages/sdk/src/core/completion/evidence/**'],
        },
        { replay: createReplay(local, snapshot), projections, writer: createWriter() },
      );

      expect(result.ok && result.value.decision.state, testCase.name).toBe('changed-file-policy-absent');
    }
  });
});
