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

function makeDeps(overrides: Partial<CompletionGateDeps> = {}): CompletionGateDeps {
  return {
    gitInspector: new FakeGitInspector(),
    statuses: { eligible: ['specced'], inProgress: 'implementing', complete: ['done', 'verified'] },
    git: {
      strategy: 'branch',
      branchPattern: '{track}/{id-lc}-{slug}',
      baseBranch: 'main',
      commitOnBase: 'forbid',
    },
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
    }
  });

  it('returns complete=false when story status is not complete', async () => {
    const gate = new CompletionGate(makeDeps());
    const result = await gate.evaluate(settled(), [story('A001', 'specced')]);
    expect(result.complete).toBe(false);
    if (!result.complete) {
      expect(result.reason).toContain('status is specced');
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
        },
      }),
    );
    const result = await gate.evaluate(settled(), [story('A001', 'done')]);
    expect(result.complete).toBe(true);
  });

  it('returns complete=false when committed on forbidden base branch', async () => {
    const baseBranchEvidence: StoryCommitEvidence = { ...goodEvidence, isBaseBranch: true };
    const gate = new CompletionGate(makeDeps({ gitInspector: new FakeGitInspector(baseBranchEvidence) }));
    const result = await gate.evaluate(settled(), [story('A001', 'done')]);
    expect(result.complete).toBe(false);
    if (!result.complete) {
      expect(result.reason).toBe('complete-on-forbidden-base');
    }
  });

  it('returns complete=true when evidence shows committed on story branch', async () => {
    const gate = new CompletionGate(makeDeps());
    const result = await gate.evaluate(settled(), [story('A001', 'done')]);
    expect(result.complete).toBe(true);
  });
});
