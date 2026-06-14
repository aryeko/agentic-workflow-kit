import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CollaborationEvidence, CollaborationInspector } from '../src/collaboration/CollaborationInspector.js';
import type { GitInspector, StoryCommitEvidence } from '../src/git/GitInspector.js';
import type { CompletionGateDeps } from '../src/runner/CompletionGate.js';
import { CompletionGate } from '../src/runner/CompletionGate.js';
import type { SettledStoryRun } from '../src/runner/RunJournal.js';
import type { WorkflowStory } from '../src/types.js';

function settled(overrides: Partial<SettledStoryRun> = {}): SettledStoryRun {
  return {
    storyId: 'A001',
    ok: true,
    sessionId: 'thread-a001',
    completedAt: '2026-06-02T00:00:01.000Z',
    ...overrides,
  };
}

function story(id: string, status = 'done'): WorkflowStory {
  return {
    id,
    title: id,
    status,
    owner: null,
    dependencies: [],
    eligible: true,
    blockedReason: null,
    metadata: { trackId: 't', trackTitle: 'T', trackerPath: 'docs/tracks/t/README.md', order: 1 },
  };
}

const goodEvidence: StoryCommitEvidence = {
  committed: true,
  branch: 't/a001-story',
  isBaseBranch: false,
  headSha: 'head',
  baseSha: 'base',
  uncommittedChanges: false,
};

class FakeGitInspector implements GitInspector {
  constructor(private readonly evidence: StoryCommitEvidence | Error = goodEvidence) {}

  async snapshotBaseSha(): Promise<string | null> {
    return 'base-at-launch';
  }

  async inspectStory(): Promise<StoryCommitEvidence> {
    if (this.evidence instanceof Error) throw this.evidence;
    return this.evidence;
  }
}

class FakeCollaborationInspector implements CollaborationInspector {
  mergeCalls: Array<{ method: string; deleteBranch: boolean; prNumber: number }> = [];

  constructor(
    private readonly evidence: CollaborationEvidence,
    private readonly mergedEvidence: CollaborationEvidence = evidence,
  ) {}

  async inspectPullRequest(): Promise<CollaborationEvidence> {
    return this.evidence;
  }

  async mergePullRequest(args: {
    prNumber: number;
    method: 'squash' | 'merge' | 'rebase';
    deleteBranch: boolean;
  }): Promise<CollaborationEvidence> {
    this.mergeCalls.push({ prNumber: args.prNumber, method: args.method, deleteBranch: args.deleteBranch });
    return this.mergedEvidence;
  }
}

function verifiedCollaborationEvidence(overrides: Partial<CollaborationEvidence> = {}): CollaborationEvidence {
  return {
    available: true,
    source: 'github',
    verified: true,
    pr: {
      number: 88,
      url: 'https://github.com/aryeko/pathway/pull/88',
      state: 'merged',
      headSha: 'head-sha',
      mergeCommitSha: 'merge-sha',
      mergedAt: '2026-06-14T05:30:00Z',
    },
    checks: [{ command: 'gh pr checks', status: 'passed', conclusion: 'success' }],
    review: { reviewer: 'codex', signal: 'approved', mechanism: 'reaction' },
    branch: { name: 't/a001-story', exists: false },
    ...overrides,
  };
}

class RefreshingBaseTrackerGitInspector implements GitInspector {
  calls: string[] = [];
  private refreshed = false;

  constructor(private readonly storyEvidence: StoryCommitEvidence | null = null) {}

  async refreshBaseBranch(): Promise<void> {
    this.calls.push('refreshBaseBranch');
    this.refreshed = true;
  }

  async readFileFromRef(): Promise<string | null> {
    this.calls.push('readFileFromRef');
    return this.refreshed ? trackerMarkdown('done') : trackerMarkdown('implementing');
  }

  async isCommitReachableFromRef(): Promise<boolean> {
    this.calls.push('isCommitReachableFromRef');
    return this.refreshed;
  }

  async inspectStory(): Promise<StoryCommitEvidence> {
    this.calls.push('inspectStory');
    if (this.storyEvidence) return this.storyEvidence;
    throw new Error('stale local checkout should not be inspected for refreshed base tracker authority');
  }
}

function trackerMarkdown(status: string): string {
  return `---
title: T
status: approved
owner: —
---

## Status matrix

| ID | Name | Depends on | Wave | Status | Spec | Plan | Owner | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A001 | Story | — | 1 | ${status} | [spec](../../specs/a001.md) | — | — | [PR #88](https://github.com/aryeko/pathway/pull/88) |
`;
}

async function writeChildTracker(status: string): Promise<string> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'awk-child-tracker-'));
  const trackerPath = path.join(cwd, 'docs/tracks/t/README.md');
  await mkdir(path.dirname(trackerPath), { recursive: true });
  await writeFile(trackerPath, trackerMarkdown(status));
  return cwd;
}

function makeDeps(overrides: Partial<CompletionGateDeps> = {}): CompletionGateDeps {
  return {
    gitInspector: new FakeGitInspector(),
    statuses: { eligible: ['specced'], inProgress: 'implementing', complete: ['done', 'verified'] },
    git: {
      strategy: 'branch',
      branchPattern: '{track}/{id-lc}-{slug}',
      baseBranch: 'main',
      commitOnBase: 'forbid',
      worktreeDir: '.worktrees',
    },
    pr: {
      create: true,
      ci: { wait: false, command: null },
      review: {
        wait: 'none',
        bot: 'none',
        triageComments: false,
        maxFixBatches: 1,
        rerequestAfterFix: false,
        waitTimeoutMinutes: 30,
      },
      merge: { auto: false, method: 'squash', deleteBranch: true },
    },
    tracker: { idPattern: '^[A-Z]+[0-9]+$' },
    childCwdAbs: '/repo',
    ...overrides,
  };
}

describe('CompletionGate', () => {
  it('returns complete=false when story is missing from source', async () => {
    const gate = new CompletionGate(makeDeps());
    const result = await gate.evaluate(settled(), []);
    expect(result.complete).toBe(false);
    if (!result.complete) {
      expect(result.reason).toContain('story source no longer contains it');
      expect(result.authority).toBe('story-missing');
    }
  });

  it('returns complete=false when story status is not complete', async () => {
    const gate = new CompletionGate(makeDeps());
    const result = await gate.evaluate(settled(), [story('A001', 'specced')]);
    expect(result.complete).toBe(false);
    if (!result.complete) {
      expect(result.reason).toContain('status is specced');
      expect(result.authority).toBe('tracker-status-not-complete');
    }
  });

  it('returns complete=false when gitInspector.inspectStory throws', async () => {
    const gate = new CompletionGate(makeDeps({ gitInspector: new FakeGitInspector(new Error('git-fail')) }));
    const result = await gate.evaluate(settled(), [story('A001', 'done')]);
    expect(result.complete).toBe(false);
    if (!result.complete) {
      expect(result.reason).toBe('inspect-failed: git-fail');
    }
  });

  it('returns complete=false when uncommitted changes in branch strategy', async () => {
    const dirtyEvidence: StoryCommitEvidence = { ...goodEvidence, uncommittedChanges: true };
    const gate = new CompletionGate(makeDeps({ gitInspector: new FakeGitInspector(dirtyEvidence) }));
    const result = await gate.evaluate(settled(), [story('A001', 'done')]);
    expect(result.complete).toBe(false);
    if (!result.complete) {
      expect(result.reason).toBe('complete-but-uncommitted');
    }
  });

  it('tolerates uncommitted changes in worktree strategy', async () => {
    const dirtyEvidence: StoryCommitEvidence = { ...goodEvidence, uncommittedChanges: true };
    const gate = new CompletionGate(
      makeDeps({
        gitInspector: new FakeGitInspector(dirtyEvidence),
        git: {
          strategy: 'worktree',
          branchPattern: '{track}/{id-lc}-{slug}',
          baseBranch: 'main',
          commitOnBase: 'forbid',
          worktreeDir: '.worktrees',
        },
      }),
    );
    const result = await gate.evaluate(settled(), [story('A001', 'done')]);
    expect(result.complete).toBe(true);
    if (result.complete) {
      expect(result.authority).toBe('tracker-complete-story-branch');
    }
  });

  it('returns complete=false when committed on forbidden base branch', async () => {
    const baseBranchEvidence: StoryCommitEvidence = { ...goodEvidence, isBaseBranch: true };
    const gate = new CompletionGate(makeDeps({ gitInspector: new FakeGitInspector(baseBranchEvidence) }));
    const result = await gate.evaluate(settled(), [story('A001', 'done')]);
    expect(result.complete).toBe(false);
    if (!result.complete) {
      expect(result.reason).toBe('complete-on-forbidden-base');
      expect(result.authority).toBe('forbidden-direct-base-commit');
    }
  });

  it('returns complete=true when auto-merge evidence is already on the base branch', async () => {
    const mergedEvidence: StoryCommitEvidence = {
      ...goodEvidence,
      branch: 'main',
      isBaseBranch: true,
      headSha: 'merge-sha',
      baseSha: 'merge-sha',
      mergedPullRequest: { number: 88, url: 'https://github.com/aryeko/pathway/pull/88', mergeCommitSha: 'merge-sha' },
    };
    const gate = new CompletionGate(
      makeDeps({
        gitInspector: new FakeGitInspector(mergedEvidence),
        collaborationInspector: new FakeCollaborationInspector(verifiedCollaborationEvidence()),
        pr: {
          create: true,
          ci: { wait: false, command: null },
          review: {
            wait: 'bot',
            bot: 'codex',
            triageComments: true,
            maxFixBatches: 1,
            rerequestAfterFix: false,
            waitTimeoutMinutes: 30,
          },
          merge: { auto: true, method: 'squash', deleteBranch: true },
        },
      }),
    );

    const result = await gate.evaluate(
      settled({ evidence: { prNumber: 88, prUrl: 'https://github.com/aryeko/pathway/pull/88' } }),
      [story('A001', 'done')],
    );

    expect(result.complete).toBe(true);
    if (result.complete) {
      expect(result.authority).toBe('verified-merged-pr-on-base');
    }
  });

  it('uses refreshed base ref merge evidence when local story branch is gone', async () => {
    const gitInspector = new RefreshingBaseTrackerGitInspector();
    const gate = new CompletionGate(
      makeDeps({
        gitInspector,
        collaborationInspector: new FakeCollaborationInspector(verifiedCollaborationEvidence()),
        pr: {
          create: true,
          ci: { wait: false, command: null },
          review: {
            wait: 'bot',
            bot: 'codex',
            triageComments: true,
            maxFixBatches: 1,
            rerequestAfterFix: false,
            waitTimeoutMinutes: 30,
          },
          merge: { auto: true, method: 'squash', deleteBranch: true },
        },
      }),
    );

    const result = await gate.evaluate(
      settled({
        evidence: {
          trackerPath: 'docs/tracks/t/README.md',
          merged: true,
          mergeCommit: 'merge-sha',
          prNumber: 88,
          prUrl: 'https://github.com/aryeko/pathway/pull/88',
        },
      }),
      [story('A001', 'implementing')],
    );

    expect(result.complete).toBe(true);
    if (result.complete) {
      expect(result.authority).toBe('verified-merged-pr-on-base');
      expect(result.source).toBe('base-tracker');
      expect(result.commitEvidence).toMatchObject({
        branch: 'origin/main',
        headSha: 'merge-sha',
        baseSha: 'merge-sha',
        mergedPullRequest: {
          number: 88,
          url: 'https://github.com/aryeko/pathway/pull/88',
          mergeCommitSha: 'merge-sha',
        },
      });
    }
    expect(gitInspector.calls).toEqual(['refreshBaseBranch', 'readFileFromRef', 'isCommitReachableFromRef']);
  });

  it('fails closed when auto-merge evidence is only child-reported', async () => {
    const gitInspector = new RefreshingBaseTrackerGitInspector({ ...goodEvidence, headSha: 'head' });
    const gate = new CompletionGate(
      makeDeps({
        gitInspector,
        pr: {
          create: true,
          ci: { wait: true, command: 'gh pr checks --watch --fail-fast' },
          review: {
            wait: 'bot',
            bot: 'codex',
            triageComments: true,
            maxFixBatches: 1,
            rerequestAfterFix: false,
            waitTimeoutMinutes: 30,
          },
          merge: { auto: true, method: 'squash', deleteBranch: true },
        },
      }),
    );

    const result = await gate.evaluate(
      settled({
        evidence: {
          trackerPath: 'docs/tracks/t/README.md',
          merged: true,
          mergeCommit: 'merge-sha',
          prNumber: 88,
          prUrl: 'https://github.com/aryeko/pathway/pull/88',
          github: {
            checks: [{ command: 'gh pr checks', status: 'passed' }],
            review: { reviewer: 'codex', signal: 'approved', mechanism: 'reaction' },
            merge: { merged: true, commit: 'merge-sha', branchDeleted: true },
          },
        },
      }),
      [story('A001', 'implementing')],
    );

    expect(result.complete).toBe(false);
    if (!result.complete) {
      expect(result.authority).toBe('github-verification-unavailable');
      expect(result.reason).toBe('github-verification-unavailable: collaboration inspector is not configured');
    }
  });

  it('accepts auto-merge only when GitHub verification and git ancestry agree', async () => {
    const gitInspector = new RefreshingBaseTrackerGitInspector();
    const gate = new CompletionGate(
      makeDeps({
        gitInspector,
        collaborationInspector: new FakeCollaborationInspector({
          available: true,
          source: 'github',
          verified: true,
          pr: {
            number: 88,
            url: 'https://github.com/aryeko/pathway/pull/88',
            state: 'merged',
            headSha: 'head-sha',
            mergeCommitSha: 'merge-sha',
            mergedAt: '2026-06-14T05:30:00Z',
          },
          checks: [{ command: 'gh pr checks', status: 'passed', conclusion: 'success' }],
          review: { reviewer: 'codex', signal: 'approved', mechanism: 'reaction' },
          branch: { name: 't/a001-story', exists: false },
        }),
        pr: {
          create: true,
          ci: { wait: true, command: 'gh pr checks --watch --fail-fast' },
          review: {
            wait: 'bot',
            bot: 'codex',
            triageComments: true,
            maxFixBatches: 1,
            rerequestAfterFix: false,
            waitTimeoutMinutes: 30,
          },
          merge: { auto: true, method: 'squash', deleteBranch: true },
        },
      }),
    );

    const result = await gate.evaluate(
      settled({
        evidence: {
          trackerPath: 'docs/tracks/t/README.md',
          prNumber: 88,
          prUrl: 'https://github.com/aryeko/pathway/pull/88',
        },
      }),
      [story('A001', 'implementing')],
    );

    expect(result.complete).toBe(true);
    if (result.complete) {
      expect(result.authority).toBe('verified-merged-pr-on-base');
      expect(result.collaborationEvidence?.verified).toBe(true);
    }
  });

  it('performs parent-side merge for verified ready open PRs before accepting completion', async () => {
    const childCwd = await writeChildTracker('done');
    const gitInspector = new RefreshingBaseTrackerGitInspector({ ...goodEvidence, headSha: 'head' });
    const collaborationInspector = new FakeCollaborationInspector(
      verifiedCollaborationEvidence({
        pr: {
          number: 88,
          url: 'https://github.com/aryeko/pathway/pull/88',
          state: 'open',
          headSha: 'head',
          mergeCommitSha: null,
          mergedAt: null,
        },
        branch: { name: 't/a001-story', exists: true },
      }),
      verifiedCollaborationEvidence(),
    );
    const gate = new CompletionGate(
      makeDeps({
        childCwdAbs: childCwd,
        gitInspector,
        collaborationInspector,
        pr: {
          create: true,
          ci: { wait: true, command: 'gh pr checks --watch --fail-fast' },
          review: {
            wait: 'bot',
            bot: 'codex',
            triageComments: true,
            maxFixBatches: 1,
            rerequestAfterFix: false,
            waitTimeoutMinutes: 30,
          },
          merge: { auto: true, method: 'squash', deleteBranch: true },
        },
      }),
    );

    const result = await gate.evaluate(
      settled({
        invocation: { cwd: childCwd },
        evidence: {
          trackerPath: 'docs/tracks/t/README.md',
          prNumber: 88,
          prUrl: 'https://github.com/aryeko/pathway/pull/88',
        },
      }),
      [story('A001', 'implementing')],
    );

    expect(result.complete).toBe(true);
    expect(collaborationInspector.mergeCalls).toEqual([{ prNumber: 88, method: 'squash', deleteBranch: true }]);
  });

  it('fails closed when verified PR head differs from inspected story branch head before parent merge', async () => {
    const childCwd = await writeChildTracker('done');
    const collaborationInspector = new FakeCollaborationInspector(
      verifiedCollaborationEvidence({
        pr: {
          number: 88,
          url: 'https://github.com/aryeko/pathway/pull/88',
          state: 'open',
          headSha: 'remote-head',
          mergeCommitSha: null,
          mergedAt: null,
        },
        branch: { name: 't/a001-story', exists: true },
      }),
      verifiedCollaborationEvidence(),
    );
    const gate = new CompletionGate(
      makeDeps({
        childCwdAbs: childCwd,
        gitInspector: new FakeGitInspector({ ...goodEvidence, headSha: 'local-head' }),
        collaborationInspector,
        pr: {
          create: true,
          ci: { wait: true, command: 'gh pr checks --watch --fail-fast' },
          review: {
            wait: 'bot',
            bot: 'codex',
            triageComments: true,
            maxFixBatches: 1,
            rerequestAfterFix: false,
            waitTimeoutMinutes: 30,
          },
          merge: { auto: true, method: 'squash', deleteBranch: true },
        },
      }),
    );

    const result = await gate.evaluate(
      settled({
        invocation: { cwd: childCwd },
        evidence: {
          trackerPath: 'docs/tracks/t/README.md',
          prNumber: 88,
          prUrl: 'https://github.com/aryeko/pathway/pull/88',
        },
      }),
      [story('A001', 'implementing')],
    );

    expect(result.complete).toBe(false);
    if (!result.complete) {
      expect(result.authority).toBe('github-verification-incomplete');
      expect(result.reason).toBe('github-verification-incomplete: pull request head does not match inspected branch');
    }
    expect(collaborationInspector.mergeCalls).toEqual([]);
  });

  it('uses nested GitHub merge commit evidence for refreshed base tracker authority', async () => {
    const gitInspector = new RefreshingBaseTrackerGitInspector();
    const gate = new CompletionGate(
      makeDeps({
        gitInspector,
        collaborationInspector: new FakeCollaborationInspector(verifiedCollaborationEvidence()),
        pr: {
          create: true,
          ci: { wait: false, command: null },
          review: {
            wait: 'bot',
            bot: 'codex',
            triageComments: true,
            maxFixBatches: 1,
            rerequestAfterFix: false,
            waitTimeoutMinutes: 30,
          },
          merge: { auto: true, method: 'squash', deleteBranch: true },
        },
      }),
    );

    const result = await gate.evaluate(
      settled({
        evidence: {
          trackerPath: 'docs/tracks/t/README.md',
          prNumber: 88,
          prUrl: 'https://github.com/aryeko/pathway/pull/88',
          github: {
            merge: { merged: true, commit: 'merge-sha', branchDeleted: true },
          },
        },
      }),
      [story('A001', 'implementing')],
    );

    expect(result.complete).toBe(true);
    if (result.complete) {
      expect(result.authority).toBe('verified-merged-pr-on-base');
      expect(result.commitEvidence?.mergedPullRequest?.mergeCommitSha).toBe('merge-sha');
    }
  });

  it('uses child worktree tracker completion but blocks when auto-merge policy evidence is incomplete', async () => {
    const childCwd = await writeChildTracker('done');
    const gate = new CompletionGate(
      makeDeps({
        childCwdAbs: childCwd,
        pr: {
          create: true,
          ci: { wait: false, command: null },
          review: {
            wait: 'bot',
            bot: 'codex',
            triageComments: true,
            maxFixBatches: 1,
            rerequestAfterFix: false,
            waitTimeoutMinutes: 30,
          },
          merge: { auto: true, method: 'squash', deleteBranch: true },
        },
      }),
    );

    const result = await gate.evaluate(
      settled({
        invocation: { cwd: childCwd },
        evidence: { trackerPath: 'docs/tracks/t/README.md', prNumber: 88 },
      }),
      [story('A001', 'implementing')],
    );

    expect(result.complete).toBe(false);
    if (!result.complete) {
      expect(result.authority).toBe('github-verification-unavailable');
      expect(result.source).toBe('child-worktree-tracker');
      expect(result.reason).toBe('github-verification-unavailable: collaboration inspector is not configured');
    }
  });

  it('can complete from child worktree tracker when PR auto-merge is not required', async () => {
    const childCwd = await writeChildTracker('done');
    const gate = new CompletionGate(makeDeps({ childCwdAbs: childCwd }));

    const result = await gate.evaluate(
      settled({
        invocation: { cwd: childCwd },
        evidence: { trackerPath: 'docs/tracks/t/README.md', prNumber: 88 },
      }),
      [story('A001', 'implementing')],
    );

    expect(result.complete).toBe(true);
    if (result.complete) {
      expect(result.authority).toBe('tracker-complete-story-branch');
      expect(result.source).toBe('child-worktree-tracker');
    }
  });

  it('does not let child evidence redirect child-worktree tracker authority away from the canonical path', async () => {
    const childCwd = await writeChildTracker('implementing');
    const alternateTrackerPath = path.join(childCwd, 'docs/tracks/other/README.md');
    await mkdir(path.dirname(alternateTrackerPath), { recursive: true });
    await writeFile(alternateTrackerPath, trackerMarkdown('done'));
    const gate = new CompletionGate(makeDeps({ childCwdAbs: childCwd }));

    const result = await gate.evaluate(
      settled({
        invocation: { cwd: childCwd },
        evidence: { trackerPath: 'docs/tracks/other/README.md', finalStatus: 'done' },
      }),
      [story('A001', 'implementing')],
    );

    expect(result.complete).toBe(false);
    if (!result.complete) {
      expect(result.authority).toBe('tracker-status-not-complete');
      expect(result.source).toBe('returned-tracker');
    }
  });

  it('returns complete=false for direct base branch commits even when auto-merge is enabled', async () => {
    const directBaseEvidence: StoryCommitEvidence = {
      ...goodEvidence,
      branch: 'main',
      isBaseBranch: true,
      headSha: 'direct-main-sha',
      baseSha: 'direct-main-sha',
      mergedPullRequest: null,
    };
    const gate = new CompletionGate(
      makeDeps({
        gitInspector: new FakeGitInspector(directBaseEvidence),
        pr: {
          create: true,
          ci: { wait: false, command: null },
          review: {
            wait: 'bot',
            bot: 'codex',
            triageComments: true,
            maxFixBatches: 1,
            rerequestAfterFix: false,
            waitTimeoutMinutes: 30,
          },
          merge: { auto: true, method: 'squash', deleteBranch: true },
        },
      }),
    );

    const result = await gate.evaluate(settled(), [story('A001', 'done')]);

    expect(result.complete).toBe(false);
    if (!result.complete) {
      expect(result.reason).toBe('complete-on-forbidden-base');
      expect(result.authority).toBe('forbidden-direct-base-commit');
    }
  });

  it('returns complete=true when evidence shows committed on story branch', async () => {
    const gate = new CompletionGate(makeDeps());
    const result = await gate.evaluate(settled(), [story('A001', 'done')]);
    expect(result.complete).toBe(true);
    if (result.complete) {
      expect(result.authority).toBe('tracker-complete-story-branch');
    }
  });
});
