import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareChildWorkspace } from '../src/runner/ChildWorkspacePreparer';
import type { ResolvedGitConfig, WorkflowStory } from '../src/types';

const git: ResolvedGitConfig = {
  strategy: 'worktree',
  branchPattern: '{track}/{id-lc}-{slug}',
  baseBranch: 'main',
  commitOnBase: 'forbid',
  worktreeDir: '.worktrees',
};

const story: WorkflowStory = {
  id: 'A001',
  title: 'Story One',
  status: 'specced',
  owner: null,
  dependencies: [],
  eligible: true,
  blockedReason: null,
  metadata: { trackId: 'track', trackTitle: 'Track', trackerPath: 'docs/tracks/track/README.md', order: 1 },
};

function repo(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'awk-worktree-'));
  execFileSync('git', ['init', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: root });
  writeFileSync(path.join(root, 'README.md'), 'root\n');
  execFileSync('git', ['add', 'README.md'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root });
  return root;
}

describe('prepareChildWorkspace', () => {
  it('creates the expected repo-local worktree', async () => {
    const root = repo();

    const prepared = await prepareChildWorkspace({ story, workspaceRootAbs: root, git, fallbackCwdAbs: root });

    expect(prepared).toMatchObject({
      childCwdAbs: path.join(root, '.worktrees', 'a001-story-one'),
      expectedBranch: 'track/a001-story-one',
      expectedWorktreePath: path.join(root, '.worktrees', 'a001-story-one'),
      prepared: true,
    });
    expect(existsSync(prepared.childCwdAbs)).toBe(true);
    expect(
      execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: prepared.childCwdAbs,
        encoding: 'utf8',
      }).trim(),
    ).toBe('track/a001-story-one');
  });

  it('blocks an existing non-worktree path', async () => {
    const root = repo();
    mkdirSync(path.join(root, '.worktrees', 'a001-story-one'), { recursive: true });

    await expect(prepareChildWorkspace({ story, workspaceRootAbs: root, git, fallbackCwdAbs: root })).rejects.toThrow(
      'expected worktree path exists but is not a git worktree',
    );
  });

  it('leaves branch strategy on fallback cwd', async () => {
    const root = repo();
    const prepared = await prepareChildWorkspace({
      story,
      workspaceRootAbs: root,
      fallbackCwdAbs: root,
      git: { ...git, strategy: 'branch' },
    });

    expect(prepared).toEqual({
      childCwdAbs: root,
      expectedBranch: 'track/a001-story-one',
      expectedWorktreePath: null,
      prepared: false,
    });
  });
});
