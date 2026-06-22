import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createArtifactId,
  type AbsolutePath,
  type GitSha,
  type LocalRef,
  type RepositoryIdentity,
  type WorktreeLease,
} from '../../../../src/index.js';
import type {
  LocalGitEvidenceArtifactRecorder,
  LocalGitEvidenceInspector,
  LocalGitEvidenceSnapshot,
  LocalGitEvidenceUnavailableReason,
} from '../../../../src/foundation/workspace-repository/evidence/index.js';

const createdRoots: string[] = [];

const sha256Hex = (content: string): string => createHash('sha256').update(content).digest('hex');

export const createTempRoot = (prefix: string): AbsolutePath => {
  const root = mkdtempSync(join(tmpdir(), prefix));
  createdRoots.push(root);
  return root as AbsolutePath;
};

export const cleanupCreatedRoots = (): void => {
  for (const root of createdRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
};

export type GitFixture = {
  readonly repository: RepositoryIdentity;
  readonly lease: WorktreeLease;
  readonly baseSha: GitSha;
  readonly headSha: GitSha;
  readonly snapshot: LocalGitEvidenceSnapshot;
};

export const createLocalGitFixture = (options?: { readonly dirty?: boolean }): GitFixture => {
  const root = createTempRoot('workflow-kit-local-git-evidence-');
  const repoRoot = join(root, 'repo');
  mkdirSync(join(repoRoot, '.git'), { recursive: true });

  const baseSha = 'abc1234abc1234abc1234abc1234abc1234abcd' as GitSha;
  const featureSha = 'bcd2345bcd2345bcd2345bcd2345bcd2345bcde' as GitSha;
  const headSha = 'cde3456cde3456cde3456cde3456cde3456cdef' as GitSha;
  const repository: RepositoryIdentity = {
    repoId: 'workflow-kit',
    repoRoot: repoRoot as AbsolutePath,
    gitDir: join(repoRoot, '.git') as AbsolutePath,
    defaultBaseRef: 'refs/heads/v-next' as LocalRef,
  };
  const lease: WorktreeLease = {
    leaseId: 'worktree:workflow-kit:evidence-run',
    epoch: 1,
    runId: 'evidence-run',
    repoId: repository.repoId,
    worktreePath: repoRoot as AbsolutePath,
    baseRef: repository.defaultBaseRef,
    baseSha,
    branchName: 'task/workflow-kit/evidence-run/fnd-03-s3',
    state: 'ready',
    fenceToken: 'lease-token-1',
  };

  return {
    repository,
    lease,
    baseSha,
    headSha,
    snapshot: {
      headSha,
      mergeBaseSha: baseSha,
      localCommits: [
        {
          sha: headSha,
          parentShas: [featureSha],
          subject: 'test: cover dirty local git evidence',
          authoredAt: '2026-06-22T09:06:00Z',
        },
        {
          sha: featureSha,
          parentShas: [baseSha],
          subject: 'feat: add local git evidence recorder',
          authoredAt: '2026-06-22T09:04:00Z',
        },
      ],
      diff: {
        fromSha: baseSha,
        toSha: headSha,
        changedPaths: [
          'packages/sdk/src/foundation/workspace-repository/evidence/index.ts',
          'packages/sdk/src/foundation/workspace-repository/evidence/notes.md',
        ],
        statContent:
          ' .../workspace-repository/evidence/index.ts | 2 +-\n .../workspace-repository/evidence/notes.md | 1 +\n 2 files changed, 2 insertions(+), 1 deletion(-)\n',
        patchContent:
          'diff --git a/packages/sdk/src/foundation/workspace-repository/evidence/index.ts b/packages/sdk/src/foundation/workspace-repository/evidence/index.ts\n+export const evidenceVersion = 2;\n',
      },
      workingTree: options?.dirty
        ? {
            stagedPaths: ['packages/sdk/src/foundation/workspace-repository/evidence/index.ts'],
            unstagedPaths: ['README.md'],
            untrackedPaths: ['packages/sdk/src/foundation/workspace-repository/evidence/untracked.txt'],
          }
        : {
            stagedPaths: [],
            unstagedPaths: [],
            untrackedPaths: [],
          },
    },
  };
};

export const createFixtureInspector = (
  fixture: GitFixture,
  options?: { readonly failReason?: LocalGitEvidenceUnavailableReason },
): LocalGitEvidenceInspector => ({
  inspect() {
    if (options?.failReason !== undefined) {
      return {
        ok: false,
        reason: options.failReason,
      } as const;
    }

    return {
      ok: true,
      value: fixture.snapshot,
    } as const;
  },
});

export const createArtifactRecorderHarness = (): {
  readonly recorder: LocalGitEvidenceArtifactRecorder;
  readonly recordedArtifacts: Array<{
    readonly kind: 'stat' | 'patch';
    readonly content: string;
    readonly refId: string;
  }>;
} => {
  const recordedArtifacts: Array<{
    readonly kind: 'stat' | 'patch';
    readonly content: string;
    readonly refId: string;
  }> = [];

  return {
    recorder: {
      record(input) {
        const refId = createArtifactId(sha256Hex(`${input.kind}:${input.content}`));
        recordedArtifacts.push({
          kind: input.kind,
          content: input.content,
          refId,
        });
        return refId;
      },
    },
    recordedArtifacts,
  };
};
