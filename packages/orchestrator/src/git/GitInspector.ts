import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ResolvedGitConfig, WorkflowStory } from '../types.js';

const execFileAsync = promisify(execFile);

export interface StoryCommitEvidence {
  committed: boolean;
  branch: string | null;
  isBaseBranch: boolean;
  headSha: string | null;
  baseSha: string | null;
  uncommittedChanges: boolean;
}

export interface GitInspector {
  snapshotBaseSha?(args: { git: ResolvedGitConfig; cwdAbs: string }): Promise<string | null>;
  inspectStory(args: {
    story: WorkflowStory;
    git: ResolvedGitConfig;
    cwdAbs: string;
    baseShaAtLaunch?: string | null;
  }): Promise<StoryCommitEvidence>;
}

export class RealGitInspector implements GitInspector {
  async snapshotBaseSha(args: { git: ResolvedGitConfig; cwdAbs: string }): Promise<string | null> {
    return await maybeGitOutput(args.cwdAbs, ['rev-parse', '--verify', args.git.baseBranch]);
  }

  async inspectStory(args: {
    story: WorkflowStory;
    git: ResolvedGitConfig;
    cwdAbs: string;
    baseShaAtLaunch?: string | null;
  }): Promise<StoryCommitEvidence> {
    const currentBranch = await gitOutput(args.cwdAbs, ['rev-parse', '--abbrev-ref', 'HEAD']);
    const baseSha = await maybeGitOutput(args.cwdAbs, ['rev-parse', '--verify', args.git.baseBranch]);
    const storyBranch = await resolveStoryBranch(args.cwdAbs, args.story, args.git);
    const inspectedBranch = storyBranch ?? currentBranch;
    const headSha = inspectedBranch
      ? await maybeGitOutput(args.cwdAbs, ['rev-parse', '--verify', inspectedBranch])
      : null;
    // Only the resolved story branch determines base-branch placement. In worktree strategy the
    // inspected root checkout stays on the base branch while the child commits on a sibling worktree's
    // story branch, so the inspected checkout's own HEAD must not contaminate this judgement.
    const isBaseBranch = inspectedBranch === args.git.baseBranch;
    const uncommittedChanges = (await gitOutput(args.cwdAbs, ['status', '--porcelain'])).length > 0;
    const comparisonBase = args.baseShaAtLaunch ?? baseSha;
    const commitCount =
      inspectedBranch && comparisonBase
        ? parseCommitCount(
            await maybeGitOutput(args.cwdAbs, ['rev-list', '--count', `${comparisonBase}..${inspectedBranch}`]),
          )
        : 0;

    return {
      committed: commitCount > 0,
      branch: inspectedBranch,
      isBaseBranch,
      headSha,
      baseSha,
      uncommittedChanges,
    };
  }
}

async function resolveStoryBranch(
  cwdAbs: string,
  story: WorkflowStory,
  git: ResolvedGitConfig,
): Promise<string | null> {
  const pattern = branchSearchPattern(story, git);
  const output = await gitOutput(cwdAbs, ['branch', '--list', pattern]);
  const branches = output
    .split('\n')
    // Strip the current-branch marker (`* `) and the other-worktree marker (`+ `) that
    // `git branch --list` prepends; an unstripped `+ ` corrupts the branch name passed to rev-list.
    .map((line) => line.replace(/^[*+]\s*/, '').trim())
    .filter(Boolean)
    .sort();
  // A retried story can leave >1 branch matching the {slug} glob. Pick deterministically
  // (lexically-first) so completion evidence is stable across runs rather than order-dependent.
  return branches[0] ?? null;
}

function branchSearchPattern(story: WorkflowStory, git: ResolvedGitConfig): string {
  return git.branchPattern
    .replaceAll('{track}', story.metadata.trackId)
    .replaceAll('{id}', story.id)
    .replaceAll('{id-lc}', story.id.toLowerCase())
    .replaceAll('{slug}', '*');
}

function parseCommitCount(value: string | null): number {
  if (value === null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function gitOutput(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
}

async function maybeGitOutput(cwd: string, args: string[]): Promise<string | null> {
  try {
    return await gitOutput(cwd, args);
  } catch {
    return null;
  }
}
