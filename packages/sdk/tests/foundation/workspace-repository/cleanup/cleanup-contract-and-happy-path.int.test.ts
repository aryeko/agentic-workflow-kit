import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { AbsolutePath, GitSha, WorkspaceRepositoryAppendIntent } from '../../../../src/index.js';

import {
  type CleanupObservedStateKeysExact,
  type CleanupRequestKeysExact,
  createHarness,
  createLocalGitEvidence,
  createTempRoot,
  expectCreateLeaseSuccess,
  expectFinalizeSuccess,
  expectRecordEvidenceSuccess,
  tokenRepresentsForbiddenConcept,
} from './cleanup-test-helpers.js';

describe('fnd-03-s4 cleanup settlement contracts and happy path', () => {
  it('exports the cleanup request and observed-state contracts, finalizes against current head evidence, and cleans with a durable tombstone', () => {
    const compileOnlyAssertions: readonly [CleanupRequestKeysExact, CleanupObservedStateKeysExact] = [true, true];
    const worktreePath = join(createTempRoot(), 'worktrees', 'workflow-kit', 'cleanup-run') as AbsolutePath;
    const localGitEvidence = createLocalGitEvidence(worktreePath);
    const harness = createHarness({
      branchHeadSha: localGitEvidence.headSha,
      currentHeadSha: localGitEvidence.headSha,
      localGitEvidence,
    });

    const created = expectCreateLeaseSuccess(
      harness.workspaceRepository.createLease({
        runId: 'cleanup-run',
        taskId: 'fnd-03-s4',
        repoId: harness.repository.repoId,
      }),
    );
    const recorded = expectRecordEvidenceSuccess(
      harness.workspaceRepository.recordLocalGitEvidence({
        leaseId: created.lease.leaseId,
        epoch: created.lease.epoch,
        fenceToken: created.lease.fenceToken,
      }),
    );
    const finalized = expectFinalizeSuccess(
      harness.workspaceRepository.finalizeLease({
        leaseId: created.lease.leaseId,
        evidenceId: recorded.evidence.evidenceId,
        epoch: created.lease.epoch,
        fenceToken: created.lease.fenceToken,
      }),
    );
    const cleaned = harness.workspaceRepository.cleanupLease({
      leaseId: created.lease.leaseId,
      epoch: created.lease.epoch,
      fenceToken: created.lease.fenceToken,
      deleteLocalBranch: true,
      expectedHeadSha: localGitEvidence.headSha,
    });

    expect(compileOnlyAssertions).toEqual([true, true]);
    expect(finalized.lease.state).toBe('finalized');
    expect(finalized.appendIntents).toMatchObject([
      {
        type: 'WorktreeLeaseFinalized',
        payload: {
          leaseId: created.lease.leaseId,
          headSha: localGitEvidence.headSha,
          evidenceId: localGitEvidence.evidenceId,
          state: 'finalized',
        },
      },
    ] satisfies readonly Partial<WorkspaceRepositoryAppendIntent>[]);
    expect(cleaned).toMatchObject({
      ok: true,
      value: {
        lease: {
          ...finalized.lease,
          state: 'cleaned',
        },
        branchDisposition: {
          kind: 'deleted',
          branchName: localGitEvidence.branchName,
          deletedAt: '2026-06-22T09:00:00.000Z',
        },
        cleanupTombstoneRef: 'artifact:sha256:cleanup-tombstone',
      },
    });
    expect(harness.removedPaths).toEqual([finalized.lease.worktreePath]);
    expect(harness.registrationPresent()).toBe(false);
    expect(harness.deletedBranches).toEqual([localGitEvidence.branchName]);
    expect(harness.tombstoneWrites).toEqual([
      {
        leaseId: created.lease.leaseId,
        branchDisposition: {
          kind: 'deleted',
          branchName: localGitEvidence.branchName,
          deletedAt: '2026-06-22T09:00:00.000Z',
        },
      },
    ]);
  });

  it('tombstones a missing worktree only after registration absence is confirmed and retains the branch when deletion is not requested', () => {
    const harness = createHarness({
      branchHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      currentHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      registrationPresent: false,
    });
    const created = expectCreateLeaseSuccess(
      harness.workspaceRepository.createLease({
        runId: 'cleanup-run',
        taskId: 'fnd-03-s4',
        repoId: harness.repository.repoId,
      }),
    );
    rmSync(created.lease.worktreePath, { recursive: true, force: true });
    const recorded = expectRecordEvidenceSuccess(
      harness.workspaceRepository.recordLocalGitEvidence({
        leaseId: created.lease.leaseId,
        epoch: created.lease.epoch,
        fenceToken: created.lease.fenceToken,
      }),
    );
    expectFinalizeSuccess(
      harness.workspaceRepository.finalizeLease({
        leaseId: created.lease.leaseId,
        evidenceId: recorded.evidence.evidenceId,
        epoch: created.lease.epoch,
        fenceToken: created.lease.fenceToken,
      }),
    );

    const cleaned = harness.workspaceRepository.cleanupLease({
      leaseId: created.lease.leaseId,
      epoch: created.lease.epoch,
      fenceToken: created.lease.fenceToken,
      deleteLocalBranch: false,
    });

    expect(cleaned).toEqual({
      ok: true,
      value: expect.objectContaining({
        branchDisposition: {
          kind: 'retained',
          branchName: recorded.evidence.branchName,
          reason: 'requested',
        },
      }),
    });
    expect(harness.removedPaths).toEqual([]);
    expect(harness.deletedBranches).toEqual([]);
    expect(harness.tombstoneWrites).toHaveLength(1);
  });

  it('keeps cleanup implementation free of remote, forge, process, ci, review, merge, and credential dependency terms', () => {
    const cleanupSource = readFileSync(
      fileURLToPath(new URL('../../../../src/foundation/workspace-repository/cleanup/index.ts', import.meta.url)),
      'utf8',
    );
    const exportedTokens = [
      ...cleanupSource.matchAll(/export\s+(?:type\s+)?([A-Za-z0-9_]+)/g),
      ...cleanupSource.matchAll(/readonly\s+([A-Za-z0-9_]+)\??:/g),
    ].map((match) => match[1]);

    for (const forbiddenTerm of ['remote', 'forge', 'process', 'credential', 'ci', 'review', 'merge']) {
      expect(exportedTokens.some((token) => tokenRepresentsForbiddenConcept(token, forbiddenTerm))).toBe(false);
    }
  });
});
