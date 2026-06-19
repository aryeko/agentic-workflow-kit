import { join, resolve } from 'node:path';
import * as nodeFs from 'node:fs';
import * as git from 'isomorphic-git';
import type { Result } from '@kit-vnext/foundation-fnd-01';
import type { ArtifactRef, StorageError } from '@kit-vnext/foundation-fnd-02';
import {
  createLinkedWorktree,
  inspectCommitRange,
  inspectTreeDiff,
  inspectWorkingTree,
  localBranchSha,
  pathExists,
  removeWorktreeRegistration,
  removeWorktreePath,
  resolveLocalRef,
  resolvePreparedRepository,
  resolveRepositoryIdentity,
  safeRelativePath,
  sha256File,
  type PreparedRepository,
} from './local-git.js';
import {
  fail,
  isWorkspaceFailure,
  ok,
  type BranchPolicy,
  type CleanupResult,
  type CleanupTombstone,
  type LocalGitEvidence,
  type LocalGitEvidenceFailure,
  type RepositoryRegistration,
  type SetupEvaluation,
  type SetupFreshnessReason,
  type WorkspaceFailure,
  type WorkspaceRepository,
  type WorkspaceRepositoryOptions,
  type WorktreeLease,
  type WorktreeLeaseState,
} from './types.js';

const workspaceLogId = 'fnd-03:workspace-repository:v1';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type LeaseRecord = {
  readonly lease: WorktreeLease;
  readonly registration: RepositoryRegistration;
  readonly evidenceById: ReadonlyMap<string, LocalGitEvidence>;
};

type PersistedWorkspaceEvent =
  | {
      readonly schema: 'kit-vnext.workspace-repository-event.v1';
      readonly type: 'lease-recorded';
      readonly lease: WorktreeLease;
    }
  | {
      readonly schema: 'kit-vnext.workspace-repository-event.v1';
      readonly type: 'local-git-evidence-recorded';
      readonly leaseId: string;
      readonly evidence: LocalGitEvidence;
    }
  | {
      readonly schema: 'kit-vnext.workspace-repository-event.v1';
      readonly type: 'cleanup-tombstone-recorded';
      readonly leaseId: string;
      readonly tombstone: CleanupTombstone;
    };

const defaultBranchPolicy: BranchPolicy = {
  prefix: 'kit',
  includeRunId: true,
  includeTaskId: true,
  maxLength: 96,
};

export const createWorkspaceRepository = (options: WorkspaceRepositoryOptions): WorkspaceRepository => {
  const registrationsById = new Map(options.repositories.map((registration) => [registration.repoId, registration]));
  const registrationsByRoot = new Map(
    options.repositories.map((registration) => [resolve(registration.repoRoot), registration]),
  );
  const leases = new Map<string, LeaseRecord>();
  const cleanupTombstones = new Map<string, CleanupTombstone>();

  const rebuildPersistedState = (): void => {
    const replay = options.storage.eventLog.replay(workspaceLogId);
    for (const record of replay.records) {
      const event = parsePersistedEvent(record.payload);
      if (event === undefined) {
        continue;
      }
      if (event.type === 'lease-recorded') {
        const registration = registrationsById.get(event.lease.repoId);
        if (registration !== undefined) {
          const existing = leases.get(event.lease.leaseId);
          leases.set(event.lease.leaseId, {
            lease: event.lease,
            registration,
            evidenceById: existing?.evidenceById ?? new Map(),
          });
        }
      }
      if (event.type === 'local-git-evidence-recorded') {
        const existing = leases.get(event.leaseId);
        if (existing !== undefined) {
          leases.set(event.leaseId, {
            ...existing,
            evidenceById: new Map(existing.evidenceById).set(event.evidence.evidenceId, event.evidence),
          });
        }
      }
      if (event.type === 'cleanup-tombstone-recorded') {
        cleanupTombstones.set(event.leaseId, event.tombstone);
      }
    }
  };

  const getLeaseRecord = (leaseId: string): Result<LeaseRecord, WorkspaceFailure> => {
    const record = leases.get(leaseId);
    if (record === undefined) {
      return fail({ reason: 'lease-unavailable', message: `lease is unknown: ${leaseId}`, leaseId });
    }
    return ok(record);
  };

  const replaceLease = (record: LeaseRecord, state: WorktreeLeaseState): WorktreeLease => {
    const lease = { ...record.lease, state };
    leases.set(lease.leaseId, { ...record, lease });
    return lease;
  };

  const evaluateSetupForRecord = async (record: LeaseRecord): Promise<SetupEvaluation> => {
    const inspectedAt = options.clock.now().toISOString();
    const setup = record.registration.setup;
    if (setup === undefined) {
      return { leaseId: record.lease.leaseId, fresh: true, inspectedAt };
    }
    if (setup.rerunPolicy === 'always') {
      return { leaseId: record.lease.leaseId, setup, fresh: false, reason: 'new-worktree', inspectedAt };
    }

    const reason = await staleSetupReason(record.lease.worktreePath, setup, options);
    return reason === undefined
      ? { leaseId: record.lease.leaseId, setup, fresh: true, inspectedAt }
      : { leaseId: record.lease.leaseId, setup, fresh: false, reason, inspectedAt };
  };

  const updateSetupState = (record: LeaseRecord, evaluation: SetupEvaluation): WorktreeLease => {
    if (record.registration.setup === undefined) {
      return replaceLease(record, 'ready');
    }
    return replaceLease(record, evaluation.fresh ? 'ready' : 'setup-required');
  };

  const assertFence = (lease: WorktreeLease): Result<true, WorkspaceFailure> => {
    if (!options.storage.leases.fence(lease.leaseId, lease.epoch, lease.fenceToken)) {
      return fail({
        reason: 'stale-lease-fence',
        message: `lease fence is stale: ${lease.leaseId}`,
        leaseId: lease.leaseId,
      });
    }
    return ok(true);
  };

  const repository: WorkspaceRepository = {
    async resolveRepository(repoRoot) {
      const registration = registrationsByRoot.get(resolve(repoRoot));
      if (registration === undefined) {
        return fail({ reason: 'repository-unknown', message: `repository is not registered: ${repoRoot}` });
      }
      const identity = await resolveRepositoryIdentity(registration);
      return isWorkspaceFailure(identity) ? { ok: false, error: identity } : ok(identity);
    },

    async createLease(input) {
      const registration = registrationsById.get(input.repoId);
      if (registration === undefined) {
        return fail({ reason: 'repository-unknown', message: `repository is not registered: ${input.repoId}` });
      }
      const prepared = await resolvePreparedRepository(registration);
      if (isWorkspaceFailure(prepared)) {
        return { ok: false, error: prepared };
      }
      const baseRef = input.baseRef ?? registration.defaultBaseRef;
      const baseSha = await resolveLocalRef(prepared.repoRoot, baseRef);
      if (isWorkspaceFailure(baseSha)) {
        return { ok: false, error: baseSha };
      }
      const branchName = branchNameFor(registration, input);
      const conflict = await branchConflict(prepared, branchName, baseSha);
      if (conflict !== undefined) {
        return { ok: false, error: conflict };
      }
      const leaseId = `workspace:${input.repoId}:${input.runId}`;
      const leaseCapability = options.storage.leases.acquire(leaseId, input.runId, options.leaseTtlMs);
      if (isStorageError(leaseCapability)) {
        return fail({ reason: 'lease-unavailable', message: leaseCapability.message, leaseId });
      }
      const worktreePath = resolve(options.worktreeRoot, input.repoId, input.runId);
      const worktreeGitDir = resolve(prepared.commonGitDir, 'worktrees', worktreeRegistrationName(leaseId));
      const checkout = await createLinkedWorktree({
        sourceRepoRoot: prepared.repoRoot,
        commonGitDir: prepared.commonGitDir,
        worktreePath,
        worktreeGitDir,
        branchName,
        baseSha,
      });
      if (checkout !== undefined) {
        return { ok: false, error: checkout };
      }

      const lease: WorktreeLease = {
        leaseId,
        epoch: leaseCapability.epoch,
        runId: input.runId,
        taskId: input.taskId,
        repoId: input.repoId,
        worktreePath,
        baseRef,
        baseSha,
        branchName,
        worktreeGitDir,
        state: 'branch-created',
        fenceToken: leaseCapability.token,
        setup: registration.setup,
      };
      const record: LeaseRecord = { lease, registration, evidenceById: new Map() };
      leases.set(leaseId, record);
      const setup = await evaluateSetupForRecord(record);
      const updated = updateSetupState(record, setup);
      const persisted = persistEvent(options, updated, {
        schema: 'kit-vnext.workspace-repository-event.v1',
        type: 'lease-recorded',
        lease: updated,
      });
      return persisted === undefined ? ok(updated) : fail(persisted);
    },

    async getLease(leaseId) {
      const record = getLeaseRecord(leaseId);
      return record.ok ? ok(record.value.lease) : record;
    },

    async evaluateSetup(leaseId) {
      const record = getLeaseRecord(leaseId);
      if (!record.ok) {
        return record;
      }
      const evaluation = await evaluateSetupForRecord(record.value);
      const lease = updateSetupState(record.value, evaluation);
      const persisted = persistEvent(options, lease, {
        schema: 'kit-vnext.workspace-repository-event.v1',
        type: 'lease-recorded',
        lease,
      });
      if (persisted !== undefined) {
        return fail(persisted);
      }
      return ok(evaluation);
    },

    async confirmSetup(input) {
      const record = getLeaseRecord(input.leaseId);
      if (!record.ok) {
        return record;
      }
      if (record.value.lease.epoch !== input.epoch || record.value.lease.fenceToken !== input.fenceToken) {
        return fail({
          reason: 'stale-lease-fence',
          message: `lease fence is stale: ${input.leaseId}`,
          leaseId: input.leaseId,
        });
      }
      const fenced = assertFence(record.value.lease);
      if (!fenced.ok) {
        return fenced;
      }
      const evaluation = await evaluateSetupForRecord(record.value);
      const lease = updateSetupState(record.value, evaluation);
      const persisted = persistEvent(options, lease, {
        schema: 'kit-vnext.workspace-repository-event.v1',
        type: 'lease-recorded',
        lease,
      });
      if (persisted !== undefined) {
        return fail(persisted);
      }
      return ok(evaluation);
    },

    async recordLocalGitEvidence(leaseId) {
      const record = getLeaseRecord(leaseId);
      if (!record.ok) {
        return unavailable(leaseId, record.error.message);
      }
      try {
        const lease = record.value.lease;
        const commitRange = await inspectCommitRange({
          worktreePath: lease.worktreePath,
          branchName: lease.branchName,
          baseSha: lease.baseSha,
        });
        const diff = await inspectTreeDiff({
          worktreePath: lease.worktreePath,
          fromSha: commitRange.mergeBaseSha,
          toSha: commitRange.headSha,
        });
        const workingTree = await inspectWorkingTree(lease.worktreePath);
        const evidenceId = options.idGenerator.nextId(`local-git-evidence:${lease.leaseId}`);
        const statRef = putArtifact(
          options,
          JSON.stringify({ changedPaths: diff.changedPaths, clean: workingTree.clean }, null, 2),
          'local-git-evidence-stat',
        );
        const evidenceWithoutRef: Omit<LocalGitEvidence, 'evidenceRef'> = {
          evidenceId,
          leaseId,
          repoId: lease.repoId,
          worktreePath: lease.worktreePath,
          branchName: lease.branchName,
          inspectedAt: options.clock.now().toISOString(),
          baseSha: lease.baseSha,
          mergeBaseSha: commitRange.mergeBaseSha,
          headSha: commitRange.headSha,
          localCommits: commitRange.commits,
          diff: {
            fromSha: commitRange.mergeBaseSha,
            toSha: commitRange.headSha,
            changedPaths: diff.changedPaths,
            statRef,
          },
          workingTree,
        };
        const evidenceRef = putArtifact(options, JSON.stringify(evidenceWithoutRef, null, 2), 'local-git-evidence');
        const evidence: LocalGitEvidence = { ...evidenceWithoutRef, evidenceRef };
        const nextEvidence = new Map(record.value.evidenceById).set(evidenceId, evidence);
        leases.set(leaseId, { ...record.value, evidenceById: nextEvidence });
        const persisted = persistEvent(options, lease, {
          schema: 'kit-vnext.workspace-repository-event.v1',
          type: 'local-git-evidence-recorded',
          leaseId,
          evidence,
        });
        if (persisted !== undefined) {
          return unavailable(leaseId, persisted.message);
        }
        return ok(evidence);
      } catch {
        return unavailable(leaseId, 'local git evidence could not be inspected');
      }
    },

    async finalizeLease(input) {
      const record = getLeaseRecord(input.leaseId);
      if (!record.ok) {
        return record;
      }
      if (record.value.lease.epoch !== input.epoch || record.value.lease.fenceToken !== input.fenceToken) {
        return fail({
          reason: 'stale-lease-fence',
          message: `lease fence is stale: ${input.leaseId}`,
          leaseId: input.leaseId,
        });
      }
      const fenced = assertFence(record.value.lease);
      if (!fenced.ok) {
        return fenced;
      }
      const evidence = record.value.evidenceById.get(input.evidenceId);
      if (evidence === undefined) {
        return fail({
          reason: 'evidence-unknown',
          message: `evidence is unknown: ${input.evidenceId}`,
          leaseId: input.leaseId,
        });
      }
      const lease = {
        ...record.value.lease,
        state: 'finalized' as const,
        finalizedEvidenceId: evidence.evidenceId,
        finalizedHeadSha: evidence.headSha,
      };
      leases.set(input.leaseId, { ...record.value, lease });
      const persisted = persistEvent(options, lease, {
        schema: 'kit-vnext.workspace-repository-event.v1',
        type: 'lease-recorded',
        lease,
      });
      if (persisted !== undefined) {
        return fail(persisted);
      }
      return ok(lease);
    },

    async cleanupLease(input) {
      const record = getLeaseRecord(input.leaseId);
      if (!record.ok) {
        return record;
      }
      if (record.value.lease.epoch !== input.epoch || record.value.lease.fenceToken !== input.fenceToken) {
        return fail({
          reason: 'stale-lease-fence',
          message: `lease fence is stale: ${input.leaseId}`,
          leaseId: input.leaseId,
        });
      }
      const fenced = assertFence(record.value.lease);
      if (!fenced.ok) {
        return fenced;
      }
      const lease = replaceLease(record.value, 'cleanup-pending');
      const observedHeadSha = await observedHead(lease);
      const workingTree = await observedWorkingTree(lease);
      if (workingTree !== undefined && !workingTree.clean) {
        const blocked: CleanupResult = {
          leaseId: input.leaseId,
          state: 'cleanup-blocked',
          reason: 'dirty-worktree',
          observedPath: lease.worktreePath,
          observedHeadSha,
          nextRetryAt: options.clock.now().toISOString(),
          operatorEscalationRequired: true,
        };
        replaceLease({ ...record.value, lease }, 'cleanup-blocked');
        const persisted = persistEvent(
          options,
          { ...lease, state: 'cleanup-blocked' },
          {
            schema: 'kit-vnext.workspace-repository-event.v1',
            type: 'lease-recorded',
            lease: { ...lease, state: 'cleanup-blocked' },
          },
        );
        if (persisted !== undefined) {
          return fail(persisted);
        }
        return ok(blocked);
      }
      if (
        input.expectedHeadSha !== undefined &&
        observedHeadSha !== undefined &&
        observedHeadSha !== input.expectedHeadSha
      ) {
        const blocked: CleanupResult = {
          leaseId: input.leaseId,
          state: 'cleanup-blocked',
          reason: 'head-mismatch',
          observedPath: lease.worktreePath,
          observedHeadSha,
          nextRetryAt: options.clock.now().toISOString(),
          operatorEscalationRequired: true,
        };
        replaceLease({ ...record.value, lease }, 'cleanup-blocked');
        const persisted = persistEvent(
          options,
          { ...lease, state: 'cleanup-blocked' },
          {
            schema: 'kit-vnext.workspace-repository-event.v1',
            type: 'lease-recorded',
            lease: { ...lease, state: 'cleanup-blocked' },
          },
        );
        if (persisted !== undefined) {
          return fail(persisted);
        }
        return ok(blocked);
      }

      const branchDisposition = await cleanupBranchDisposition(record.value.registration, lease, input);
      await removeWorktreePath(lease.worktreePath);
      await removeWorktreeRegistration(lease.worktreeGitDir);
      const tombstoneRef = putArtifact(
        options,
        JSON.stringify({ leaseId: lease.leaseId, worktreePath: lease.worktreePath, observedHeadSha }, null, 2),
        'workspace-cleanup-tombstone',
      );
      const tombstone: CleanupTombstone = {
        leaseId: lease.leaseId,
        state: 'cleaned',
        cleanedAt: options.clock.now().toISOString(),
        worktreePath: lease.worktreePath,
        branchName: lease.branchName,
        expectedHeadSha: input.expectedHeadSha,
        observedHeadSha,
        branchDisposition,
        artifactRef: tombstoneRef,
      };
      cleanupTombstones.set(lease.leaseId, tombstone);
      const cleanedLease = { ...lease, state: 'cleaned' as const };
      leases.set(lease.leaseId, { ...record.value, lease: cleanedLease });
      const persistedLease = persistEvent(options, cleanedLease, {
        schema: 'kit-vnext.workspace-repository-event.v1',
        type: 'lease-recorded',
        lease: cleanedLease,
      });
      if (persistedLease !== undefined) {
        return fail(persistedLease);
      }
      const persistedTombstone = persistEvent(options, cleanedLease, {
        schema: 'kit-vnext.workspace-repository-event.v1',
        type: 'cleanup-tombstone-recorded',
        leaseId: lease.leaseId,
        tombstone,
      });
      if (persistedTombstone !== undefined) {
        return fail(persistedTombstone);
      }
      options.storage.leases.release(lease.leaseId, lease.epoch, lease.fenceToken);
      return ok(tombstone);
    },

    getCleanupTombstone(leaseId) {
      return cleanupTombstones.get(leaseId);
    },
  };

  rebuildPersistedState();
  return repository;
};

const staleSetupReason = async (
  worktreePath: string,
  setup: NonNullable<RepositoryRegistration['setup']>,
  options: WorkspaceRepositoryOptions,
): Promise<SetupFreshnessReason | undefined> => {
  if (setup.rerunPolicy === 'on-fresh-worktree') {
    return 'new-worktree';
  }
  if (setup.freshness.kind === 'marker-file') {
    const markerPath = safeRelativePath(worktreePath, setup.freshness.path);
    if (markerPath === undefined || !(await pathExists(markerPath))) {
      return 'marker-missing';
    }
    if (setup.freshness.contentHash !== undefined) {
      const actualHash = await sha256File(markerPath);
      return actualHash === setup.freshness.contentHash ? undefined : 'marker-mismatch';
    }
    return undefined;
  }
  if (setup.freshness.kind === 'path-set') {
    const missingPath = await firstMissingPath(worktreePath, setup.freshness.paths);
    return missingPath === undefined ? undefined : 'paths-missing';
  }
  const artifact = options.storage.artifacts.resolve(setup.freshness.refName);
  return isStorageError(artifact) ? 'artifact-stale' : undefined;
};

const firstMissingPath = async (root: string, relativePaths: readonly string[]): Promise<string | undefined> => {
  for (const relativePath of relativePaths) {
    const absolutePath = safeRelativePath(root, relativePath);
    if (absolutePath === undefined || !(await pathExists(absolutePath))) {
      return relativePath;
    }
  }
  return undefined;
};

const branchNameFor = (
  registration: RepositoryRegistration,
  input: { readonly repoId: string; readonly runId: string; readonly taskId: string },
): string => {
  const policy = registration.branchPolicy ?? defaultBranchPolicy;
  const segments = [
    policy.prefix,
    sanitize(input.repoId),
    ...(policy.includeRunId ? [sanitize(input.runId)] : []),
    ...(policy.includeTaskId ? [sanitize(input.taskId)] : []),
  ];
  return segments.join('/').slice(0, policy.maxLength);
};

const branchConflict = async (
  prepared: PreparedRepository,
  branchName: string,
  baseSha: string,
): Promise<WorkspaceFailure | undefined> => {
  const existingSha = await localBranchSha(prepared.repoRoot, branchName);
  if (existingSha === undefined || existingSha === baseSha) {
    return undefined;
  }
  return {
    kind: 'workspace-failure',
    reason: 'branch-conflict',
    message: `local branch already exists at a different commit: ${branchName}`,
  };
};

const cleanupBranchDisposition = async (
  registration: RepositoryRegistration,
  lease: WorktreeLease,
  input: { readonly deleteLocalBranch: boolean; readonly expectedHeadSha?: string },
): Promise<CleanupTombstone['branchDisposition']> => {
  if (!input.deleteLocalBranch) {
    return 'retained-by-policy';
  }
  const prepared = await resolvePreparedRepository(registration);
  if (isWorkspaceFailure(prepared)) {
    return 'retained-by-policy';
  }
  const current = await localBranchSha(prepared.repoRoot, lease.branchName);
  if (current === undefined) {
    return 'already-absent';
  }
  if (input.expectedHeadSha !== undefined && current !== input.expectedHeadSha) {
    return 'retained-by-policy';
  }
  try {
    await git.deleteBranch({
      fs: nodeFs,
      dir: prepared.repoRoot,
      gitdir: prepared.commonGitDir,
      ref: lease.branchName,
    });
    return 'deleted';
  } catch {
    return 'retained-by-policy';
  }
};

const observedHead = async (lease: WorktreeLease): Promise<string | undefined> => {
  if (!(await pathExists(join(lease.worktreePath, '.git')))) {
    return undefined;
  }
  try {
    const range = await inspectCommitRange({
      worktreePath: lease.worktreePath,
      branchName: lease.branchName,
      baseSha: lease.baseSha,
    });
    return range.headSha;
  } catch {
    return undefined;
  }
};

const observedWorkingTree = async (
  lease: WorktreeLease,
): Promise<Awaited<ReturnType<typeof inspectWorkingTree>> | undefined> => {
  if (!(await pathExists(join(lease.worktreePath, '.git')))) {
    return undefined;
  }
  try {
    return await inspectWorkingTree(lease.worktreePath);
  } catch {
    return undefined;
  }
};

const putArtifact = (options: WorkspaceRepositoryOptions, content: string, producer: string): ArtifactRef => {
  const artifact = options.storage.artifacts.put({
    content,
    mediaType: 'application/json',
    retentionClass: 'run-retained',
    classification: 'local-git-evidence',
    producer,
  });
  if (isStorageError(artifact)) {
    throw new Error(artifact.message);
  }
  return artifact;
};

const persistEvent = (
  options: WorkspaceRepositoryOptions,
  lease: WorktreeLease,
  event: PersistedWorkspaceEvent,
): WorkspaceFailure | undefined => {
  const replay = options.storage.eventLog.replay(workspaceLogId);
  if (replay.health === 'log-interior-corrupt' || replay.health === 'unusable') {
    return {
      kind: 'workspace-failure',
      reason: 'lease-unavailable',
      message: `workspace repository log is unavailable: ${replay.health}`,
      leaseId: lease.leaseId,
    };
  }
  const handle = options.storage.eventLog.openForAppend(workspaceLogId, {
    name: lease.leaseId,
    epoch: lease.epoch,
    token: lease.fenceToken,
    expiresAt: options.clock.now(),
  });
  if (isStorageError(handle)) {
    return { kind: 'workspace-failure', reason: 'lease-unavailable', message: handle.message, leaseId: lease.leaseId };
  }
  const lastSequence = replay.records.at(-1)?.sequence ?? 0;
  const appended = options.storage.eventLog.append(handle, {
    expectedSequence: lastSequence + 1,
    durability: 'barrier',
    payloads: [textEncoder.encode(JSON.stringify(event))],
  });
  if (isStorageError(appended)) {
    return {
      kind: 'workspace-failure',
      reason: 'lease-unavailable',
      message: appended.message,
      leaseId: lease.leaseId,
    };
  }
  return undefined;
};

const parsePersistedEvent = (payload: Uint8Array): PersistedWorkspaceEvent | undefined => {
  try {
    const parsed = JSON.parse(textDecoder.decode(payload)) as Partial<PersistedWorkspaceEvent>;
    return parsed.schema === 'kit-vnext.workspace-repository-event.v1'
      ? (parsed as PersistedWorkspaceEvent)
      : undefined;
  } catch {
    return undefined;
  }
};

const worktreeRegistrationName = (leaseId: string): string => sanitize(leaseId).replace(/[/:]+/gu, '-');

const isStorageError = (value: unknown): value is StorageError =>
  typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'storage-error';

const unavailable = (leaseId: string, message: string): Result<never, LocalGitEvidenceFailure> => ({
  ok: false,
  error: {
    kind: 'workspace-failure',
    reason: 'local-git-evidence-unavailable',
    message,
    leaseId,
  },
});

const sanitize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
