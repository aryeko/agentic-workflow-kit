import type { GitInspector, StoryCommitEvidence } from '../git/GitInspector.js';
import { isCompleteStatus } from '../scheduler/scheduler.js';
import type { ResolvedGitConfig, ResolvedWorkflowConfig, WorkflowStory } from '../types.js';
import type { SettledStoryRun } from './RunJournal.js';

export type ReturnEvaluation =
  | { complete: true; returnedStory: WorkflowStory; commitEvidence?: StoryCommitEvidence }
  | { complete: false; returnedStory: WorkflowStory | null; reason: string; commitEvidence?: StoryCommitEvidence };

export interface CompletionGateDeps {
  gitInspector: GitInspector;
  statuses: ResolvedWorkflowConfig['statuses'];
  git: ResolvedGitConfig;
  pr: ResolvedWorkflowConfig['pr'];
  childCwdAbs: string;
}

export class CompletionGate {
  constructor(private readonly deps: CompletionGateDeps) {}

  async evaluate(settled: SettledStoryRun, stories: WorkflowStory[]): Promise<ReturnEvaluation> {
    const returnedStory = stories.find((entry) => entry.id === settled.storyId) ?? null;
    if (!returnedStory) {
      return {
        complete: false,
        returnedStory,
        reason: `${settled.storyId} returned but story source no longer contains it`,
      };
    }
    if (!isCompleteStatus(returnedStory.status, this.deps.statuses.complete)) {
      return {
        complete: false,
        returnedStory,
        reason: `${settled.storyId} returned but status is ${returnedStory.status}`,
      };
    }
    let commitEvidence: StoryCommitEvidence;
    try {
      commitEvidence = await this.deps.gitInspector.inspectStory({
        story: returnedStory,
        git: this.deps.git,
        cwdAbs: invocationCwd(settled) ?? this.deps.childCwdAbs,
        baseShaAtLaunch: settled.baseShaAtLaunch,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { complete: false, returnedStory, reason: `inspect-failed: ${message}` };
    }
    const dirtyBlocks = this.deps.git.strategy !== 'worktree' && commitEvidence.uncommittedChanges;
    if (!commitEvidence.committed || dirtyBlocks) {
      return { complete: false, returnedStory, reason: 'complete-but-uncommitted', commitEvidence };
    }
    if (
      this.deps.git.commitOnBase === 'forbid' &&
      commitEvidence.isBaseBranch &&
      !isAcceptedAutoMergeEvidence(this.deps.pr, commitEvidence)
    ) {
      return { complete: false, returnedStory, reason: 'complete-on-forbidden-base', commitEvidence };
    }
    return { complete: true, returnedStory, commitEvidence };
  }
}

function isAcceptedAutoMergeEvidence(pr: ResolvedWorkflowConfig['pr'], commitEvidence: StoryCommitEvidence): boolean {
  return (
    pr.merge.auto &&
    commitEvidence.committed &&
    commitEvidence.headSha !== null &&
    commitEvidence.baseSha !== null &&
    commitEvidence.headSha === commitEvidence.baseSha &&
    commitEvidence.mergedPullRequest?.mergeCommitSha === commitEvidence.headSha
  );
}

function invocationCwd(settled: SettledStoryRun): string | null {
  const cwd = settled.invocation?.cwd;
  return typeof cwd === 'string' && cwd.length > 0 ? cwd : null;
}
