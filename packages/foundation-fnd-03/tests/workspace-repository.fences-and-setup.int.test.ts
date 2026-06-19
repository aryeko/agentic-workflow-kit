import { createHash } from 'node:crypto';
import * as nodeFs from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as git from 'isomorphic-git';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createFileSystemStorageRoot,
  type FileSystemStorageRootOptions,
  type IdGenerator,
  type StorageClock,
  type StorageError,
  type StorageRoot,
  type TokenGenerator,
} from '../../foundation-fnd-02/src/index.js';
import { createWorkspaceRepository, isWorkspaceFailure, type WorkspaceRepository } from '../src/index.js';

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
  it('reloads fnd-02-backed lease, evidence, and tombstone records after repository restart', async () => {
    const context = await makeContext();
    await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');
    const created = await unwrap(
      context.workspace.createLease({ runId: 'run-restart', taskId: 'TASK-4B', repoId: 'repo-a' }),
    );
    await commitFile(created.worktreePath, 'restart.txt', 'persisted\n', 'restart commit');
    const evidence = await unwrap(context.workspace.recordLocalGitEvidence(created.leaseId));

    const restarted = makeWorkspaceForContext(context);
    const reloadedLease = await unwrap(restarted.getLease(created.leaseId));
    expect(reloadedLease.worktreePath).toBe(created.worktreePath);
    expect(reloadedLease.worktreeGitDir).toBe(created.worktreeGitDir);

    const finalized = await unwrap(
      restarted.finalizeLease({
        leaseId: created.leaseId,
        evidenceId: evidence.evidenceId,
        epoch: created.epoch,
        fenceToken: created.fenceToken,
      }),
    );
    expect(finalized.finalizedEvidenceId).toBe(evidence.evidenceId);

    const cleaned = await unwrap(
      restarted.cleanupLease({
        leaseId: created.leaseId,
        epoch: created.epoch,
        fenceToken: created.fenceToken,
        deleteLocalBranch: true,
        expectedHeadSha: evidence.headSha,
      }),
    );
    expect(cleaned.state).toBe('cleaned');

    const restartedAgain = makeWorkspaceForContext(context);
    expect(restartedAgain.getCleanupTombstone(created.leaseId)?.state).toBe('cleaned');
    expect((await unwrap(restartedAgain.getLease(created.leaseId))).state).toBe('cleaned');
  });

  it('fails closed on branch conflicts and stale fences', async () => {
    const context = await makeContext({
      branchPolicy: { prefix: 'kit', includeRunId: false, includeTaskId: true, maxLength: 80 },
    });
    const firstBase = await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');
    await git.branch({
      fs: nodeFs,
      dir: context.sourceRepo,
      ref: expectedBranchName('repo-a', 'run-conflict', 'TASK-4', {
        prefix: 'kit',
        includeRunId: false,
        includeTaskId: true,
        maxLength: 80,
      }),
      object: firstBase,
    });
    await commitFile(context.sourceRepo, 'later.txt', 'later\n', 'later commit');

    const conflicted = await context.workspace.createLease({
      runId: 'run-conflict',
      taskId: 'TASK-4',
      repoId: 'repo-a',
    });
    expect(conflicted.ok).toBe(false);
    if (conflicted.ok) {
      throw new Error('expected branch conflict');
    }
    expect(conflicted.error.reason).toBe('branch-conflict');

    const created = await unwrap(
      context.workspace.createLease({ runId: 'run-ok', taskId: 'TASK-5', repoId: 'repo-a' }),
    );
    const stale = await context.workspace.finalizeLease({
      leaseId: created.leaseId,
      evidenceId: 'missing',
      epoch: created.epoch + 1,
      fenceToken: created.fenceToken,
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) {
      throw new Error('expected stale fence');
    }
    expect(stale.error.reason).toBe('stale-lease-fence');
  });

  it('adds deterministic suffixes so sanitized branch collisions stay distinct', async () => {
    const branchPolicy = { prefix: 'kit', includeRunId: false, includeTaskId: true, maxLength: 96 };
    const context = await makeContext({ branchPolicy });
    await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');
    const first = await unwrap(context.workspace.createLease({ runId: 'run-one', taskId: 'TASK A', repoId: 'repo-a' }));
    const second = await unwrap(
      context.workspace.createLease({ runId: 'run-two', taskId: 'TASK*A', repoId: 'repo-a' }),
    );

    expect(first.branchName).toBe(expectedBranchName('repo-a', 'run-one', 'TASK A', branchPolicy));
    expect(second.branchName).toBe(expectedBranchName('repo-a', 'run-two', 'TASK*A', branchPolicy));
    expect(first.branchName).not.toBe(second.branchName);
    expect(first.branchName).toMatch(/^kit\/repo-a\/task-a-[a-f0-9]{8}$/u);
    expect(second.branchName).toMatch(/^kit\/repo-a\/task-a-[a-f0-9]{8}$/u);

    const repeatedContext = await makeContext({ branchPolicy });
    await commitFile(repeatedContext.sourceRepo, 'README.md', 'base\n', 'base commit');
    const repeated = await unwrap(
      repeatedContext.workspace.createLease({ runId: 'run-one', taskId: 'TASK A', repoId: 'repo-a' }),
    );
    expect(repeated.branchName).toBe(first.branchName);
  });

  it('keeps the package boundary free of subprocess and remote/forge vocabulary', async () => {
    const packageRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/tests$/, '');
    const sourceFiles = await collectSourceFiles(join(packageRoot, 'src'));
    const contents = await Promise.all(sourceFiles.map((file) => readFile(file, 'utf8')));
    const joined = contents.join('\n');

    expect(joined).not.toContain('child_process');
    expect(joined).not.toMatch(/\bspawn\b|\bexecFile\b|\bexecSync\b|\bexeca\b/);
    expect(joined).not.toMatch(/pullRequest|push|mergeQueue|checkRun|remoteUrl|credential/i);
  });

  it('fails closed for unknown repositories, missing refs, and unknown leases', async () => {
    const context = await makeContext();
    await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');

    const unknownRepo = await context.workspace.resolveRepository(join(context.sourceRepo, '..', 'unknown'));
    expect(unknownRepo).toMatchObject({ ok: false, error: { reason: 'repository-unknown' } });

    const missingRepoLease = await context.workspace.createLease({
      runId: 'run-missing-repo',
      taskId: 'TASK-X',
      repoId: 'missing',
    });
    expect(missingRepoLease).toMatchObject({ ok: false, error: { reason: 'repository-unknown' } });

    const missingBase = await context.workspace.createLease({
      runId: 'run-missing-ref',
      taskId: 'TASK-X',
      repoId: 'repo-a',
      baseRef: 'missing-ref',
    });
    expect(missingBase).toMatchObject({ ok: false, error: { reason: 'base-ref-unresolved' } });

    await expect(context.workspace.getLease('missing-lease')).resolves.toMatchObject({
      ok: false,
      error: { reason: 'lease-unavailable' },
    });
    await expect(context.workspace.evaluateSetup('missing-lease')).resolves.toMatchObject({
      ok: false,
      error: { reason: 'lease-unavailable' },
    });
    await expect(
      context.workspace.finalizeLease({ leaseId: 'missing-lease', evidenceId: 'e', epoch: 1, fenceToken: 't' }),
    ).resolves.toMatchObject({
      ok: false,
      error: { reason: 'lease-unavailable' },
    });
    await expect(
      context.workspace.confirmSetup({ leaseId: 'missing-lease', epoch: 1, fenceToken: 't' }),
    ).resolves.toMatchObject({
      ok: false,
      error: { reason: 'lease-unavailable' },
    });
    await expect(
      context.workspace.cleanupLease({ leaseId: 'missing-lease', epoch: 1, fenceToken: 't', deleteLocalBranch: false }),
    ).resolves.toMatchObject({
      ok: false,
      error: { reason: 'lease-unavailable' },
    });
    await expect(context.workspace.recordLocalGitEvidence('missing-lease')).resolves.toMatchObject({
      ok: false,
      error: { reason: 'local-git-evidence-unavailable' },
    });
  });

  it('covers setup freshness policies for always, fresh worktree, path sets, and artifact refs', async () => {
    const always = await makeContext({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'marker-file', path: '.ready' },
        rerunPolicy: 'always',
      },
    });
    await commitFile(always.sourceRepo, 'README.md', 'base\n', 'base commit');
    const alwaysLease = await unwrap(
      always.workspace.createLease({ runId: 'run-always', taskId: 'TASK-A', repoId: 'repo-a' }),
    );
    expect(alwaysLease.state).toBe('setup-required');
    expect(await unwrap(always.workspace.evaluateSetup(alwaysLease.leaseId))).toMatchObject({
      fresh: false,
      reason: 'new-worktree',
    });

    const pathSet = await makeContext({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'path-set', paths: ['node_modules/.ready', 'dist/index.js'] },
        rerunPolicy: 'when-stale',
      },
    });
    await commitFile(pathSet.sourceRepo, 'README.md', 'base\n', 'base commit');
    const pathLease = await unwrap(
      pathSet.workspace.createLease({ runId: 'run-paths', taskId: 'TASK-P', repoId: 'repo-a' }),
    );
    expect(await unwrap(pathSet.workspace.evaluateSetup(pathLease.leaseId))).toMatchObject({
      fresh: false,
      reason: 'paths-missing',
    });
    await mkdir(join(pathLease.worktreePath, 'node_modules'), { recursive: true });
    await writeFile(join(pathLease.worktreePath, 'node_modules/.ready'), 'ready\n');
    await mkdir(join(pathLease.worktreePath, 'dist'), { recursive: true });
    await writeFile(join(pathLease.worktreePath, 'dist/index.js'), 'ready\n');
    expect(await unwrap(pathSet.workspace.evaluateSetup(pathLease.leaseId))).toMatchObject({ fresh: true });

    const artifact = await makeContext({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'artifact-ref', refName: 'missing-artifact' },
        rerunPolicy: 'on-fresh-worktree',
      },
    });
    await commitFile(artifact.sourceRepo, 'README.md', 'base\n', 'base commit');
    const artifactLease = await unwrap(
      artifact.workspace.createLease({ runId: 'run-artifact', taskId: 'TASK-R', repoId: 'repo-a' }),
    );
    expect(await unwrap(artifact.workspace.evaluateSetup(artifactLease.leaseId))).toMatchObject({
      fresh: false,
      reason: 'new-worktree',
    });

    const staleArtifact = await makeContext({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'artifact-ref', refName: 'missing-artifact' },
        rerunPolicy: 'when-stale',
      },
    });
    await commitFile(staleArtifact.sourceRepo, 'README.md', 'base\n', 'base commit');
    const staleArtifactLease = await unwrap(
      staleArtifact.workspace.createLease({ runId: 'run-artifact-stale', taskId: 'TASK-A2', repoId: 'repo-a' }),
    );
    expect(await unwrap(staleArtifact.workspace.evaluateSetup(staleArtifactLease.leaseId))).toMatchObject({
      fresh: false,
      reason: 'artifact-stale',
    });
  });

  it('blocks cleanup when the observed head differs from finalized evidence', async () => {
    const context = await makeContext();
    await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');
    const created = await unwrap(
      context.workspace.createLease({ runId: 'run-head-mismatch', taskId: 'TASK-H', repoId: 'repo-a' }),
    );
    await commitFile(created.worktreePath, 'before.txt', 'before\n', 'before cleanup evidence');
    const evidence = await unwrap(context.workspace.recordLocalGitEvidence(created.leaseId));
    await unwrap(
      context.workspace.finalizeLease({
        leaseId: created.leaseId,
        evidenceId: evidence.evidenceId,
        epoch: created.epoch,
        fenceToken: created.fenceToken,
      }),
    );
    await commitFile(created.worktreePath, 'after.txt', 'after\n', 'after evidence');

    const cleanup = await unwrap(
      context.workspace.cleanupLease({
        leaseId: created.leaseId,
        epoch: created.epoch,
        fenceToken: created.fenceToken,
        deleteLocalBranch: true,
        expectedHeadSha: evidence.headSha,
      }),
    );

    expect(cleanup).toMatchObject({
      state: 'cleanup-blocked',
      reason: 'head-mismatch',
      operatorEscalationRequired: true,
    });
  });

  it('rejects stale setup confirmation and cleanup fences', async () => {
    const context = await makeContext();
    await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');
    const created = await unwrap(
      context.workspace.createLease({ runId: 'run-stale-ops', taskId: 'TASK-S', repoId: 'repo-a' }),
    );

    await expect(
      context.workspace.confirmSetup({
        leaseId: created.leaseId,
        epoch: created.epoch + 1,
        fenceToken: created.fenceToken,
      }),
    ).resolves.toMatchObject({ ok: false, error: { reason: 'stale-lease-fence' } });
    await expect(
      context.workspace.cleanupLease({
        leaseId: created.leaseId,
        epoch: created.epoch + 1,
        fenceToken: created.fenceToken,
        deleteLocalBranch: false,
      }),
    ).resolves.toMatchObject({ ok: false, error: { reason: 'stale-lease-fence' } });
  });

  it('fails closed when repository preparation, storage leases, checkout, or evidence persistence fail', async () => {
    const badRepoRoot = await mkdtemp(join(tmpdir(), 'fnd-03-bad-repo-'));
    tempRoots.push(badRepoRoot);
    const badRepo = await makeContext({ repoRoot: join(badRepoRoot, 'missing') });
    const badLease = await badRepo.workspace.createLease({ runId: 'run-bad-repo', taskId: 'TASK-B', repoId: 'repo-a' });
    expect(badLease).toMatchObject({ ok: false, error: { reason: 'repository-unavailable' } });

    const degraded = await makeContext({ storageProbe: () => 'network-fs-degraded' });
    await commitFile(degraded.sourceRepo, 'README.md', 'base\n', 'base commit');
    const unavailableLease = await degraded.workspace.createLease({
      runId: 'run-storage-unavailable',
      taskId: 'TASK-B',
      repoId: 'repo-a',
    });
    expect(unavailableLease).toMatchObject({ ok: false, error: { reason: 'lease-unavailable' } });

    const conflict = await makeContext();
    await commitFile(conflict.sourceRepo, 'README.md', 'base\n', 'base commit');
    await mkdir(join(conflict.worktreeRoot, 'repo-a', 'run-conflict-path'), { recursive: true });
    const pathConflict = await conflict.workspace.createLease({
      runId: 'run-conflict-path',
      taskId: 'TASK-B',
      repoId: 'repo-a',
    });
    expect(pathConflict).toMatchObject({ ok: false, error: { reason: 'worktree-path-conflict' } });

    const evidenceFailure = await makeContext({ maxArtifactBytes: 1 });
    await commitFile(evidenceFailure.sourceRepo, 'README.md', 'base\n', 'base commit');
    const created = await unwrap(
      evidenceFailure.workspace.createLease({ runId: 'run-evidence-fail', taskId: 'TASK-B', repoId: 'repo-a' }),
    );
    await commitFile(created.worktreePath, 'feature.txt', 'feature\n', 'feature');
    const evidence = await evidenceFailure.workspace.recordLocalGitEvidence(created.leaseId);
    expect(evidence).toMatchObject({ ok: false, error: { reason: 'local-git-evidence-unavailable' } });
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

const expectedBranchName = (
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

const _corruptWorkspaceLog = async (context: TestContext): Promise<void> => {
  const workspaceLogId = 'fnd-03:workspace-repository:v1';
  const logPath = join(context.storageRoot, 'logs', `${sha256(workspaceLogId)}.jsonl`);
  await mkdir(dirname(logPath), { recursive: true });
  await writeFile(logPath, '{"bad":true}\n{"still":"bad"}\n');
};

const collectSourceFiles = async (root: string): Promise<readonly string[]> => {
  const entries = await nodeFs.promises.readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
};
