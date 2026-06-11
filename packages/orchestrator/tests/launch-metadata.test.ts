import { describe, expect, it } from 'vitest';

import {
  buildLaunchId,
  hashPrompt,
  renderExpectedBranch,
  renderExpectedWorktreePath,
} from '../src/runner/launchMetadata.js';
import type { ResolvedGitConfig, WorkflowStory } from '../src/types.js';

const git: ResolvedGitConfig = {
  strategy: 'worktree',
  branchPattern: '{track}/{id-lc}-{slug}',
  baseBranch: 'main',
  commitOnBase: 'forbid',
  worktreeDir: '.worktrees',
};

function story(overrides: Partial<WorkflowStory> = {}): WorkflowStory {
  return {
    id: 'A001',
    title: 'Add Launch Metadata',
    status: 'specced',
    owner: null,
    dependencies: [],
    eligible: true,
    blockedReason: null,
    metadata: {
      trackId: 'track-one',
      trackTitle: 'Track One',
      trackerPath: 'docs/tracks/track-one/README.md',
      order: 1,
    },
    ...overrides,
  };
}

describe('launch metadata helpers', () => {
  it('renders expected branch names with concrete slugs', () => {
    expect(renderExpectedBranch(story(), git)).toBe('track-one/a001-add-launch-metadata');
  });

  it('renders repo-local worktree paths for worktree strategy', () => {
    expect(renderExpectedWorktreePath('/repo', git, story())).toBe('/repo/.worktrees/a001-add-launch-metadata');
  });

  it('does not render a worktree path for branch strategy', () => {
    expect(renderExpectedWorktreePath('/repo', { ...git, strategy: 'branch' }, story())).toBeNull();
  });

  it('creates stable launch ids and prompt hashes', () => {
    expect(buildLaunchId('A001', '2026-06-08T00:00:00.000Z')).toBe('A001-2026-06-08T00-00-00-000Z');
    expect(hashPrompt('prompt')).toMatch(/^[a-f0-9]{64}$/);
  });
});
