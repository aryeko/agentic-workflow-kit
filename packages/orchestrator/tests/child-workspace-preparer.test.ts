import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
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

  it('blocks an unrelated repository at the expected worktree path', async () => {
    const root = repo();
    const unrelated = repo();
    const expectedPath = path.join(root, '.worktrees', 'a001-story-one');
    mkdirSync(path.dirname(expectedPath), { recursive: true });
    execFileSync('git', ['worktree', 'add', expectedPath, '-b', 'track/a001-story-one', 'main'], { cwd: unrelated });

    await expect(prepareChildWorkspace({ story, workspaceRootAbs: root, git, fallbackCwdAbs: root })).rejects.toThrow(
      'expected worktree path does not belong to the workspace repository',
    );
  });

  it('blocks an existing branch without a verified worktree', async () => {
    const root = repo();
    execFileSync('git', ['branch', 'track/a001-story-one', 'main'], { cwd: root });

    await expect(prepareChildWorkspace({ story, workspaceRootAbs: root, git, fallbackCwdAbs: root })).rejects.toThrow(
      'expected branch track/a001-story-one already exists without a verified worktree; manual recovery required',
    );
  });

  it('blocks symlinked worktree directories that can escape the workspace', async () => {
    const root = repo();
    const outside = mkdtempSync(path.join(tmpdir(), 'awk-worktree-outside-'));
    symlinkSync(outside, path.join(root, '.worktrees'));

    await expect(prepareChildWorkspace({ story, workspaceRootAbs: root, git, fallbackCwdAbs: root })).rejects.toThrow(
      'configured worktree directory must not be a symlink',
    );
  });

  it('blocks symlink ancestors before creating nested worktree directories', async () => {
    const root = repo();
    const outside = mkdtempSync(path.join(tmpdir(), 'awk-worktree-outside-'));
    symlinkSync(outside, path.join(root, 'wt'));

    await expect(
      prepareChildWorkspace({
        story,
        workspaceRootAbs: root,
        git: { ...git, worktreeDir: 'wt/nested' },
        fallbackCwdAbs: root,
      }),
    ).rejects.toThrow('configured worktree directory must not contain symlink ancestors');
    expect(existsSync(path.join(outside, 'nested'))).toBe(false);
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
