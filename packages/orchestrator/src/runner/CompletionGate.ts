import type { GitInspector, StoryCommitEvidence } from '../git/GitInspector.js';
import { isCompleteStatus } from '../scheduler/scheduler.js';
import { parseTrackerStories } from '../tracks/markdownTracker.js';
import type { ResolvedGitConfig, ResolvedWorkflowConfig, WorkflowStory } from '../types.js';
import type { SettledStoryRun } from './RunJournal.js';

export type ReturnEvaluation =
  | {
      complete: true;
      returnedStory: WorkflowStory;
      authority: CompletionAuthority;
      source: CompletionAuthoritySource;
      commitEvidence?: StoryCommitEvidence;
    }
  | {
      complete: false;
      returnedStory: WorkflowStory | null;
      reason: string;
      authority: CompletionAuthority;
      source: CompletionAuthoritySource;
      commitEvidence?: StoryCommitEvidence;
    };

export type CompletionAuthoritySource = 'returned-tracker' | 'base-tracker';

export type CompletionAuthority =
  | 'story-missing'
  | 'tracker-status-not-complete'
  | 'inspect-failed'
  | 'complete-but-uncommitted'
  | 'forbidden-direct-base-commit'
  | 'merged-pr-on-base'
  | 'tracker-complete-story-branch'
  | 'tracker-complete-base-allowed';

export interface CompletionGateDeps {
  gitInspector: GitInspector;
  statuses: ResolvedWorkflowConfig['statuses'];
  git: ResolvedGitConfig;
  pr: ResolvedWorkflowConfig['pr'];
  tracker: ResolvedWorkflowConfig['tracker'];
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
        authority: 'story-missing',
        source: 'returned-tracker',
      };
    }
    if (!isCompleteStatus(returnedStory.status, this.deps.statuses.complete)) {
      const baseStory = await this.readCompleteBaseTrackerStory(settled, returnedStory);
      if (baseStory) return await this.evaluateCompleteStory(settled, baseStory, 'base-tracker');
      return {
        complete: false,
        returnedStory,
        reason: `${settled.storyId} returned but status is ${returnedStory.status}`,
        authority: 'tracker-status-not-complete',
        source: 'returned-tracker',
      };
    }
    return await this.evaluateCompleteStory(settled, returnedStory, 'returned-tracker');
  }

  private async evaluateCompleteStory(
    settled: SettledStoryRun,
    returnedStory: WorkflowStory,
    source: CompletionAuthoritySource,
  ): Promise<ReturnEvaluation> {
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
      return {
        complete: false,
        returnedStory,
        reason: `inspect-failed: ${message}`,
        authority: 'inspect-failed',
        source,
      };
    }
    const dirtyBlocks = this.deps.git.strategy !== 'worktree' && commitEvidence.uncommittedChanges;
    if (!commitEvidence.committed || dirtyBlocks) {
      return {
        complete: false,
        returnedStory,
        reason: 'complete-but-uncommitted',
        authority: 'complete-but-uncommitted',
        source,
        commitEvidence,
      };
    }
    const acceptedAutoMerge = isAcceptedAutoMergeEvidence(this.deps.pr, commitEvidence);
    if (this.deps.git.commitOnBase === 'forbid' && commitEvidence.isBaseBranch && !acceptedAutoMerge) {
      return {
        complete: false,
        returnedStory,
        reason: 'complete-on-forbidden-base',
        authority: 'forbidden-direct-base-commit',
        source,
        commitEvidence,
      };
    }
    return {
      complete: true,
      returnedStory,
      authority: acceptedAutoMerge
        ? 'merged-pr-on-base'
        : commitEvidence.isBaseBranch
          ? 'tracker-complete-base-allowed'
          : 'tracker-complete-story-branch',
      source,
      commitEvidence,
    };
  }

  private async readCompleteBaseTrackerStory(
    settled: SettledStoryRun,
    returnedStory: WorkflowStory,
  ): Promise<WorkflowStory | null> {
    if (!shouldReadBaseTracker(this.deps.pr, settled)) return null;
    if (!this.deps.gitInspector.readFileFromRef) return null;
    const trackerPath = settled.evidence?.trackerPath ?? returnedStory.metadata.trackerPath;
    const content = await this.deps.gitInspector.readFileFromRef({
      cwdAbs: invocationCwd(settled) ?? this.deps.childCwdAbs,
      ref: `origin/${this.deps.git.baseBranch}`,
      filePath: trackerPath,
    });
    if (content === null) return null;
    const baseStories = parseTrackerStories(content, {
      completeStatuses: new Set(this.deps.statuses.complete),
      eligibleStatuses: new Set(this.deps.statuses.eligible),
      idPattern: new RegExp(this.deps.tracker.idPattern),
      trackId: returnedStory.metadata.trackId,
      trackTitle: returnedStory.metadata.trackTitle,
      trackerPath,
    });
    const baseStory = baseStories.find((entry) => entry.id === settled.storyId) ?? null;
    if (!baseStory || !isCompleteStatus(baseStory.status, this.deps.statuses.complete)) return null;
    return baseStory;
  }
}

function shouldReadBaseTracker(pr: ResolvedWorkflowConfig['pr'], settled: SettledStoryRun): boolean {
  return pr.merge.auto || settled.evidence?.merged === true || typeof settled.evidence?.mergeCommit === 'string';
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
