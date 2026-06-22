import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { AbsolutePath, GitSha } from '../../../../src/index.js';

import {
  createHarness,
  createLocalGitEvidence,
  createTempRoot,
  expectCreateLeaseSuccess,
  expectFinalizeSuccess,
  expectRecordEvidenceSuccess,
} from './cleanup-test-helpers.js';

describe('fnd-03-s4 blocked cleanup paths', () => {
  it('blocks cleanup for path conflicts, registration that remains present, and dirty worktrees', () => {
    const pathConflictHarness = createHarness({
      branchHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      currentHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      pathOwnedByLease: false,
    });
    const pathConflictCreated = expectCreateLeaseSuccess(
      pathConflictHarness.workspaceRepository.createLease({
        runId: 'cleanup-run',
        taskId: 'fnd-03-s4',
        repoId: pathConflictHarness.repository.repoId,
      }),
    );
    const pathConflictRecorded = expectRecordEvidenceSuccess(
      pathConflictHarness.workspaceRepository.recordLocalGitEvidence({
        leaseId: pathConflictCreated.lease.leaseId,
        epoch: pathConflictCreated.lease.epoch,
        fenceToken: pathConflictCreated.lease.fenceToken,
      }),
    );
    expectFinalizeSuccess(
      pathConflictHarness.workspaceRepository.finalizeLease({
        leaseId: pathConflictCreated.lease.leaseId,
        evidenceId: pathConflictRecorded.evidence.evidenceId,
        epoch: pathConflictCreated.lease.epoch,
        fenceToken: pathConflictCreated.lease.fenceToken,
      }),
    );

    expect(
      pathConflictHarness.workspaceRepository.cleanupLease({
        leaseId: pathConflictCreated.lease.leaseId,
        epoch: pathConflictCreated.lease.epoch,
        fenceToken: pathConflictCreated.lease.fenceToken,
        deleteLocalBranch: false,
      }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({
        token: 'worktree-path-conflict',
        reason: 'worktree-path-conflict',
      }),
    });

    const registrationHarness = createHarness({
      branchHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      currentHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      pruneRegistrationFails: true,
    });
    const registrationCreated = expectCreateLeaseSuccess(
      registrationHarness.workspaceRepository.createLease({
        runId: 'cleanup-run',
        taskId: 'fnd-03-s4',
        repoId: registrationHarness.repository.repoId,
      }),
    );
    const registrationRecorded = expectRecordEvidenceSuccess(
      registrationHarness.workspaceRepository.recordLocalGitEvidence({
        leaseId: registrationCreated.lease.leaseId,
        epoch: registrationCreated.lease.epoch,
        fenceToken: registrationCreated.lease.fenceToken,
      }),
    );
    expectFinalizeSuccess(
      registrationHarness.workspaceRepository.finalizeLease({
        leaseId: registrationCreated.lease.leaseId,
        evidenceId: registrationRecorded.evidence.evidenceId,
        epoch: registrationCreated.lease.epoch,
        fenceToken: registrationCreated.lease.fenceToken,
      }),
    );

    expect(
      registrationHarness.workspaceRepository.cleanupLease({
        leaseId: registrationCreated.lease.leaseId,
        epoch: registrationCreated.lease.epoch,
        fenceToken: registrationCreated.lease.fenceToken,
        deleteLocalBranch: false,
      }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({
        token: 'cleanup-blocked',
        reason: 'worktree-registration-present',
      }),
    });
    expect(registrationHarness.tombstoneWrites).toEqual([]);

    const dirtyHarness = createHarness({
      branchHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      currentHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      localGitEvidence: createLocalGitEvidence(
        join(createTempRoot(), 'worktrees', 'workflow-kit', 'cleanup-run') as AbsolutePath,
        true,
      ),
    });
    const dirtyCreated = expectCreateLeaseSuccess(
      dirtyHarness.workspaceRepository.createLease({
        runId: 'cleanup-run',
        taskId: 'fnd-03-s4',
        repoId: dirtyHarness.repository.repoId,
      }),
    );
    const dirtyRecorded = expectRecordEvidenceSuccess(
      dirtyHarness.workspaceRepository.recordLocalGitEvidence({
        leaseId: dirtyCreated.lease.leaseId,
        epoch: dirtyCreated.lease.epoch,
        fenceToken: dirtyCreated.lease.fenceToken,
      }),
    );
    expectFinalizeSuccess(
      dirtyHarness.workspaceRepository.finalizeLease({
        leaseId: dirtyCreated.lease.leaseId,
        evidenceId: dirtyRecorded.evidence.evidenceId,
        epoch: dirtyCreated.lease.epoch,
        fenceToken: dirtyCreated.lease.fenceToken,
      }),
    );

    expect(
      dirtyHarness.workspaceRepository.cleanupLease({
        leaseId: dirtyCreated.lease.leaseId,
        epoch: dirtyCreated.lease.epoch,
        fenceToken: dirtyCreated.lease.fenceToken,
        deleteLocalBranch: false,
      }),
    ).toMatchObject({
      ok: false,
      error: expect.objectContaining({
        token: 'dirty-worktree',
        reason: 'dirty-worktree',
      }),
    });
  });

  it('blocks branch deletion on head mismatch, checked-out branches, and cleanup I/O failures', () => {
    const headMismatchHarness = createHarness({
      branchHeadSha: '1111111111111111111111111111111111111111' as GitSha,
      currentHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
    });
    const headMismatchCreated = expectCreateLeaseSuccess(
      headMismatchHarness.workspaceRepository.createLease({
        runId: 'cleanup-run',
        taskId: 'fnd-03-s4',
        repoId: headMismatchHarness.repository.repoId,
      }),
    );
    const headMismatchRecorded = expectRecordEvidenceSuccess(
      headMismatchHarness.workspaceRepository.recordLocalGitEvidence({
        leaseId: headMismatchCreated.lease.leaseId,
        epoch: headMismatchCreated.lease.epoch,
        fenceToken: headMismatchCreated.lease.fenceToken,
      }),
    );
    expectFinalizeSuccess(
      headMismatchHarness.workspaceRepository.finalizeLease({
        leaseId: headMismatchCreated.lease.leaseId,
        evidenceId: headMismatchRecorded.evidence.evidenceId,
        epoch: headMismatchCreated.lease.epoch,
        fenceToken: headMismatchCreated.lease.fenceToken,
      }),
    );

    expect(
      headMismatchHarness.workspaceRepository.cleanupLease({
        leaseId: headMismatchCreated.lease.leaseId,
        epoch: headMismatchCreated.lease.epoch,
        fenceToken: headMismatchCreated.lease.fenceToken,
        deleteLocalBranch: true,
        expectedHeadSha: headMismatchRecorded.evidence.headSha,
      }),
    ).toMatchObject({
      ok: false,
      error: expect.objectContaining({
        token: 'cleanup-blocked',
        reason: 'branch-head-mismatch',
      }),
    });

    const checkedOutHarness = createHarness({
      branchHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      currentHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      checkedOutWorktreePaths: ['/tmp/other-worktree' as AbsolutePath],
    });
    const checkedOutCreated = expectCreateLeaseSuccess(
      checkedOutHarness.workspaceRepository.createLease({
        runId: 'cleanup-run',
        taskId: 'fnd-03-s4',
        repoId: checkedOutHarness.repository.repoId,
      }),
    );
    const checkedOutRecorded = expectRecordEvidenceSuccess(
      checkedOutHarness.workspaceRepository.recordLocalGitEvidence({
        leaseId: checkedOutCreated.lease.leaseId,
        epoch: checkedOutCreated.lease.epoch,
        fenceToken: checkedOutCreated.lease.fenceToken,
      }),
    );
    expectFinalizeSuccess(
      checkedOutHarness.workspaceRepository.finalizeLease({
        leaseId: checkedOutCreated.lease.leaseId,
        evidenceId: checkedOutRecorded.evidence.evidenceId,
        epoch: checkedOutCreated.lease.epoch,
        fenceToken: checkedOutCreated.lease.fenceToken,
      }),
    );

    expect(
      checkedOutHarness.workspaceRepository.cleanupLease({
        leaseId: checkedOutCreated.lease.leaseId,
        epoch: checkedOutCreated.lease.epoch,
        fenceToken: checkedOutCreated.lease.fenceToken,
        deleteLocalBranch: true,
        expectedHeadSha: checkedOutRecorded.evidence.headSha,
      }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({
        token: 'cleanup-blocked',
        reason: 'branch-checked-out',
      }),
    });

    const ioFailureHarness = createHarness({
      branchHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      currentHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      writeTombstoneFails: true,
    });
    const ioFailureCreated = expectCreateLeaseSuccess(
      ioFailureHarness.workspaceRepository.createLease({
        runId: 'cleanup-run',
        taskId: 'fnd-03-s4',
        repoId: ioFailureHarness.repository.repoId,
      }),
    );
    const ioFailureRecorded = expectRecordEvidenceSuccess(
      ioFailureHarness.workspaceRepository.recordLocalGitEvidence({
        leaseId: ioFailureCreated.lease.leaseId,
        epoch: ioFailureCreated.lease.epoch,
        fenceToken: ioFailureCreated.lease.fenceToken,
      }),
    );
    expectFinalizeSuccess(
      ioFailureHarness.workspaceRepository.finalizeLease({
        leaseId: ioFailureCreated.lease.leaseId,
        evidenceId: ioFailureRecorded.evidence.evidenceId,
        epoch: ioFailureCreated.lease.epoch,
        fenceToken: ioFailureCreated.lease.fenceToken,
      }),
    );

    expect(
      ioFailureHarness.workspaceRepository.cleanupLease({
        leaseId: ioFailureCreated.lease.leaseId,
        epoch: ioFailureCreated.lease.epoch,
        fenceToken: ioFailureCreated.lease.fenceToken,
        deleteLocalBranch: false,
      }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({
        token: 'cleanup-blocked',
        reason: 'cleanup-io-failed',
      }),
    });
  });

  it('records cleanup-io-failed when removing the worktree path fails before prune/tombstone', () => {
    const removeFailureHarness = createHarness({
      branchHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      currentHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      removePathFails: true,
    });
    const created = expectCreateLeaseSuccess(
      removeFailureHarness.workspaceRepository.createLease({
        runId: 'cleanup-run',
        taskId: 'fnd-03-s4',
        repoId: removeFailureHarness.repository.repoId,
      }),
    );
    const recorded = expectRecordEvidenceSuccess(
      removeFailureHarness.workspaceRepository.recordLocalGitEvidence({
        leaseId: created.lease.leaseId,
        epoch: created.lease.epoch,
        fenceToken: created.lease.fenceToken,
      }),
    );
    expectFinalizeSuccess(
      removeFailureHarness.workspaceRepository.finalizeLease({
        leaseId: created.lease.leaseId,
        evidenceId: recorded.evidence.evidenceId,
        epoch: created.lease.epoch,
        fenceToken: created.lease.fenceToken,
      }),
    );

    expect(
      removeFailureHarness.workspaceRepository.cleanupLease({
        leaseId: created.lease.leaseId,
        epoch: created.lease.epoch,
        fenceToken: created.lease.fenceToken,
        deleteLocalBranch: false,
      }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({
        token: 'cleanup-blocked',
        reason: 'cleanup-io-failed',
      }),
    });
    expect(removeFailureHarness.registrationPresent()).toBe(true);
    expect(removeFailureHarness.tombstoneWrites).toEqual([]);
  });

  it('records cleanup-io-failed when local branch deletion throws after path removal and prune', () => {
    const deleteFailureHarness = createHarness({
      branchHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      currentHeadSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      deleteBranchFails: true,
    });
    const created = expectCreateLeaseSuccess(
      deleteFailureHarness.workspaceRepository.createLease({
        runId: 'cleanup-run',
        taskId: 'fnd-03-s4',
        repoId: deleteFailureHarness.repository.repoId,
      }),
    );
    const recorded = expectRecordEvidenceSuccess(
      deleteFailureHarness.workspaceRepository.recordLocalGitEvidence({
        leaseId: created.lease.leaseId,
        epoch: created.lease.epoch,
        fenceToken: created.lease.fenceToken,
      }),
    );
    expectFinalizeSuccess(
      deleteFailureHarness.workspaceRepository.finalizeLease({
        leaseId: created.lease.leaseId,
        evidenceId: recorded.evidence.evidenceId,
        epoch: created.lease.epoch,
        fenceToken: created.lease.fenceToken,
      }),
    );

    expect(
      deleteFailureHarness.workspaceRepository.cleanupLease({
        leaseId: created.lease.leaseId,
        epoch: created.lease.epoch,
        fenceToken: created.lease.fenceToken,
        deleteLocalBranch: true,
        expectedHeadSha: recorded.evidence.headSha,
      }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({
        token: 'cleanup-blocked',
        reason: 'cleanup-io-failed',
      }),
    });
    expect(deleteFailureHarness.registrationPresent()).toBe(false);
    expect(deleteFailureHarness.tombstoneWrites).toEqual([]);
  });
});
