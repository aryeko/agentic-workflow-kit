import { createHash } from 'node:crypto';
import * as nodeFs from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as git from 'isomorphic-git';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createFileSystemStorageRoot,
  type FileSystemStorageRootOptions,
  type IdGenerator,
  isStorageError,
  type StorageClock,
  type StorageError,
  type StorageRoot,
  type TokenGenerator,
} from '../../foundation-fnd-02/src/index.js';
import { createWorkspaceRepository, isWorkspaceFailure, type WorkspaceRepository } from '../src/index.js';
import {
  createLinkedWorktree,
  inspectTreeDiff,
  localBranchSha,
  pathExists,
  resolvePreparedRepository,
  resolveRepositoryIdentity,
  safeRelativePath,
  sha256File,
} from '../src/local-git.js';

class ManualClock implements StorageClock {
  #ms: number;

  constructor(iso: string) {
    this.#ms = Date.parse(iso);
  }

  now(): Date {
    return new Date(this.#ms);
  }
}

class SequenceGenerator implements IdGenerator, TokenGenerator {
  #next = 0;

  nextId(purpose: string): string {
    this.#next += 1;
    return `${purpose.replace(/[^a-z0-9-]/gi, '-')}-${this.#next}`;
  }

  nextToken(purpose: string): string {
    this.#next += 1;
    return `${purpose.replace(/[^a-z0-9-]/gi, '-')}-token-${this.#next}`;
  }
}

type TestContext = {
  readonly sourceRepo: string;
  readonly clock: ManualClock;
  readonly worktreeRoot: string;
  readonly storageRoot: string;
  readonly storage: ReturnType<typeof createFileSystemStorageRoot>;
  readonly generator: SequenceGenerator;
  readonly registration: TestContextOptions;
  readonly workspace: WorkspaceRepository;
};

type TestContextOptions = Partial<Parameters<typeof createWorkspaceRepository>[0]['repositories'][number]> & {
  readonly storageProbe?: FileSystemStorageRootOptions['probe'];
  readonly maxArtifactBytes?: number;
};

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('workspace repository', () => {
  it('covers cleanup without branch deletion, missing worktree observations, and unknown evidence', async () => {
    const retained = await makeContext();
    await commitFile(retained.sourceRepo, 'README.md', 'base\n', 'base commit');
    const retainedLease = await unwrap(
      retained.workspace.createLease({ runId: 'run-retained', taskId: 'TASK-C', repoId: 'repo-a' }),
    );
    const retainedEvidence = await unwrap(retained.workspace.recordLocalGitEvidence(retainedLease.leaseId));
    await unwrap(
      retained.workspace.finalizeLease({
        leaseId: retainedLease.leaseId,
        evidenceId: retainedEvidence.evidenceId,
        epoch: retainedLease.epoch,
        fenceToken: retainedLease.fenceToken,
      }),
    );
    const retainedCleanup = await unwrap(
      retained.workspace.cleanupLease({
        leaseId: retainedLease.leaseId,
        epoch: retainedLease.epoch,
        fenceToken: retainedLease.fenceToken,
        deleteLocalBranch: false,
      }),
    );
    expect(retainedCleanup).toMatchObject({ state: 'cleaned', branchDisposition: 'retained-by-policy' });

    const missingGit = await makeContext();
    await commitFile(missingGit.sourceRepo, 'README.md', 'base\n', 'base commit');
    const missingGitLease = await unwrap(
      missingGit.workspace.createLease({ runId: 'run-missing-git', taskId: 'TASK-C', repoId: 'repo-a' }),
    );
    const missingGitEvidence = await unwrap(missingGit.workspace.recordLocalGitEvidence(missingGitLease.leaseId));
    await unwrap(
      missingGit.workspace.finalizeLease({
        leaseId: missingGitLease.leaseId,
        evidenceId: missingGitEvidence.evidenceId,
        epoch: missingGitLease.epoch,
        fenceToken: missingGitLease.fenceToken,
      }),
    );
    await rm(join(missingGitLease.worktreePath, '.git'), { recursive: true, force: true });
    const missingGitCleanup = await unwrap(
      missingGit.workspace.cleanupLease({
        leaseId: missingGitLease.leaseId,
        epoch: missingGitLease.epoch,
        fenceToken: missingGitLease.fenceToken,
        deleteLocalBranch: true,
      }),
    );
    expect(missingGitCleanup.observedHeadSha).toBeUndefined();

    const unknownEvidence = await makeContext();
    await commitFile(unknownEvidence.sourceRepo, 'README.md', 'base\n', 'base commit');
    const unknownEvidenceLease = await unwrap(
      unknownEvidence.workspace.createLease({ runId: 'run-unknown-evidence', taskId: 'TASK-C', repoId: 'repo-a' }),
    );
    await expect(
      unknownEvidence.workspace.finalizeLease({
        leaseId: unknownEvidenceLease.leaseId,
        evidenceId: 'missing-evidence',
        epoch: unknownEvidenceLease.epoch,
        fenceToken: unknownEvidenceLease.fenceToken,
      }),
    ).resolves.toMatchObject({ ok: false, error: { reason: 'evidence-unknown' } });
  });

  it('fails closed when workspace event persistence is unavailable across lease operations', async () => {
    const createBlocked = await makeContext();
    await commitFile(createBlocked.sourceRepo, 'README.md', 'base\n', 'base commit');
    await corruptWorkspaceLog(createBlocked);
    await expect(
      createBlocked.workspace.createLease({ runId: 'run-create-persist-fail', taskId: 'TASK-P', repoId: 'repo-a' }),
    ).resolves.toMatchObject({ ok: false, error: { reason: 'lease-unavailable' } });

    const evaluateBlocked = await makeContext({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'marker-file', path: '.ready' },
        rerunPolicy: 'when-stale',
      },
    });
    await commitFile(evaluateBlocked.sourceRepo, 'README.md', 'base\n', 'base commit');
    const evaluatedLease = await unwrap(
      evaluateBlocked.workspace.createLease({ runId: 'run-evaluate-persist-fail', taskId: 'TASK-P', repoId: 'repo-a' }),
    );
    await corruptWorkspaceLog(evaluateBlocked);
    await expect(evaluateBlocked.workspace.evaluateSetup(evaluatedLease.leaseId)).resolves.toMatchObject({
      ok: false,
      error: { reason: 'lease-unavailable' },
    });

    const finalizeBlocked = await makeContext();
    await commitFile(finalizeBlocked.sourceRepo, 'README.md', 'base\n', 'base commit');
    const finalizedLease = await unwrap(
      finalizeBlocked.workspace.createLease({ runId: 'run-finalize-persist-fail', taskId: 'TASK-P', repoId: 'repo-a' }),
    );
    const finalizedEvidence = await unwrap(finalizeBlocked.workspace.recordLocalGitEvidence(finalizedLease.leaseId));
    await corruptWorkspaceLog(finalizeBlocked);
    await expect(
      finalizeBlocked.workspace.finalizeLease({
        leaseId: finalizedLease.leaseId,
        evidenceId: finalizedEvidence.evidenceId,
        epoch: finalizedLease.epoch,
        fenceToken: finalizedLease.fenceToken,
      }),
    ).resolves.toMatchObject({ ok: false, error: { reason: 'lease-unavailable' } });

    const cleanupBlocked = await makeContext();
    await commitFile(cleanupBlocked.sourceRepo, 'README.md', 'base\n', 'base commit');
    const cleanupLease = await unwrap(
      cleanupBlocked.workspace.createLease({ runId: 'run-cleanup-persist-fail', taskId: 'TASK-P', repoId: 'repo-a' }),
    );
    const cleanupEvidence = await unwrap(cleanupBlocked.workspace.recordLocalGitEvidence(cleanupLease.leaseId));
    await unwrap(
      cleanupBlocked.workspace.finalizeLease({
        leaseId: cleanupLease.leaseId,
        evidenceId: cleanupEvidence.evidenceId,
        epoch: cleanupLease.epoch,
        fenceToken: cleanupLease.fenceToken,
      }),
    );
    await corruptWorkspaceLog(cleanupBlocked);
    await expect(
      cleanupBlocked.workspace.cleanupLease({
        leaseId: cleanupLease.leaseId,
        epoch: cleanupLease.epoch,
        fenceToken: cleanupLease.fenceToken,
        deleteLocalBranch: false,
      }),
    ).resolves.toMatchObject({ ok: false, error: { reason: 'lease-unavailable' } });

    const confirmBlocked = await makeContext({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'marker-file', path: '.ready' },
        rerunPolicy: 'when-stale',
      },
    });
    await commitFile(confirmBlocked.sourceRepo, 'README.md', 'base\n', 'base commit');
    const confirmLease = await unwrap(
      confirmBlocked.workspace.createLease({ runId: 'run-confirm-persist-fail', taskId: 'TASK-P', repoId: 'repo-a' }),
    );
    await corruptWorkspaceLog(confirmBlocked);
    await expect(
      confirmBlocked.workspace.confirmSetup({
        leaseId: confirmLease.leaseId,
        epoch: confirmLease.epoch,
        fenceToken: confirmLease.fenceToken,
      }),
    ).resolves.toMatchObject({ ok: false, error: { reason: 'lease-unavailable' } });

    const evidenceBlocked = await makeContext();
    await commitFile(evidenceBlocked.sourceRepo, 'README.md', 'base\n', 'base commit');
    const evidenceLease = await unwrap(
      evidenceBlocked.workspace.createLease({ runId: 'run-evidence-persist-fail', taskId: 'TASK-P', repoId: 'repo-a' }),
    );
    await corruptWorkspaceLog(evidenceBlocked);
    await expect(evidenceBlocked.workspace.recordLocalGitEvidence(evidenceLease.leaseId)).resolves.toMatchObject({
      ok: false,
      error: { reason: 'local-git-evidence-unavailable' },
    });
  });

  it('fails closed when a stored lease fence is no longer readable for guarded operations', async () => {
    const context = await makeContext({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'marker-file', path: '.ready' },
        rerunPolicy: 'when-stale',
      },
    });
    await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');
    const created = await unwrap(
      context.workspace.createLease({ runId: 'run-fence-corrupt', taskId: 'TASK-F', repoId: 'repo-a' }),
    );
    const evidence = await unwrap(context.workspace.recordLocalGitEvidence(created.leaseId));
    await writeFile(join(context.storageRoot, 'leases', `${sha256(created.leaseId)}.json`), '{"bad":true}\n');

    await expect(
      context.workspace.confirmSetup({
        leaseId: created.leaseId,
        epoch: created.epoch,
        fenceToken: created.fenceToken,
      }),
    ).resolves.toMatchObject({ ok: false, error: { reason: 'stale-lease-fence' } });
    await expect(
      context.workspace.finalizeLease({
        leaseId: created.leaseId,
        evidenceId: evidence.evidenceId,
        epoch: created.epoch,
        fenceToken: created.fenceToken,
      }),
    ).resolves.toMatchObject({ ok: false, error: { reason: 'stale-lease-fence' } });
    await expect(
      context.workspace.cleanupLease({
        leaseId: created.leaseId,
        epoch: created.epoch,
        fenceToken: created.fenceToken,
        deleteLocalBranch: false,
      }),
    ).resolves.toMatchObject({ ok: false, error: { reason: 'stale-lease-fence' } });
  });

  it('rebuilds only recognized persisted workspace events after restart', async () => {
    const context = await makeContext();
    await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');
    const lease = context.storage.leases.acquire('workspace:manual:seed', 'run-seed', 60_000);
    expect(isStorageError(lease)).toBe(false);
    if (isStorageError(lease)) {
      return;
    }
    const handle = context.storage.eventLog.openForAppend('fnd-03:workspace-repository:v1', lease);
    expect(isStorageError(handle)).toBe(false);
    if (isStorageError(handle)) {
      return;
    }
    const append = context.storage.eventLog.append(handle, {
      expectedSequence: 1,
      durability: 'barrier',
      payloads: [
        new TextEncoder().encode('not-json'),
        new TextEncoder().encode(
          JSON.stringify({
            schema: 'kit-vnext.workspace-repository-event.v1',
            type: 'lease-recorded',
            lease: {
              leaseId: 'workspace:missing:seed',
              repoId: 'missing',
              epoch: 1,
              runId: 'run',
              taskId: 'task',
              worktreePath: '/tmp/missing',
              baseRef: 'main',
              baseSha: 'sha',
              branchName: 'kit/missing',
              worktreeGitDir: '/tmp/missing.git',
              state: 'ready',
              fenceToken: 'token',
            },
          }),
        ),
        new TextEncoder().encode(
          JSON.stringify({
            schema: 'kit-vnext.workspace-repository-event.v1',
            type: 'local-git-evidence-recorded',
            leaseId: 'workspace:missing:seed',
            evidence: { evidenceId: 'ignored' },
          }),
        ),
      ],
    });
    expect(isStorageError(append)).toBe(false);

    const restarted = makeWorkspaceForContext(context);
    await expect(restarted.getLease('workspace:missing:seed')).resolves.toMatchObject({
      ok: false,
      error: { reason: 'lease-unavailable' },
    });
  });

  it('covers local git helper boundaries for unavailable repos and safe paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fnd-03-local-git-'));
    tempRoots.push(root);
    const missing = join(root, 'missing');

    expect(await pathExists(missing)).toBe(false);
    expect(await sha256File(missing)).toBeUndefined();
    expect(safeRelativePath(root, '')).toBeUndefined();
    expect(safeRelativePath(root, '/absolute')).toBeUndefined();
    expect(safeRelativePath(root, '../escape')).toBeUndefined();
    expect(safeRelativePath(root, 'inside/file.txt')).toBe(join(root, 'inside/file.txt'));

    const unavailable = await resolvePreparedRepository({
      repoId: 'missing',
      repoRoot: missing,
      defaultBaseRef: 'main',
    });
    expect(unavailable).toMatchObject({ kind: 'workspace-failure', reason: 'repository-unavailable' });

    await mkdir(missing, { recursive: true });
    await writeFile(join(missing, '.git'), 'not-a-gitdir\n');
    const malformed = await resolveRepositoryIdentity({
      repoId: 'malformed',
      repoRoot: missing,
      defaultBaseRef: 'main',
    });
    expect(malformed).toMatchObject({ kind: 'workspace-failure', reason: 'repository-unavailable' });
  });

  it('covers linked worktree conflicts and tree diff directory filtering', async () => {
    const context = await makeContext();
    const baseSha = await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');
    const prepared = await resolvePreparedRepository({
      repoId: 'repo-a',
      repoRoot: context.sourceRepo,
      defaultBaseRef: 'main',
    });
    if (isWorkspaceFailure(prepared)) {
      throw new Error(prepared.message);
    }
    const worktreePath = join(context.worktreeRoot, 'manual');
    await mkdir(worktreePath, { recursive: true });
    await expect(
      createLinkedWorktree({
        sourceRepoRoot: prepared.repoRoot,
        commonGitDir: prepared.commonGitDir,
        worktreePath,
        worktreeGitDir: join(prepared.commonGitDir, 'worktrees', 'manual'),
        branchName: 'kit/manual',
        baseSha,
      }),
    ).resolves.toMatchObject({ kind: 'workspace-failure', reason: 'worktree-path-conflict' });

    const created = await unwrap(
      context.workspace.createLease({ runId: 'run-tree-diff', taskId: 'TASK-D', repoId: 'repo-a' }),
    );
    await commitFile(created.worktreePath, 'dir/file.txt', 'nested\n', 'add nested file');
    const headSha = await localBranchSha(context.sourceRepo, created.branchName);
    expect(headSha).toBeDefined();
    if (headSha === undefined) {
      return;
    }
    const diff = await inspectTreeDiff({ worktreePath: created.worktreePath, fromSha: baseSha, toSha: headSha });
    expect(diff.changedPaths).toEqual(['dir/file.txt']);
  });
});

const makeContext = async (registration: TestContextOptions = {}): Promise<TestContext> => {
  const root = await mkdtemp(join(tmpdir(), 'fnd-03-'));
  tempRoots.push(root);
  const sourceRepo = join(root, 'source');
  const worktreeRoot = join(root, 'worktrees');
  const storageRoot = join(root, 'storage');
  await mkdir(sourceRepo, { recursive: true });
  await git.init({ fs: nodeFs, dir: sourceRepo, defaultBranch: 'main' });
  const clock = new ManualClock('2026-06-19T00:00:00.000Z');
  const generator = new SequenceGenerator();
  const storageOptions: FileSystemStorageRootOptions = {
    root: storageRoot,
    clock,
    idGenerator: generator,
    tokenGenerator: generator,
    ...(registration.storageProbe ? { probe: registration.storageProbe } : {}),
    ...(registration.maxArtifactBytes ? { maxArtifactBytes: registration.maxArtifactBytes } : {}),
  };
  const storage = createFileSystemStorageRoot(storageOptions);
  const workspace = createWorkspaceRepository({
    storage,
    worktreeRoot,
    clock,
    idGenerator: generator,
    leaseTtlMs: 60_000,
    repositories: [
      {
        repoId: 'repo-a',
        repoRoot: sourceRepo,
        defaultBaseRef: 'main',
        ...repositoryRegistrationOnly(registration),
      },
    ],
  });
  return { sourceRepo, clock, worktreeRoot, storageRoot, storage, generator, registration, workspace };
};

const makeWorkspaceForContext = (context: TestContext, storage: StorageRoot = context.storage): WorkspaceRepository =>
  createWorkspaceRepository({
    storage,
    worktreeRoot: context.worktreeRoot,
    clock: context.clock,
    idGenerator: context.generator,
    leaseTtlMs: 60_000,
    repositories: [
      {
        repoId: 'repo-a',
        repoRoot: context.sourceRepo,
        defaultBaseRef: 'main',
        ...repositoryRegistrationOnly(context.registration),
      },
    ],
  });

const _storageWithFailingEventAppends = (storage: StorageRoot): StorageRoot => ({
  health: storage.health,
  leases: storage.leases,
  artifacts: storage.artifacts,
  eventLog: {
    openForAppend: storage.eventLog.openForAppend.bind(storage.eventLog),
    replay: storage.eventLog.replay.bind(storage.eventLog),
    append: () => storageError('forced append failure'),
  },
});

const _storageWithFailingEvidenceAppends = (storage: StorageRoot, evidenceIds: string[]): StorageRoot => ({
  health: storage.health,
  leases: storage.leases,
  artifacts: storage.artifacts,
  eventLog: {
    openForAppend: storage.eventLog.openForAppend.bind(storage.eventLog),
    replay: storage.eventLog.replay.bind(storage.eventLog),
    append: (handle, batch) => {
      const parsed = parseJsonPayload(batch.payloads[0]);
      if (parsed?.type === 'local-git-evidence-recorded') {
        if (typeof parsed.evidence?.evidenceId === 'string') {
          evidenceIds.push(parsed.evidence.evidenceId);
        }
        return storageError('forced evidence append failure');
      }
      return storage.eventLog.append(handle, batch);
    },
  },
});

const repositoryRegistrationOnly = (
  options: TestContextOptions,
): Partial<Parameters<typeof createWorkspaceRepository>[0]['repositories'][number]> => {
  const { storageProbe: _storageProbe, maxArtifactBytes: _maxArtifactBytes, ...registration } = options;
  return registration;
};

const commitFile = async (dir: string, path: string, content: string, message: string): Promise<string> => {
  const absolutePath = join(dir, path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
  await git.add({ fs: nodeFs, dir, filepath: path });
  return git.commit({
    fs: nodeFs,
    dir,
    message,
    author: { name: 'Test Author', email: 'test@example.com', timestamp: 1_780_000_000, timezoneOffset: 0 },
  });
};

const unwrap = async <T>(
  promise: Promise<{ readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown }>,
): Promise<T> => {
  const result = await promise;
  if (!result.ok) {
    throw new Error(
      isWorkspaceFailure(result.error) ? `${result.error.reason}: ${result.error.message}` : 'unexpected failure',
    );
  }
  return result.value;
};

const sha256 = (content: string): string => createHash('sha256').update(content).digest('hex');

const _expectedBranchName = (
  repoId: string,
  runId: string,
  taskId: string,
  policy: {
    readonly prefix: string;
    readonly includeRunId: boolean;
    readonly includeTaskId: boolean;
    readonly maxLength: number;
  },
): string => {
  const suffix = createHash('sha256').update(JSON.stringify({ repoId, runId, taskId })).digest('hex').slice(0, 8);
  const segments = [
    policy.prefix,
    sanitize(repoId),
    ...(policy.includeRunId ? [sanitize(runId)] : []),
    ...(policy.includeTaskId ? [sanitize(taskId)] : []),
  ];
  const base = segments.join('/');
  const branchName = `${base}-${suffix}`;
  if (branchName.length <= policy.maxLength) {
    return branchName;
  }
  const suffixSegment = `-${suffix}`;
  if (policy.maxLength <= suffixSegment.length) {
    return suffix.slice(0, policy.maxLength);
  }
  return `${base.slice(0, policy.maxLength - suffixSegment.length)}${suffixSegment}`;
};

const sanitize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

const storageError = (message: string): StorageError => ({
  kind: 'storage-error',
  code: 'storage-unavailable',
  message,
  health: 'unusable',
});

const parseJsonPayload = (
  payload: Uint8Array | undefined,
): { readonly type?: unknown; readonly evidence?: { readonly evidenceId?: unknown } } | undefined => {
  if (payload === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(new TextDecoder().decode(payload)) as {
      readonly type?: unknown;
      readonly evidence?: { readonly evidenceId?: unknown };
    };
  } catch {
    return undefined;
  }
};

const corruptWorkspaceLog = async (context: TestContext): Promise<void> => {
  const workspaceLogId = 'fnd-03:workspace-repository:v1';
  const logPath = join(context.storageRoot, 'logs', `${sha256(workspaceLogId)}.jsonl`);
  await mkdir(dirname(logPath), { recursive: true });
  await writeFile(logPath, '{"bad":true}\n{"still":"bad"}\n');
};

const _collectSourceFiles = async (root: string): Promise<readonly string[]> => {
  const entries = await nodeFs.promises.readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
};
