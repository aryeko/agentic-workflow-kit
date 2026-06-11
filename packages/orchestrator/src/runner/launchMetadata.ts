import { createHash } from 'node:crypto';
import path from 'node:path';

import type { ResolvedGitConfig, WorkflowStory } from '../types.js';

export function renderExpectedBranch(story: WorkflowStory, git: ResolvedGitConfig): string {
  return renderBranchPattern(story, git.branchPattern, slugify(story.title));
}

export function renderExpectedWorktreePath(
  workspaceRoot: string,
  git: ResolvedGitConfig,
  story: WorkflowStory,
): string | null {
  if (git.strategy !== 'worktree') return null;
  return path.join(workspaceRoot, git.worktreeDir, `${story.id.toLowerCase()}-${slugify(story.title)}`);
}

export function buildLaunchId(storyId: string, startedAt: string): string {
  return `${storyId}-${startedAt.replace(/[:.]/g, '-')}`;
}

export function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex');
}

function renderBranchPattern(story: WorkflowStory, pattern: string, slug: string): string {
  return pattern
    .replaceAll('{track}', story.metadata.trackId)
    .replaceAll('{id}', story.id)
    .replaceAll('{id-lc}', story.id.toLowerCase())
    .replaceAll('{slug}', slug);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
