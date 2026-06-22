import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  WORKTREE_LEASE_STATES,
  createLeaseStore,
  createSetupDependencies,
  createWorkspaceRepository,
  evaluateDeclaredSetup,
  type AbsolutePath,
  type ArtifactRef,
  type DeclaredSetup,
  type GitSha,
  type LocalRef,
  type RepositoryIdentity,
  type SetupEvaluation,
  type WorktreeLease,
  type WorktreeLeaseState,
  type WorkspaceRepositoryAppendIntent,
} from '../../../../src/index.js';

type ExpectTrue<T extends true> = T;

type KeysExactly<T, Keys extends PropertyKey> = [Exclude<keyof T, Keys>, Exclude<Keys, keyof T>] extends [never, never]
  ? true
  : false;

type WorktreeLeaseKeysExact = ExpectTrue<
  KeysExactly<
    WorktreeLease,
    | 'leaseId'
    | 'epoch'
    | 'runId'
    | 'repoId'
    | 'worktreePath'
    | 'baseRef'
    | 'baseSha'
    | 'branchName'
    | 'state'
    | 'fenceToken'
  >
>;
type SetupEvaluationKeysExact = ExpectTrue<KeysExactly<SetupEvaluation, 'leaseId' | 'setup' | 'fresh' | 'reason'>>;

const createdRoots: string[] = [];

const createClock = (initial: string) => {
  let nowMs = Date.parse(initial);

  return {
    now: (): Date => new globalThis.Date(nowMs),
    advanceMs: (deltaMs: number): void => {
      nowMs += deltaMs;
    },
  };
};

const createTempRoot = (): AbsolutePath => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-kit-worktree-setup-'));
  createdRoots.push(root);
  return root as AbsolutePath;
};

afterEach(() => {
  for (const root of createdRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

type HarnessOptions = {
  readonly setup: DeclaredSetup;
  readonly baseSha?: GitSha;
  readonly existingBranchSha?: GitSha;
  readonly artifactRefs?: ReadonlyMap<string, ArtifactRef>;
  readonly artifactLookupFails?: boolean;
  readonly readTextFileFails?: boolean;
  readonly createWorktreeFails?: boolean;
  readonly leaseHealth?: 'ok' | 'network-fs-degraded' | 'read-only' | 'unusable';
};

const createHarness = (options: HarnessOptions) => {
  const clock = createClock('2026-06-22T09:00:00.000Z');
  const root = createTempRoot();
  const repoRoot = join(root, 'repo');
  const worktreeRoot = join(root, 'worktrees');
  mkdirSync(join(repoRoot, '.git'), { recursive: true });
  mkdirSync(worktreeRoot, { recursive: true });

  const repository: RepositoryIdentity = {
    repoId: 'workflow-kit',
    repoRoot: repoRoot as AbsolutePath,
    gitDir: join(repoRoot, '.git') as AbsolutePath,
    defaultBaseRef: 'refs/heads/v-next' as LocalRef,
  };

  const branchCalls: Array<{
    readonly branchName: string;
    readonly targetSha: GitSha;
    readonly trackUpstream: false;
    readonly worktreePath: AbsolutePath;
  }> = [];
  const worktreeCalls: Array<{
    readonly worktreePath: AbsolutePath;
    readonly baseSha: GitSha;
  }> = [];
  const resolvedRefs: LocalRef[] = [];

  const leaseStore = createLeaseStore({
    health: options.leaseHealth,
    now: clock.now,
    createToken: (() => {
      let next = 0;
      return () => {
        next += 1;
        return `lease-token-${next}`;
      };
    })(),
    digestToken: (token) => `digest:${token}`,
  });

  const workspaceRepository = createWorkspaceRepository({
    repository,
    worktreeRoot: worktreeRoot as AbsolutePath,
    setup: options.setup,
    leaseStore,
    leaseHolder: 'worker:test',
    leaseTtlMs: 60_000,
    branchOptions: {
      prefix: 'task',
      includeRunId: true,
      includeTaskId: true,
      maxLength: 80,
    },
    now: () => clock.now().toISOString(),
    git: {
      resolveRefToSha: (ref) => {
        resolvedRefs.push(ref);
        return options.baseSha;
      },
      getExistingBranchSha: () => options.existingBranchSha,
      createWorktree: ({ worktreePath, baseSha }) => {
        if (options.createWorktreeFails) {
          throw new Error('worktree create failed');
        }

        worktreeCalls.push({ worktreePath, baseSha });
        mkdirSync(worktreePath, { recursive: false });
      },
      createLocalBranch: ({ branchName, targetSha, trackUpstream, worktreePath }) => {
        branchCalls.push({ branchName, targetSha, trackUpstream, worktreePath });
      },
    },
    setupDependencies: {
      readTextFile: (path) => {
        if (options.readTextFileFails) {
          return { ok: false } as const;
        }

        if (!existsSync(path)) {
          return { ok: true, value: undefined } as const;
        }

        return { ok: true, value: readFileSync(path, 'utf8') } as const;
      },
      resolveArtifactRef: (refName) => {
        if (options.artifactLookupFails) {
          return { ok: false } as const;
        }

        const artifactRef = options.artifactRefs?.get(refName);
        return artifactRef === undefined
          ? ({ ok: true, value: undefined } as const)
          : ({ ok: true, value: artifactRef } as const);
      },
    },
  });

  return {
    clock,
    leaseStore,
    repository,
    resolvedRefs,
    root,
    worktreeRoot: worktreeRoot as AbsolutePath,
    workspaceRepository,
    worktreeCalls,
    branchCalls,
  };
};

const writeText = (path: string, value: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, 'utf8');
};

const expectCreateLeaseSuccess = (
  value: ReturnType<ReturnType<typeof createWorkspaceRepository>['createLease']>,
): Extract<typeof value, { readonly ok: true }>['value'] => {
  if (!value.ok) {
    throw new Error(`expected createLease success, got ${value.error.token}`);
  }

  return value.value;
};

const expectConfirmSuccess = (
  value: ReturnType<ReturnType<typeof createWorkspaceRepository>['confirmSetup']>,
): Extract<typeof value, { readonly ok: true }>['value'] => {
  if (!value.ok) {
    throw new Error(`expected confirmSetup success, got ${value.error.token}`);
  }

  return value.value;
};

describe('fnd-03-s2 worktree setup', () => {
  it('creates an isolated lease from a local base sha, creates a local-only branch, and records the lease shape', () => {
    const compileOnlyAssertions: readonly [WorktreeLeaseKeysExact, SetupEvaluationKeysExact] = [true, true];
    const harness = createHarness({
      setup: {
        command: 'pnpm install --frozen-lockfile',
        workingDirectory: '.',
        freshness: {
          kind: 'marker-file',
          path: '.setup-ready',
          contentHash: 'sha256:ready',
        },
        rerunPolicy: 'on-fresh-worktree',
      },
      baseSha: 'abc1234' as GitSha,
    });

    const created = expectCreateLeaseSuccess(
      harness.workspaceRepository.createLease({
        runId: 'run-0042',
        taskId: 'fnd-03-s2',
        repoId: harness.repository.repoId,
      }),
    );

    expect(compileOnlyAssertions).toEqual([true, true]);
    expect(harness.resolvedRefs).toEqual(['refs/heads/v-next']);
    expect(harness.worktreeCalls).toEqual([
      {
        worktreePath: join(harness.worktreeRoot, 'workflow-kit', 'run-0042'),
        baseSha: 'abc1234',
      },
    ]);
    expect(harness.branchCalls).toEqual([
      {
        branchName: 'task/workflow-kit/run-0042/fnd-03-s2',
        targetSha: 'abc1234',
        trackUpstream: false,
        worktreePath: join(harness.worktreeRoot, 'workflow-kit', 'run-0042'),
      },
    ]);
    expect(created.lease).toEqual({
      leaseId: 'worktree:workflow-kit:run-0042',
      epoch: 1,
      runId: 'run-0042',
      repoId: 'workflow-kit',
      worktreePath: join(harness.worktreeRoot, 'workflow-kit', 'run-0042'),
      baseRef: 'refs/heads/v-next',
      baseSha: 'abc1234',
      branchName: 'task/workflow-kit/run-0042/fnd-03-s2',
      state: 'setup-required',
      fenceToken: 'lease-token-1',
    });
    expect(created.setupEvaluation).toEqual({
      leaseId: 'worktree:workflow-kit:run-0042',
      setup: {
        command: 'pnpm install --frozen-lockfile',
        workingDirectory: '.',
        freshness: {
          kind: 'marker-file',
          path: '.setup-ready',
          contentHash: 'sha256:ready',
        },
        rerunPolicy: 'on-fresh-worktree',
      },
      fresh: false,
      reason: 'new-worktree',
    });
    expect(created.appendIntents.map((intent) => intent.type)).toEqual([
      'WorktreeLeaseCreated',
      'LocalBranchCreated',
      'RepoSetupEvaluated',
    ]);
    expect(created.appendIntents).toMatchObject([
      {
        domain: 'fnd-03',
        payload: {
          leaseId: 'worktree:workflow-kit:run-0042',
          state: 'leased',
          baseSha: 'abc1234',
        },
      },
      {
        domain: 'fnd-03',
        payload: {
          leaseId: 'worktree:workflow-kit:run-0042',
          branchName: 'task/workflow-kit/run-0042/fnd-03-s2',
          state: 'branch-created',
        },
      },
      {
        domain: 'fnd-03',
        payload: {
          leaseId: 'worktree:workflow-kit:run-0042',
          fresh: false,
          reason: 'new-worktree',
          resultingState: 'setup-required',
        },
      },
    ] satisfies readonly Partial<WorkspaceRepositoryAppendIntent>[]);
  });

  it('exports only the design-authorized lifecycle states', () => {
    const states: readonly WorktreeLeaseState[] = WORKTREE_LEASE_STATES;

    expect(states).toEqual([
      'planned',
      'leased',
      'branch-created',
      'setup-required',
      'ready',
      'finalized',
      'cleanup-pending',
      'cleanup-blocked',
      'cleaned',
    ]);
  });

  it('evaluates declared setup freshness across marker, path-set, artifact, and unknown detectors', () => {
    const markerMissing = createHarness({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'marker-file', path: '.setup-ready', contentHash: 'sha256:expected' },
        rerunPolicy: 'when-stale',
      },
      baseSha: 'abc1234' as GitSha,
    });
    const markerMissingLease = expectCreateLeaseSuccess(
      markerMissing.workspaceRepository.createLease({
        runId: 'marker-missing',
        taskId: 'fnd-03-s2',
        repoId: markerMissing.repository.repoId,
      }),
    );

    expect(markerMissingLease.setupEvaluation.reason).toBe('marker-missing');

    const markerMismatch = createHarness({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'marker-file', path: '.setup-ready', contentHash: 'sha256:expected' },
        rerunPolicy: 'when-stale',
      },
      baseSha: 'abc1234' as GitSha,
    });
    const markerMismatchCreated = expectCreateLeaseSuccess(
      markerMismatch.workspaceRepository.createLease({
        runId: 'marker-mismatch',
        taskId: 'fnd-03-s2',
        repoId: markerMismatch.repository.repoId,
      }),
    );
    writeText(join(markerMismatchCreated.lease.worktreePath, '.setup-ready'), 'sha256:other');

    const markerMismatchEvaluation = markerMismatch.workspaceRepository.evaluateSetup(
      markerMismatchCreated.lease.leaseId,
    );

    expect(markerMismatchEvaluation.ok).toBe(true);
    if (markerMismatchEvaluation.ok) {
      expect(markerMismatchEvaluation.value.setupEvaluation.reason).toBe('marker-mismatch');
      expect(markerMismatchEvaluation.value.lease.state).toBe('setup-required');
    }

    const pathSetMissing = createHarness({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'path-set', paths: ['node_modules/.bin/vitest', 'dist/index.js'] },
        rerunPolicy: 'when-stale',
      },
      baseSha: 'abc1234' as GitSha,
    });
    const pathSetCreated = expectCreateLeaseSuccess(
      pathSetMissing.workspaceRepository.createLease({
        runId: 'paths-missing',
        taskId: 'fnd-03-s2',
        repoId: pathSetMissing.repository.repoId,
      }),
    );

    expect(pathSetCreated.setupEvaluation.reason).toBe('paths-missing');

    const artifactStale = createHarness({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'artifact-ref', refName: 'setup-manifest' },
        rerunPolicy: 'when-stale',
      },
      artifactRefs: new Map(),
      baseSha: 'abc1234' as GitSha,
    });
    const artifactStaleCreated = expectCreateLeaseSuccess(
      artifactStale.workspaceRepository.createLease({
        runId: 'artifact-stale',
        taskId: 'fnd-03-s2',
        repoId: artifactStale.repository.repoId,
      }),
    );

    expect(artifactStaleCreated.setupEvaluation.reason).toBe('artifact-stale');

    const freshnessUnknown = createHarness({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'marker-file', path: '.setup-ready', contentHash: 'sha256:expected' },
        rerunPolicy: 'when-stale',
      },
      baseSha: 'abc1234' as GitSha,
      readTextFileFails: true,
    });
    const freshnessUnknownCreated = expectCreateLeaseSuccess(
      freshnessUnknown.workspaceRepository.createLease({
        runId: 'freshness-unknown',
        taskId: 'fnd-03-s2',
        repoId: freshnessUnknown.repository.repoId,
      }),
    );

    expect(freshnessUnknownCreated.setupEvaluation.reason).toBe('setup-freshness-unknown');
  });

  it('uses the default local setup dependencies and treats artifact lookup failures as unknown freshness', () => {
    const root = createTempRoot();
    const worktreePath = join(root, 'default-setup') as AbsolutePath;
    mkdirSync(worktreePath, { recursive: true });

    const markerSetup: DeclaredSetup = {
      command: 'pnpm install',
      workingDirectory: '.',
      freshness: { kind: 'marker-file', path: '.setup-ready', contentHash: 'sha256:expected' },
      rerunPolicy: 'when-stale',
    };
    const defaultDependencies = createSetupDependencies();

    expect(
      evaluateDeclaredSetup(
        {
          leaseId: 'lease-default-marker',
          setup: markerSetup,
          worktreePath,
          isInitialEvaluation: false,
        },
        defaultDependencies,
      ),
    ).toEqual({
      leaseId: 'lease-default-marker',
      setup: markerSetup,
      fresh: false,
      reason: 'marker-missing',
    });

    writeText(join(worktreePath, '.setup-ready'), 'sha256:expected');

    expect(
      evaluateDeclaredSetup(
        {
          leaseId: 'lease-default-marker',
          setup: markerSetup,
          worktreePath,
          isInitialEvaluation: false,
        },
        defaultDependencies,
      ),
    ).toEqual({
      leaseId: 'lease-default-marker',
      setup: markerSetup,
      fresh: true,
      reason: 'new-worktree',
    });

    const artifactSetup: DeclaredSetup = {
      command: 'pnpm install',
      workingDirectory: '.',
      freshness: { kind: 'artifact-ref', refName: 'setup-manifest' },
      rerunPolicy: 'when-stale',
    };

    expect(
      evaluateDeclaredSetup(
        {
          leaseId: 'lease-default-artifact',
          setup: artifactSetup,
          worktreePath,
          isInitialEvaluation: false,
        },
        defaultDependencies,
      ),
    ).toEqual({
      leaseId: 'lease-default-artifact',
      setup: artifactSetup,
      fresh: false,
      reason: 'artifact-stale',
    });

    const failingArtifactDependencies = createSetupDependencies({
      resolveArtifactRef: () => ({ ok: false }),
    });

    expect(
      evaluateDeclaredSetup(
        {
          leaseId: 'lease-artifact-unknown',
          setup: artifactSetup,
          worktreePath,
          isInitialEvaluation: false,
        },
        failingArtifactDependencies,
      ),
    ).toEqual({
      leaseId: 'lease-artifact-unknown',
      setup: artifactSetup,
      fresh: false,
      reason: 'setup-freshness-unknown',
    });
  });

  it('re-evaluates freshness on confirmSetup and becomes ready only after a fresh local check', () => {
    const harness = createHarness({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'marker-file', path: '.setup-ready', contentHash: 'sha256:expected' },
        rerunPolicy: 'when-stale',
      },
      baseSha: 'abc1234' as GitSha,
    });

    const created = expectCreateLeaseSuccess(
      harness.workspaceRepository.createLease({
        runId: 'confirm-flow',
        taskId: 'fnd-03-s2',
        repoId: harness.repository.repoId,
      }),
    );

    const stillStale = expectConfirmSuccess(
      harness.workspaceRepository.confirmSetup({
        leaseId: created.lease.leaseId,
        epoch: created.lease.epoch,
        fenceToken: created.lease.fenceToken,
      }),
    );

    expect(stillStale.setupEvaluation).toEqual({
      leaseId: created.lease.leaseId,
      setup: created.setupEvaluation.setup,
      fresh: false,
      reason: 'marker-missing',
    });
    expect(stillStale.lease.state).toBe('setup-required');

    writeText(join(created.lease.worktreePath, '.setup-ready'), 'sha256:expected');

    const ready = expectConfirmSuccess(
      harness.workspaceRepository.confirmSetup({
        leaseId: created.lease.leaseId,
        epoch: created.lease.epoch,
        fenceToken: created.lease.fenceToken,
      }),
    );

    expect(ready.setupEvaluation.fresh).toBe(true);
    expect(ready.lease.state).toBe('ready');
    expect(ready.appendIntents.at(-1)).toMatchObject({
      type: 'RepoSetupConfirmed',
      payload: {
        leaseId: created.lease.leaseId,
        resultingState: 'ready',
      },
    });
  });

  it('rejects evaluateSetup and confirmSetup for unknown lease ids', () => {
    const harness = createHarness({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'path-set', paths: ['node_modules'] },
        rerunPolicy: 'when-stale',
      },
      baseSha: 'abc1234' as GitSha,
    });

    expect(harness.workspaceRepository.evaluateSetup('missing-lease')).toEqual({
      ok: false,
      error: {
        token: 'lease-not-found',
        leaseId: 'missing-lease',
      },
    });
    expect(
      harness.workspaceRepository.confirmSetup({
        leaseId: 'missing-lease',
        epoch: 1,
        fenceToken: 'missing-token',
      }),
    ).toEqual({
      ok: false,
      error: {
        token: 'lease-not-found',
        leaseId: 'missing-lease',
      },
    });
  });

  it('rejects stale or mismatched fence tokens before protected setup confirmation state changes', () => {
    const harness = createHarness({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'marker-file', path: '.setup-ready' },
        rerunPolicy: 'when-stale',
      },
      baseSha: 'abc1234' as GitSha,
    });

    const created = expectCreateLeaseSuccess(
      harness.workspaceRepository.createLease({
        runId: 'stale-fence',
        taskId: 'fnd-03-s2',
        repoId: harness.repository.repoId,
      }),
    );

    const staleFence = harness.workspaceRepository.confirmSetup({
      leaseId: created.lease.leaseId,
      epoch: created.lease.epoch,
      fenceToken: 'wrong-token',
    });
    const afterFailure = harness.workspaceRepository.evaluateSetup(created.lease.leaseId);

    expect(staleFence).toEqual({
      ok: false,
      error: {
        token: 'stale-lease-fence',
        leaseId: created.lease.leaseId,
        epoch: created.lease.epoch,
      },
    });
    expect(afterFailure.ok).toBe(true);
    if (afterFailure.ok) {
      expect(afterFailure.value.lease.state).toBe('setup-required');
    }
  });

  it('surfaces degraded lease acquisition and worktree creation failures as fail-closed results', () => {
    const degraded = createHarness({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'path-set', paths: ['node_modules'] },
        rerunPolicy: 'when-stale',
      },
      baseSha: 'abc1234' as GitSha,
      leaseHealth: 'read-only',
    });

    expect(
      degraded.workspaceRepository.createLease({
        runId: 'degraded-lease',
        taskId: 'fnd-03-s2',
        repoId: degraded.repository.repoId,
      }),
    ).toEqual({
      ok: false,
      error: {
        code: 'lease-unavailable',
        health: 'read-only',
        message: 'Authoritative lease is unavailable while storage health is read-only.',
      },
    });

    const createWorktreeFailure = createHarness({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'path-set', paths: ['node_modules'] },
        rerunPolicy: 'when-stale',
      },
      baseSha: 'abc1234' as GitSha,
      createWorktreeFails: true,
    });

    expect(
      createWorktreeFailure.workspaceRepository.createLease({
        runId: 'create-worktree-fails',
        taskId: 'fnd-03-s2',
        repoId: createWorktreeFailure.repository.repoId,
      }),
    ).toEqual({
      ok: false,
      error: {
        token: 'worktree-path-conflict',
        worktreePath: join(createWorktreeFailure.worktreeRoot, 'workflow-kit', 'create-worktree-fails'),
      },
    });
  });

  it('rejects mismatched repo ids before base resolution, lease acquisition, or local worktree side effects', () => {
    const harness = createHarness({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'path-set', paths: ['node_modules'] },
        rerunPolicy: 'when-stale',
      },
      baseSha: 'abc1234' as GitSha,
    });

    const result = harness.workspaceRepository.createLease({
      runId: 'repo-mismatch',
      taskId: 'fnd-03-s2',
      repoId: 'another-repo',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        token: 'worktree-input-invalid',
        reason: 'repo-id-mismatch',
        repoId: 'another-repo',
      },
    });
    expect(harness.resolvedRefs).toEqual([]);
    expect(harness.leaseStore.read('worktree:another-repo:repo-mismatch')).toEqual({ health: 'ok' });
    expect(harness.worktreeCalls).toEqual([]);
    expect(harness.branchCalls).toEqual([]);
  });

  it('rejects traversal-style path segments before lease acquisition or worktree allocation', () => {
    const harness = createHarness({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'path-set', paths: ['node_modules'] },
        rerunPolicy: 'when-stale',
      },
      baseSha: 'abc1234' as GitSha,
    });

    const result = harness.workspaceRepository.createLease({
      runId: '../escape',
      taskId: 'fnd-03-s2',
      repoId: harness.repository.repoId,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        token: 'worktree-input-invalid',
        reason: 'path-traversal',
        segment: '../escape',
      },
    });
    expect(harness.resolvedRefs).toEqual([]);
    expect(harness.leaseStore.read('worktree:workflow-kit:../escape')).toEqual({ health: 'ok' });
    expect(harness.worktreeCalls).toEqual([]);
    expect(harness.branchCalls).toEqual([]);
  });

  it('fails closed on path conflict without reusing the existing target path', () => {
    const harness = createHarness({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'path-set', paths: ['node_modules'] },
        rerunPolicy: 'when-stale',
      },
      baseSha: 'abc1234' as GitSha,
    });

    mkdirSync(join(harness.worktreeRoot, 'workflow-kit', 'path-conflict'), { recursive: true });

    const result = harness.workspaceRepository.createLease({
      runId: 'path-conflict',
      taskId: 'fnd-03-s2',
      repoId: harness.repository.repoId,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        token: 'worktree-path-conflict',
        worktreePath: join(harness.worktreeRoot, 'workflow-kit', 'path-conflict'),
      },
    });
    expect(harness.worktreeCalls).toEqual([]);
    expect(harness.branchCalls).toEqual([]);
  });

  it('fails closed when the local base ref does not resolve and attempts no fetch', () => {
    const harness = createHarness({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'path-set', paths: ['node_modules'] },
        rerunPolicy: 'when-stale',
      },
      baseSha: undefined,
    });

    const result = harness.workspaceRepository.createLease({
      runId: 'missing-base',
      taskId: 'fnd-03-s2',
      repoId: harness.repository.repoId,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        token: 'base-ref-unresolved',
        ref: 'refs/heads/v-next',
      },
    });
    expect(harness.resolvedRefs).toEqual(['refs/heads/v-next']);
    expect(harness.worktreeCalls).toEqual([]);
    expect(harness.branchCalls).toEqual([]);
  });

  it('refuses local branch creation when the generated branch already points at another commit', () => {
    const harness = createHarness({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'path-set', paths: ['node_modules'] },
        rerunPolicy: 'when-stale',
      },
      baseSha: 'abc1234' as GitSha,
      existingBranchSha: 'def5678' as GitSha,
    });

    const result = harness.workspaceRepository.createLease({
      runId: 'branch-conflict',
      taskId: 'fnd-03-s2',
      repoId: harness.repository.repoId,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        token: 'branch-conflict',
        branchName: 'task/workflow-kit/branch-conflict/fnd-03-s2',
        existingSha: 'def5678',
        targetSha: 'abc1234',
      },
    });
    expect(harness.worktreeCalls).toEqual([]);
    expect(harness.branchCalls).toEqual([]);
  });
});
