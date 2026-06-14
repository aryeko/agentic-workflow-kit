import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RealGitInspector } from '../src/git/GitInspector';
import type { ResolvedGitConfig, WorkflowStory } from '../src/types';

const gitPolicy: ResolvedGitConfig = {
  strategy: 'worktree',
  branchPattern: '{track}/{id-lc}-{slug}',
  baseBranch: 'main',
  commitOnBase: 'forbid',
  worktreeDir: '.worktrees',
};

function story(id = 'WK001'): WorkflowStory {
  return {
    id,
    title: 'Story title',
    status: 'done',
    owner: null,
    dependencies: [],
    eligible: true,
    blockedReason: null,
    metadata: { trackId: 'sample', trackTitle: 'Sample', trackerPath: 'docs/tracks/sample/README.md', order: 1 },
  };
}

function storyWithPr(pr: string): WorkflowStory {
  return {
    ...story(),
    metadata: { ...story().metadata, pr },
  };
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function repo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'wk-git-inspector-'));
  git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Workflow Kit Test']);
  writeFileSync(path.join(dir, 'README.md'), 'initial\n');
  git(dir, ['add', 'README.md']);
  git(dir, ['commit', '-m', 'initial']);
  return dir;
}

function repoWithOrigin(): { cwd: string; origin: string } {
  const cwd = repo();
  const origin = mkdtempSync(path.join(tmpdir(), 'wk-git-origin-'));
  git(origin, ['init', '--bare']);
  git(cwd, ['remote', 'add', 'origin', origin]);
  git(cwd, ['push', '-u', 'origin', 'main']);
  git(origin, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
  return { cwd, origin };
}

describe('RealGitInspector', () => {
  it('does not treat an unchanged clean base checkout as committed work', async () => {
    const cwd = repo();
    const baseShaAtLaunch = git(cwd, ['rev-parse', 'main']);

    const evidence = await new RealGitInspector().inspectStory({
      story: story(),
      git: gitPolicy,
      cwdAbs: cwd,
      baseShaAtLaunch,
    });

    expect(evidence).toMatchObject({
      committed: false,
      branch: 'main',
      isBaseBranch: true,
      uncommittedChanges: false,
    });
  });

  it('detects a story commit on a matching branch', async () => {
    const cwd = repo();
    const baseShaAtLaunch = git(cwd, ['rev-parse', 'main']);
    git(cwd, ['checkout', '-b', 'sample/wk001-story-title']);
    writeFileSync(path.join(cwd, 'story.txt'), 'done\n');
    git(cwd, ['add', 'story.txt']);
    git(cwd, ['commit', '-m', 'story commit']);

    const evidence = await new RealGitInspector().inspectStory({
      story: story(),
      git: gitPolicy,
      cwdAbs: cwd,
      baseShaAtLaunch,
    });

    expect(evidence).toMatchObject({
      committed: true,
      branch: 'sample/wk001-story-title',
      isBaseBranch: false,
      uncommittedChanges: false,
    });
    expect(evidence.headSha).not.toBe(evidence.baseSha);
  });

  it('detects an isolated worktree commit while the inspected root stays on base', async () => {
    const cwd = repo();
    const baseShaAtLaunch = git(cwd, ['rev-parse', 'main']);
    // The child commits on a sibling worktree's story branch; the inspected root checkout (cwd) stays
    // on `main`, which is what the orchestrator passes for git.strategy: worktree.
    const childDir = `${cwd}-child`;
    git(cwd, ['worktree', 'add', childDir, '-b', 'sample/wk001-story-title']);
    writeFileSync(path.join(childDir, 'story.txt'), 'done\n');
    git(childDir, ['add', 'story.txt']);
    git(childDir, ['commit', '-m', 'story commit']);

    expect(git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('main');

    const evidence = await new RealGitInspector().inspectStory({
      story: story(),
      git: gitPolicy,
      cwdAbs: cwd,
      baseShaAtLaunch,
    });

    expect(evidence).toMatchObject({
      committed: true,
      branch: 'sample/wk001-story-title',
      isBaseBranch: false,
      uncommittedChanges: false,
    });
    expect(evidence.headSha).not.toBe(evidence.baseSha);
  });

  it('detects a base-branch commit for the current checkout', async () => {
    const cwd = repo();
    const baseShaAtLaunch = git(cwd, ['rev-parse', 'main']);
    writeFileSync(path.join(cwd, 'base.txt'), 'base work\n');
    git(cwd, ['add', 'base.txt']);
    git(cwd, ['commit', '-m', 'base story commit']);

    const evidence = await new RealGitInspector().inspectStory({
      story: story(),
      git: gitPolicy,
      cwdAbs: cwd,
      baseShaAtLaunch,
    });

    expect(evidence).toMatchObject({
      committed: true,
      branch: 'main',
      isBaseBranch: true,
      uncommittedChanges: false,
    });
  });

  it('detects merged PR evidence from the tracker PR link and base commit message', async () => {
    const cwd = repo();
    const baseShaAtLaunch = git(cwd, ['rev-parse', 'main']);
    writeFileSync(path.join(cwd, 'merged.txt'), 'merged work\n');
    git(cwd, ['add', 'merged.txt']);
    git(cwd, ['commit', '-m', 'Close out workflow story (#88)']);

    const evidence = await new RealGitInspector().inspectStory({
      story: storyWithPr('[#88](https://github.com/aryeko/pathway/pull/88)'),
      git: gitPolicy,
      cwdAbs: cwd,
      baseShaAtLaunch,
    });

    expect(evidence).toMatchObject({
      committed: true,
      branch: 'main',
      isBaseBranch: true,
      mergedPullRequest: {
        number: 88,
        url: 'https://github.com/aryeko/pathway/pull/88',
        mergeCommitSha: evidence.headSha,
      },
    });
  });

  it('does not treat a direct base branch commit as merged PR evidence', async () => {
    const cwd = repo();
    const baseShaAtLaunch = git(cwd, ['rev-parse', 'main']);
    writeFileSync(path.join(cwd, 'direct.txt'), 'direct work\n');
    git(cwd, ['add', 'direct.txt']);
    git(cwd, ['commit', '-m', 'Direct story commit']);

    const evidence = await new RealGitInspector().inspectStory({
      story: storyWithPr('[#88](https://github.com/aryeko/pathway/pull/88)'),
      git: gitPolicy,
      cwdAbs: cwd,
      baseShaAtLaunch,
    });

    expect(evidence).toMatchObject({
      committed: true,
      branch: 'main',
      isBaseBranch: true,
      mergedPullRequest: null,
    });
  });

  it('detects dirty checkout state', async () => {
    const cwd = repo();
    writeFileSync(path.join(cwd, 'dirty.txt'), 'uncommitted\n');

    const evidence = await new RealGitInspector().inspectStory({ story: story(), git: gitPolicy, cwdAbs: cwd });

    expect(evidence.committed).toBe(false);
    expect(evidence.uncommittedChanges).toBe(true);
  });

  it('ignores workflow-kit run artifacts when checking dirty state', async () => {
    const cwd = repo();
    const runDir = path.join(cwd, '.codex/agentic-workflow-kit/runs/run-1');
    mkdirSync(runDir, { recursive: true });
    writeFileSync(path.join(runDir, 'state.json'), '{"status":"running"}\n');

    const evidence = await new RealGitInspector().inspectStory({ story: story(), git: gitPolicy, cwdAbs: cwd });

    expect(evidence.committed).toBe(false);
    expect(evidence.uncommittedChanges).toBe(false);
  });

  it('picks the lexically-first branch when multiple branches match the story slug glob', async () => {
    const cwd = repo();
    const baseShaAtLaunch = git(cwd, ['rev-parse', 'main']);
    // Create two branches matching the pattern for WK001 (simulating a retry scenario)
    git(cwd, ['checkout', '-b', 'sample/wk001-retry']);
    writeFileSync(path.join(cwd, 'story-retry.txt'), 'retry\n');
    git(cwd, ['add', 'story-retry.txt']);
    git(cwd, ['commit', '-m', 'retry commit']);

    git(cwd, ['checkout', 'main']);
    git(cwd, ['checkout', '-b', 'sample/wk001-first-attempt']);
    writeFileSync(path.join(cwd, 'story-first.txt'), 'first\n');
    git(cwd, ['add', 'story-first.txt']);
    git(cwd, ['commit', '-m', 'first attempt commit']);

    const evidence = await new RealGitInspector().inspectStory({
      story: story(),
      git: gitPolicy,
      cwdAbs: cwd,
      baseShaAtLaunch,
    });

    // Lexically first: 'sample/wk001-first-attempt' < 'sample/wk001-retry'
    expect(evidence.branch).toBe('sample/wk001-first-attempt');
    expect(evidence.committed).toBe(true);
  });

  it('refreshes the base branch from origin before reading files from the remote ref', async () => {
    const { cwd, origin } = repoWithOrigin();
    const other = mkdtempSync(path.join(tmpdir(), 'wk-git-other-'));
    git(other, ['clone', '--branch', 'main', origin, '.']);
    git(other, ['config', 'user.email', 'test@example.com']);
    git(other, ['config', 'user.name', 'Workflow Kit Test']);
    writeFileSync(path.join(other, 'remote-only.txt'), 'from origin\n');
    git(other, ['add', 'remote-only.txt']);
    git(other, ['commit', '-m', 'remote update']);
    git(other, ['push', 'origin', 'main']);

    const inspector = new RealGitInspector();
    await inspector.refreshBaseBranch({ git: gitPolicy, cwdAbs: cwd });

    await expect(
      inspector.readFileFromRef({ cwdAbs: cwd, ref: 'origin/main', filePath: 'remote-only.txt' }),
    ).resolves.toBe('from origin');
  });

  it('checks whether a commit is reachable from a ref', async () => {
    const cwd = repo();
    const baseSha = git(cwd, ['rev-parse', 'main']);
    git(cwd, ['checkout', '-b', 'sample/wk001-story-title']);
    writeFileSync(path.join(cwd, 'story.txt'), 'done\n');
    git(cwd, ['add', 'story.txt']);
    git(cwd, ['commit', '-m', 'story commit']);
    const storySha = git(cwd, ['rev-parse', 'HEAD']);

    const inspector = new RealGitInspector();

    await expect(inspector.isCommitReachableFromRef({ cwdAbs: cwd, commit: baseSha, ref: 'HEAD' })).resolves.toBe(true);
    await expect(inspector.isCommitReachableFromRef({ cwdAbs: cwd, commit: storySha, ref: 'main' })).resolves.toBe(
      false,
    );
  });
});
