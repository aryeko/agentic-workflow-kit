import { describe, expect, it } from 'vitest';
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

class RefreshingBaseTrackerGitInspector implements GitInspector {
  calls: string[] = [];
  private refreshed = false;

  async refreshBaseBranch(): Promise<void> {
    this.calls.push('refreshBaseBranch');
    this.refreshed = true;
  }

  async readFileFromRef(): Promise<string | null> {
    this.calls.push('readFileFromRef');
    return this.refreshed ? trackerMarkdown('done') : trackerMarkdown('implementing');
  }

  async inspectStory(): Promise<StoryCommitEvidence> {
    this.calls.push('inspectStory');
    return {
      ...goodEvidence,
      branch: 'main',
      isBaseBranch: true,
      headSha: 'merge-sha',
      baseSha: 'merge-sha',
      mergedPullRequest: { number: 88, url: 'https://github.com/aryeko/pathway/pull/88', mergeCommitSha: 'merge-sha' },
    };
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

    expect(result.complete).toBe(true);
    if (result.complete) {
      expect(result.authority).toBe('merged-pr-on-base');
    }
  });

  it('refreshes origin base branch before reading base tracker authority', async () => {
    const gitInspector = new RefreshingBaseTrackerGitInspector();
    const gate = new CompletionGate(
      makeDeps({
        gitInspector,
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
        },
      }),
      [story('A001', 'implementing')],
    );

    expect(result.complete).toBe(true);
    if (result.complete) {
      expect(result.authority).toBe('merged-pr-on-base');
      expect(result.source).toBe('base-tracker');
    }
    expect(gitInspector.calls).toEqual(['refreshBaseBranch', 'readFileFromRef', 'inspectStory']);
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
