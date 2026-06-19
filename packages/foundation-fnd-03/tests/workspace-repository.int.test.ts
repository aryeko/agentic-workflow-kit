import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import * as nodeFs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import * as git from 'isomorphic-git';
import {
  createFileSystemStorageRoot,
  isStorageError,
  type StorageError,
  type StorageRoot,
  type FileSystemStorageRootOptions,
  type IdGenerator,
  type StorageClock,
  type TokenGenerator,
} from '../../foundation-fnd-02/src/index.js';
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
  it('leases an isolated branch, records clean evidence, finalizes, and writes a cleanup tombstone', async () => {
    const context = await makeContext({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'marker-file', path: '.setup-complete' },
        rerunPolicy: 'when-stale',
      },
    });
    const baseSha = await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');

    const created = await context.workspace.createLease({ runId: 'run-1', taskId: 'TASK-1', repoId: 'repo-a' });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(created.error.reason);
    }
    expect(created.value.baseSha).toBe(baseSha);
    expect(created.value.branchName).toBe(
      expectedBranchName('repo-a', 'run-1', 'TASK-1', {
        prefix: 'kit',
        includeRunId: true,
        includeTaskId: true,
        maxLength: 96,
      }),
    );
    expect(created.value.state).toBe('setup-required');
    await expect(stat(created.value.worktreePath)).resolves.toBeDefined();
    await expect(readFile(join(created.value.worktreePath, '.git'), 'utf8')).resolves.toBe(
      `gitdir: ${created.value.worktreeGitDir}\n`,
    );
    await expect(readFile(join(created.value.worktreeGitDir, 'commondir'), 'utf8')).resolves.toBe('../..\n');

    await commitFile(created.value.worktreePath, 'feature.txt', 'done\n', 'feature commit');
    const evidence = await context.workspace.recordLocalGitEvidence(created.value.leaseId);
    expect(evidence.ok).toBe(true);
    if (!evidence.ok) {
      throw new Error(evidence.error.reason);
    }
    expect(evidence.value.baseSha).toBe(baseSha);
    expect(evidence.value.mergeBaseSha).toBe(baseSha);
    expect(evidence.value.headSha).not.toBe(baseSha);
    expect(evidence.value.localCommits).toHaveLength(1);
    expect(evidence.value.diff.changedPaths).toEqual(['feature.txt']);
    expect(evidence.value.workingTree.clean).toBe(true);
    expect(evidence.value.evidenceRef?.id).toMatch(/^artifact:sha256:/u);
    expect(JSON.stringify(evidence.value)).not.toMatch(/remote|url|credential|push|pullRequest|mergeQueue|checkRun/);

    const finalized = await context.workspace.finalizeLease({
      leaseId: created.value.leaseId,
      evidenceId: evidence.value.evidenceId,
      epoch: created.value.epoch,
      fenceToken: created.value.fenceToken,
    });
    expect(finalized.ok).toBe(true);
    expect(finalized.ok && finalized.value.state).toBe('finalized');

    const cleaned = await context.workspace.cleanupLease({
      leaseId: created.value.leaseId,
      epoch: created.value.epoch,
      fenceToken: created.value.fenceToken,
      deleteLocalBranch: true,
      expectedHeadSha: evidence.value.headSha,
    });
    expect(cleaned.ok).toBe(true);
    if (!cleaned.ok) {
      throw new Error(cleaned.error.reason);
    }
    expect(cleaned.value.state).toBe('cleaned');
    await expect(stat(created.value.worktreePath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stat(created.value.worktreeGitDir)).rejects.toMatchObject({ code: 'ENOENT' });
    const tombstone = context.workspace.getCleanupTombstone(created.value.leaseId);
    expect(tombstone?.state).toBe('cleaned');
    expect(tombstone?.branchDisposition).toBe('deleted');
  });

  it('returns declared setup metadata and confirmSetup rechecks freshness after the host step', async () => {
    const context = await makeContext({
      setup: {
        command: 'pnpm install',
        workingDirectory: '.',
        freshness: { kind: 'marker-file', path: '.setup-complete', contentHash: sha256('ready\n') },
        rerunPolicy: 'when-stale',
      },
    });
    await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');
    const created = await unwrap(
      context.workspace.createLease({ runId: 'run-setup', taskId: 'TASK-2', repoId: 'repo-a' }),
    );

    const first = await unwrap(context.workspace.evaluateSetup(created.leaseId));
    expect(first.setup?.command).toBe('pnpm install');
    expect(first.fresh).toBe(false);
    expect(first.reason).toBe('marker-missing');

    await writeFile(join(created.worktreePath, '.setup-complete'), 'wrong\n');
    const stale = await unwrap(
      context.workspace.confirmSetup({
        leaseId: created.leaseId,
        epoch: created.epoch,
        fenceToken: created.fenceToken,
      }),
    );
    expect(stale.fresh).toBe(false);
    expect(stale.reason).toBe('marker-mismatch');

    await writeFile(join(created.worktreePath, '.setup-complete'), 'ready\n');
    const confirmed = await unwrap(
      context.workspace.confirmSetup({
        leaseId: created.leaseId,
        epoch: created.epoch,
        fenceToken: created.fenceToken,
      }),
    );
    expect(confirmed.fresh).toBe(true);
    expect(confirmed.reason).toBeUndefined();
    expect((await unwrap(context.workspace.getLease(created.leaseId))).state).toBe('ready');
  });

  it('records dirty and unavailable local git evidence without partial success', async () => {
    const context = await makeContext();
    await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');
    const created = await unwrap(
      context.workspace.createLease({ runId: 'run-dirty', taskId: 'TASK-3', repoId: 'repo-a' }),
    );

    await writeFile(join(created.worktreePath, 'README.md'), 'changed\n');
    await writeFile(join(created.worktreePath, 'notes.txt'), 'untracked\n');
    const dirty = await unwrap(context.workspace.recordLocalGitEvidence(created.leaseId));
    expect(dirty.workingTree.clean).toBe(false);
    expect(dirty.workingTree.unstagedPaths).toEqual(['README.md']);
    expect(dirty.workingTree.untrackedPaths).toEqual(['notes.txt']);

    await rm(join(created.worktreePath, '.git'), { recursive: true, force: true });
    const unavailable = await context.workspace.recordLocalGitEvidence(created.leaseId);
    expect(unavailable.ok).toBe(false);
    if (unavailable.ok) {
      throw new Error('expected local git evidence to fail closed');
    }
    expect(unavailable.error.reason).toBe('local-git-evidence-unavailable');
    expect(unavailable.error.partialEvidence).toBeUndefined();
  });

  it('stops local commit evidence at the merge base when the base has prior history', async () => {
    const context = await makeContext();
    await commitFile(context.sourceRepo, 'README.md', 'root\n', 'root commit');
    const baseSha = await commitFile(context.sourceRepo, 'history.md', 'base history\n', 'base history commit');
    const created = await unwrap(
      context.workspace.createLease({ runId: 'run-commit-range', taskId: 'TASK-RANGE', repoId: 'repo-a' }),
    );

    await commitFile(created.worktreePath, 'feature.txt', 'done\n', 'feature commit');
    const evidence = await unwrap(context.workspace.recordLocalGitEvidence(created.leaseId));

    expect(evidence.mergeBaseSha).toBe(baseSha);
    expect(evidence.localCommits.map((commit) => commit.subject)).toEqual(['feature commit']);
  });

  it('reports staged deletions as staged dirty paths', async () => {
    const context = await makeContext();
    await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');
    const created = await unwrap(
      context.workspace.createLease({ runId: 'run-staged-delete', taskId: 'TASK-DELETE', repoId: 'repo-a' }),
    );

    await rm(join(created.worktreePath, 'README.md'));
    await git.remove({ fs: nodeFs, dir: created.worktreePath, filepath: 'README.md' });
    const evidence = await unwrap(context.workspace.recordLocalGitEvidence(created.leaseId));

    expect(evidence.workingTree.clean).toBe(false);
    expect(evidence.workingTree.stagedPaths).toEqual(['README.md']);
    expect(evidence.workingTree.unstagedPaths).toEqual([]);
  });

  it('does not publish a memory lease when createLease event persistence fails', async () => {
    const context = await makeContext();
    await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');
    const runId = 'run-persist-fail';
    const leaseId = `workspace:repo-a:${runId}`;
    const failingWorkspace = makeWorkspaceForContext(context, storageWithFailingEventAppends(context.storage));

    const failed = await failingWorkspace.createLease({ runId, taskId: 'TASK-PERSIST', repoId: 'repo-a' });

    expect(failed.ok).toBe(false);
    if (failed.ok) {
      throw new Error('expected createLease to fail');
    }
    expect(failed.error.reason).toBe('lease-unavailable');
    const lookup = await failingWorkspace.getLease(leaseId);
    expect(lookup.ok).toBe(false);
    expect(context.storage.leases.acquire(leaseId, 'contender', 60_000)).toMatchObject({ name: leaseId, epoch: 2 });
    await expect(stat(join(context.worktreeRoot, 'repo-a', runId))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(
      stat(join(context.sourceRepo, '.git', 'worktrees', 'workspace-repo-a-run-persist-fail')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('releases the fnd-02 lease when checkout setup cannot create the worktree', async () => {
    const context = await makeContext();
    await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');
    const runId = 'run-checkout-fail';
    const leaseId = `workspace:repo-a:${runId}`;
    await mkdir(join(context.worktreeRoot, 'repo-a', runId), { recursive: true });

    const failed = await context.workspace.createLease({ runId, taskId: 'TASK-CHECKOUT', repoId: 'repo-a' });

    expect(failed.ok).toBe(false);
    if (failed.ok) {
      throw new Error('expected createLease to fail');
    }
    expect(failed.error.reason).toBe('worktree-path-conflict');
    expect(context.storage.leases.acquire(leaseId, 'contender', 60_000)).toMatchObject({ name: leaseId, epoch: 2 });
  });

  it('does not publish local git evidence in memory when evidence event persistence fails', async () => {
    const context = await makeContext();
    await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');
    const created = await unwrap(
      context.workspace.createLease({ runId: 'run-evidence-persist-fail', taskId: 'TASK-EVIDENCE', repoId: 'repo-a' }),
    );
    await commitFile(created.worktreePath, 'feature.txt', 'done\n', 'feature commit');
    const failedEvidenceIds: string[] = [];
    const failingWorkspace = makeWorkspaceForContext(
      context,
      storageWithFailingEvidenceAppends(context.storage, failedEvidenceIds),
    );

    const failedEvidence = await failingWorkspace.recordLocalGitEvidence(created.leaseId);

    expect(failedEvidence.ok).toBe(false);
    if (failedEvidence.ok) {
      throw new Error('expected evidence persistence failure');
    }
    expect(failedEvidence.error.reason).toBe('local-git-evidence-unavailable');
    expect(failedEvidenceIds).toHaveLength(1);

    const sameInstanceFinalize = await failingWorkspace.finalizeLease({
      leaseId: created.leaseId,
      evidenceId: failedEvidenceIds[0] ?? 'missing',
      epoch: created.epoch,
      fenceToken: created.fenceToken,
    });
    expect(sameInstanceFinalize.ok).toBe(false);
    if (sameInstanceFinalize.ok) {
      throw new Error('expected same-instance finalize to reject failed evidence');
    }
    expect(sameInstanceFinalize.error.reason).toBe('evidence-unknown');

    const restarted = makeWorkspaceForContext(context);
    const restartedFinalize = await restarted.finalizeLease({
      leaseId: created.leaseId,
      evidenceId: failedEvidenceIds[0] ?? 'missing',
      epoch: created.epoch,
      fenceToken: created.fenceToken,
    });
    expect(restartedFinalize.ok).toBe(false);
    if (restartedFinalize.ok) {
      throw new Error('expected restarted finalize to reject failed evidence');
    }
    expect(restartedFinalize.error.reason).toBe('evidence-unknown');
  });

  it('blocks cleanup and keeps the worktree when files changed after finalized evidence', async () => {
    const context = await makeContext();
    await commitFile(context.sourceRepo, 'README.md', 'base\n', 'base commit');
    const created = await unwrap(
      context.workspace.createLease({ runId: 'run-cleanup-dirty', taskId: 'TASK-4', repoId: 'repo-a' }),
    );
    const evidence = await unwrap(context.workspace.recordLocalGitEvidence(created.leaseId));
    await unwrap(
      context.workspace.finalizeLease({
        leaseId: created.leaseId,
        evidenceId: evidence.evidenceId,
        epoch: created.epoch,
        fenceToken: created.fenceToken,
      }),
    );

    await writeFile(join(created.worktreePath, 'late-change.txt'), 'operator needed\n');
    const cleanup = await unwrap(
      context.workspace.cleanupLease({
        leaseId: created.leaseId,
        epoch: created.epoch,
        fenceToken: created.fenceToken,
        deleteLocalBranch: false,
        expectedHeadSha: evidence.headSha,
      }),
    );

    expect(cleanup.state).toBe('cleanup-blocked');
    expect(cleanup.state === 'cleanup-blocked' && cleanup.reason).toBe('dirty-worktree');
    await expect(stat(created.worktreePath)).resolves.toBeDefined();
    expect(context.workspace.getCleanupTombstone(created.leaseId)).toBeUndefined();
  });

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

const storageWithFailingEventAppends = (storage: StorageRoot): StorageRoot => ({
  health: storage.health,
  leases: storage.leases,
  artifacts: storage.artifacts,
  eventLog: {
    openForAppend: storage.eventLog.openForAppend.bind(storage.eventLog),
    replay: storage.eventLog.replay.bind(storage.eventLog),
    append: () => storageError('forced append failure'),
  },
});

const storageWithFailingEvidenceAppends = (storage: StorageRoot, evidenceIds: string[]): StorageRoot => ({
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

const corruptWorkspaceLog = async (context: TestContext): Promise<void> => {
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
