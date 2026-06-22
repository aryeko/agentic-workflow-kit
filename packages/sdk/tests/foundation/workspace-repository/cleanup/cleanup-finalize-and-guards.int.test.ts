import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { AbsolutePath, GitSha } from '../../../../src/index.js';

import {
  createHarness,
  createLocalGitEvidence,
  createTempRoot,
  expectCreateLeaseSuccess,
  expectRecordEvidenceSuccess,
} from './cleanup-test-helpers.js';

describe('fnd-03-s4 finalize and cleanup guards', () => {
  it('blocks finalize when the current head no longer matches the recorded evidence and blocks stale-fence finalize or cleanup without side effects', () => {
    const localGitEvidence = createLocalGitEvidence(join(createTempRoot(), 'worktree') as AbsolutePath);
    const harness = createHarness({
      branchHeadSha: localGitEvidence.headSha,
      currentHeadSha: 'fedcba9fedcba9fedcba9fedcba9fedcba9fedc' as GitSha,
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

    expect(
      harness.workspaceRepository.finalizeLease({
        leaseId: created.lease.leaseId,
        evidenceId: recorded.evidence.evidenceId,
        epoch: created.lease.epoch,
        fenceToken: created.lease.fenceToken,
      }),
    ).toEqual({
      ok: false,
      error: {
        token: 'local-git-evidence-unavailable',
        leaseId: created.lease.leaseId,
      },
    });
    expect(
      harness.workspaceRepository.finalizeLease({
        leaseId: created.lease.leaseId,
        evidenceId: recorded.evidence.evidenceId,
        epoch: created.lease.epoch,
        fenceToken: 'wrong-token',
      }),
    ).toEqual({
      ok: false,
      error: {
        token: 'stale-lease-fence',
        leaseId: created.lease.leaseId,
        epoch: created.lease.epoch,
      },
    });
    expect(
      harness.workspaceRepository.cleanupLease({
        leaseId: created.lease.leaseId,
        epoch: created.lease.epoch,
        fenceToken: 'wrong-token',
        deleteLocalBranch: true,
        expectedHeadSha: localGitEvidence.headSha,
      }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({
        token: 'stale-lease-fence',
        reason: 'stale-lease-fence',
      }),
    });
    expect(harness.removedPaths).toEqual([]);
    expect(harness.deletedBranches).toEqual([]);
    expect(harness.tombstoneWrites).toEqual([]);
  });

  it('refuses cleanup before finalizeLease and performs no path, registration, branch, or tombstone side effects', () => {
    const harness = createHarness({
      branchHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      currentHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
    });
    const created = expectCreateLeaseSuccess(
      harness.workspaceRepository.createLease({
        runId: 'cleanup-run',
        taskId: 'fnd-03-s4',
        repoId: harness.repository.repoId,
      }),
    );

    expectRecordEvidenceSuccess(
      harness.workspaceRepository.recordLocalGitEvidence({
        leaseId: created.lease.leaseId,
        epoch: created.lease.epoch,
        fenceToken: created.lease.fenceToken,
      }),
    );

    expect(
      harness.workspaceRepository.cleanupLease({
        leaseId: created.lease.leaseId,
        epoch: created.lease.epoch,
        fenceToken: created.lease.fenceToken,
        deleteLocalBranch: true,
        expectedHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({
        token: 'cleanup-blocked',
        reason: 'cleanup-not-finalized',
      }),
    });
    expect(harness.removedPaths).toEqual([]);
    expect(harness.registrationPresent()).toBe(true);
    expect(harness.deletedBranches).toEqual([]);
    expect(harness.tombstoneWrites).toEqual([]);
  });
});
