import { describe, expect, it } from 'vitest';

import {
  buildLocalBranchName,
  isAbsolutePath,
  planLocalBranch,
  resolveLocalBaseRef,
  type AbsolutePath,
  type BaseRefUnresolved,
  type BranchConflict,
  type GitSha,
  type LocalBranchNameOptions,
  type LocalBranchPlan,
  type LocalBranchPlanResult,
  type LocalRef,
  type RepositoryIdentity,
  type ResolveLocalBaseRefResult,
} from '../../../../src/index.js';
import {
  workspaceRepositoryBoundaryReport,
  workspaceRepositoryForbiddenBoundaryTerms,
} from '../../../../src/foundation/workspace-repository/boundary/index.js';

type ExpectTrue<T extends true> = T;

type KeysExactly<T, Keys extends PropertyKey> = [Exclude<keyof T, Keys>, Exclude<Keys, keyof T>] extends [never, never]
  ? true
  : false;

type HasKey<T, Key extends PropertyKey> = Key extends keyof T ? true : false;

type RepositoryIdentityKeysExact = ExpectTrue<
  KeysExactly<RepositoryIdentity, 'repoId' | 'repoRoot' | 'gitDir' | 'defaultBaseRef'>
>;
type RepositoryIdentityHasNoRemoteUrl = ExpectTrue<
  HasKey<RepositoryIdentity, 'remoteUrl'> extends false ? true : false
>;
type RepositoryIdentityHasNoHostedRepoId = ExpectTrue<
  HasKey<RepositoryIdentity, 'hostedRepoId'> extends false ? true : false
>;
type RepositoryIdentityHasNoCredentialRef = ExpectTrue<
  HasKey<RepositoryIdentity, 'credentialRefId'> extends false ? true : false
>;
type RepositoryIdentityHasNoContainment = ExpectTrue<
  HasKey<RepositoryIdentity, 'containment'> extends false ? true : false
>;
type LocalBranchPlanKeysExact = ExpectTrue<KeysExactly<LocalBranchPlan, 'branchName' | 'targetSha'>>;
type LocalBranchPlanHasNoRemoteUrl = ExpectTrue<HasKey<LocalBranchPlan, 'remoteUrl'> extends false ? true : false>;
type BranchConflictKeysExact = ExpectTrue<
  KeysExactly<BranchConflict, 'token' | 'branchName' | 'existingSha' | 'targetSha'>
>;
type BaseRefUnresolvedKeysExact = ExpectTrue<KeysExactly<BaseRefUnresolved, 'token' | 'ref'>>;

type RootWorkspaceRepositoryExports = {
  readonly repository: RepositoryIdentity;
  readonly baseRefResult: ResolveLocalBaseRefResult;
  readonly branchPlan: LocalBranchPlan;
  readonly branchPlanResult: LocalBranchPlanResult;
  readonly branchConflict: BranchConflict;
  readonly baseRefUnresolved: BaseRefUnresolved;
};

describe('fnd-03-s1 repository identity and branch contracts', () => {
  it('exposes repository identity as local-only absolute-path metadata', () => {
    const compileOnlyAssertions: readonly [
      RepositoryIdentityKeysExact,
      RepositoryIdentityHasNoRemoteUrl,
      RepositoryIdentityHasNoHostedRepoId,
      RepositoryIdentityHasNoCredentialRef,
      RepositoryIdentityHasNoContainment,
      LocalBranchPlanKeysExact,
      LocalBranchPlanHasNoRemoteUrl,
      BranchConflictKeysExact,
      BaseRefUnresolvedKeysExact,
    ] = [true, true, true, true, true, true, true, true, true];

    const repository: RepositoryIdentity = {
      repoId: 'workflow-kit',
      repoRoot: '/Users/aryekogan/repos/workflow-kit' as AbsolutePath,
      gitDir: '/Users/aryekogan/repos/workflow-kit/.git' as AbsolutePath,
      defaultBaseRef: 'refs/heads/v-next' as LocalRef,
    };
    const baseRefResult = resolveLocalBaseRef({
      repository,
      resolveRefToSha: () => 'abc1234' as GitSha,
    });
    const branchPlanResult = planLocalBranch({
      repoId: repository.repoId,
      runId: 'run-0042',
      taskId: 'fnd-03-s1',
      targetSha: 'abc1234' as GitSha,
      options: {
        prefix: 'task',
        includeRunId: true,
        includeTaskId: true,
        maxLength: 80,
      },
    });
    if (!baseRefResult.ok || !branchPlanResult.ok) {
      throw new Error('expected local root export contracts to produce successful fixtures');
    }
    const rootExports: RootWorkspaceRepositoryExports = {
      repository,
      baseRefResult,
      branchPlan: branchPlanResult.value,
      branchPlanResult,
      branchConflict: {
        token: 'branch-conflict',
        branchName: branchPlanResult.value.branchName,
        existingSha: 'def5678' as GitSha,
        targetSha: branchPlanResult.value.targetSha,
      },
      baseRefUnresolved: {
        token: 'base-ref-unresolved',
        ref: repository.defaultBaseRef,
      },
    };

    expect(compileOnlyAssertions).toEqual([true, true, true, true, true, true, true, true, true]);
    expect(rootExports.branchPlan.branchName).toBe('task/workflow-kit/run-0042/fnd-03-s1');
    expect(workspaceRepositoryBoundaryReport.repositoryIdentity.fields).toEqual([
      'repoId',
      'repoRoot',
      'gitDir',
      'defaultBaseRef',
    ]);
    expect(repository).toEqual({
      repoId: 'workflow-kit',
      repoRoot: '/Users/aryekogan/repos/workflow-kit',
      gitDir: '/Users/aryekogan/repos/workflow-kit/.git',
      defaultBaseRef: 'refs/heads/v-next',
    });
    expect(isAbsolutePath(repository.repoRoot)).toBe(true);
    expect(isAbsolutePath(repository.gitDir)).toBe(true);
    expect(isAbsolutePath('relative/path')).toBe(false);
  });

  it('builds deterministic local branch names from repo, run, task, and collision rules', () => {
    const options: LocalBranchNameOptions = {
      prefix: 'task',
      includeRunId: true,
      includeTaskId: true,
      maxLength: 44,
    };

    expect(
      buildLocalBranchName({
        repoId: 'workflow-kit',
        runId: 'run-0042',
        taskId: 'fnd-03-s1',
        options,
      }),
    ).toEqual('task/workflow-kit/run-0042/fnd-03-s1');

    expect(
      buildLocalBranchName({
        repoId: 'workflow-kit',
        runId: 'run-0042',
        taskId: 'fnd-03-s1',
        options,
        collisionSuffix: 'c02',
      }),
    ).toEqual('task/workflow-kit/run-0042/fnd-03-s1-c02');

    expect(
      buildLocalBranchName({
        repoId: 'workflow-kit',
        runId: 'run-0042',
        taskId: 'story-with-extra-length',
        options: {
          prefix: 'task',
          includeRunId: false,
          includeTaskId: true,
          maxLength: 24,
        },
        collisionSuffix: 'x7',
      }),
    ).toEqual('task/workflow-kit/sto-x7');
  });

  it('fails closed when a local base ref does not resolve and never fetches', () => {
    const calls: string[] = [];
    const repository: RepositoryIdentity = {
      repoId: 'workflow-kit',
      repoRoot: '/workspace/repo' as AbsolutePath,
      gitDir: '/workspace/repo/.git' as AbsolutePath,
      defaultBaseRef: 'refs/heads/v-next' as LocalRef,
    };

    const result = resolveLocalBaseRef({
      repository,
      resolveRefToSha: (ref) => {
        calls.push(ref);
        return undefined;
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        token: 'base-ref-unresolved',
        ref: 'refs/heads/v-next',
      },
    });
    expect(calls).toEqual(['refs/heads/v-next']);
  });

  it('returns branch-conflict when a generated local branch already exists at another commit', () => {
    const result = planLocalBranch({
      repoId: 'workflow-kit',
      runId: 'run-0042',
      taskId: 'fnd-03-s1',
      targetSha: '1111111' as GitSha,
      options: {
        prefix: 'task',
        includeRunId: true,
        includeTaskId: true,
        maxLength: 80,
      },
      existingBranchSha: '2222222' as GitSha,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        token: 'branch-conflict',
        branchName: 'task/workflow-kit/run-0042/fnd-03-s1',
        existingSha: '2222222',
        targetSha: '1111111',
      },
    });
  });
});

describe('fnd-03-s1 workspace repository boundary report', () => {
  it('proves the public surface excludes remote, credential, process, ci, pr, check, review, and merge fields', () => {
    expect(workspaceRepositoryForbiddenBoundaryTerms).toEqual([
      'remote',
      'credential',
      'process',
      'ci',
      'pr',
      'check',
      'review',
      'merge',
      'containment',
    ]);
    expect(workspaceRepositoryBoundaryReport).toEqual({
      repositoryIdentity: {
        typeName: 'RepositoryIdentity',
        fields: ['repoId', 'repoRoot', 'gitDir', 'defaultBaseRef'],
      },
      branchModel: {
        typeName: 'LocalBranchPlan',
        fields: ['branchName', 'targetSha'],
      },
      failureTokens: ['base-ref-unresolved', 'branch-conflict'],
      forbiddenTerms: workspaceRepositoryForbiddenBoundaryTerms,
    });
  });
});
