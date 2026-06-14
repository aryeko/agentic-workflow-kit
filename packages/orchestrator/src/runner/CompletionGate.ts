import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CollaborationEvidence, CollaborationInspector } from '../collaboration/CollaborationInspector.js';
import type { GitInspector, StoryCommitEvidence } from '../git/GitInspector.js';
import { isNodeError } from '../internal/guards.js';
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
      collaborationEvidence?: CollaborationEvidence;
    }
  | {
      complete: false;
      returnedStory: WorkflowStory | null;
      reason: string;
      authority: CompletionAuthority;
      source: CompletionAuthoritySource;
      commitEvidence?: StoryCommitEvidence;
      collaborationEvidence?: CollaborationEvidence;
    };

export type CompletionAuthoritySource = 'returned-tracker' | 'base-tracker' | 'child-worktree-tracker';

export type CompletionAuthority =
  | 'story-missing'
  | 'tracker-status-not-complete'
  | 'inspect-failed'
  | 'complete-but-uncommitted'
  | 'forbidden-direct-base-commit'
  | 'pr-policy-incomplete'
  | 'github-verification-unavailable'
  | 'github-verification-incomplete'
  | 'merged-pr-on-base'
  | 'verified-merged-pr-on-base'
  | 'tracker-complete-story-branch'
  | 'tracker-complete-base-allowed';

export interface CompletionGateDeps {
  gitInspector: GitInspector;
  statuses: ResolvedWorkflowConfig['statuses'];
  git: ResolvedGitConfig;
  pr: ResolvedWorkflowConfig['pr'];
  tracker: ResolvedWorkflowConfig['tracker'];
  childCwdAbs: string;
  collaborationInspector?: CollaborationInspector;
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
      if (baseStory) return await this.evaluateCompleteBaseStory(settled, baseStory);
      const childStory = await this.readCompleteChildTrackerStory(settled, returnedStory);
      if (childStory) return await this.evaluateCompleteStory(settled, childStory, 'child-worktree-tracker');
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

  private async evaluateCompleteBaseStory(
    settled: SettledStoryRun,
    returnedStory: WorkflowStory,
  ): Promise<ReturnEvaluation> {
    const verified = await this.verifyAutoMergeIfNeeded(settled, returnedStory, 'base-tracker');
    if (!verified.ok) return verified.result;
    const commitEvidence = await this.mergedBaseRefCommitEvidence(settled, verified.evidence);
    if (commitEvidence) {
      return this.evaluateCompleteCommitEvidence(returnedStory, 'base-tracker', commitEvidence, verified.evidence);
    }
    return await this.evaluateCompleteStory(settled, returnedStory, 'base-tracker', verified.evidence);
  }

  private async evaluateCompleteStory(
    settled: SettledStoryRun,
    returnedStory: WorkflowStory,
    source: CompletionAuthoritySource,
    collaborationEvidence?: CollaborationEvidence,
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
    if (
      this.deps.git.commitOnBase === 'forbid' &&
      commitEvidence.isBaseBranch &&
      commitEvidence.mergedPullRequest == null
    ) {
      return this.evaluateCompleteCommitEvidence(returnedStory, source, commitEvidence);
    }
    const verified = collaborationEvidence
      ? { ok: true as const, evidence: collaborationEvidence }
      : await this.verifyAutoMergeIfNeeded(settled, returnedStory, source);
    if (!verified.ok) return verified.result;
    if (this.deps.pr.merge.auto && verified.evidence?.pr?.state === 'merged') {
      const baseStory = await this.readCompleteBaseTrackerStory(settled, returnedStory);
      const baseCommitEvidence = baseStory ? await this.mergedBaseRefCommitEvidence(settled, verified.evidence) : null;
      if (baseStory && baseCommitEvidence) {
        return this.evaluateCompleteCommitEvidence(baseStory, 'base-tracker', baseCommitEvidence, verified.evidence);
      }
    }
    return this.evaluateCompleteCommitEvidence(returnedStory, source, commitEvidence, verified.evidence);
  }

  private evaluateCompleteCommitEvidence(
    returnedStory: WorkflowStory,
    source: CompletionAuthoritySource,
    commitEvidence: StoryCommitEvidence,
    collaborationEvidence?: CollaborationEvidence,
  ): ReturnEvaluation {
    const dirtyBlocks = this.deps.git.strategy !== 'worktree' && commitEvidence.uncommittedChanges;
    if (!commitEvidence.committed || dirtyBlocks) {
      return {
        complete: false,
        returnedStory,
        reason: 'complete-but-uncommitted',
        authority: 'complete-but-uncommitted',
        source,
        commitEvidence,
        collaborationEvidence,
      };
    }
    const acceptedAutoMerge = isAcceptedAutoMergeEvidence(this.deps.pr, commitEvidence, collaborationEvidence);
    if (this.deps.git.commitOnBase === 'forbid' && commitEvidence.isBaseBranch && !acceptedAutoMerge) {
      return {
        complete: false,
        returnedStory,
        reason: 'complete-on-forbidden-base',
        authority: 'forbidden-direct-base-commit',
        source,
        commitEvidence,
        collaborationEvidence,
      };
    }
    if (this.deps.pr.merge.auto && !acceptedAutoMerge) {
      return {
        complete: false,
        returnedStory,
        reason: 'pr-policy-incomplete: auto-merge enabled but merged base evidence is incomplete',
        authority: 'pr-policy-incomplete',
        source,
        commitEvidence,
        collaborationEvidence,
      };
    }
    return {
      complete: true,
      returnedStory,
      authority: acceptedAutoMerge
        ? collaborationEvidence
          ? 'verified-merged-pr-on-base'
          : 'merged-pr-on-base'
        : commitEvidence.isBaseBranch
          ? 'tracker-complete-base-allowed'
          : 'tracker-complete-story-branch',
      source,
      commitEvidence,
      collaborationEvidence,
    };
  }

  private async verifyAutoMergeIfNeeded(
    settled: SettledStoryRun,
    story: WorkflowStory,
    source: CompletionAuthoritySource,
  ): Promise<{ ok: true; evidence?: CollaborationEvidence } | { ok: false; result: ReturnEvaluation }> {
    if (!this.deps.pr.merge.auto) return { ok: true };
    if (!this.deps.collaborationInspector) {
      return {
        ok: false,
        result: {
          complete: false,
          returnedStory: story,
          reason: 'github-verification-unavailable: collaboration inspector is not configured',
          authority: 'github-verification-unavailable',
          source,
        },
      };
    }
    const pr = pullRequestIdentity(settled, story);
    if (!pr) {
      return {
        ok: false,
        result: {
          complete: false,
          returnedStory: story,
          reason: 'github-verification-unavailable: missing pull request identity',
          authority: 'github-verification-unavailable',
          source,
        },
      };
    }
    let evidence = await this.deps.collaborationInspector.inspectPullRequest({
      cwdAbs: invocationCwd(settled) ?? this.deps.childCwdAbs,
      owner: pr.owner,
      repo: pr.repo,
      prNumber: pr.number,
      branchName: null,
      reviewBot: this.deps.pr.review.bot,
    });
    if (evidence.available && evidence.pr?.state === 'open' && preMergeReady(this.deps.pr, evidence)) {
      if (!evidence.pr.headSha) {
        return {
          ok: false,
          result: {
            complete: false,
            returnedStory: story,
            reason: 'github-verification-incomplete: pull request head commit is not verified',
            authority: 'github-verification-incomplete',
            source,
            collaborationEvidence: evidence,
          },
        };
      }
      if (!this.deps.collaborationInspector.mergePullRequest) {
        return {
          ok: false,
          result: {
            complete: false,
            returnedStory: story,
            reason: 'github-verification-unavailable: parent merge operation is not configured',
            authority: 'github-verification-unavailable',
            source,
            collaborationEvidence: evidence,
          },
        };
      }
      evidence = await this.deps.collaborationInspector.mergePullRequest({
        cwdAbs: invocationCwd(settled) ?? this.deps.childCwdAbs,
        owner: pr.owner,
        repo: pr.repo,
        prNumber: pr.number,
        method: this.deps.pr.merge.method,
        deleteBranch: this.deps.pr.merge.deleteBranch,
        branchName: null,
        reviewBot: this.deps.pr.review.bot,
        expectedHeadSha: evidence.pr.headSha,
      });
    }
    const reason = autoMergeIncompleteReason(this.deps.pr, evidence);
    if (reason) {
      return {
        ok: false,
        result: {
          complete: false,
          returnedStory: story,
          reason,
          authority: evidence.available ? 'github-verification-incomplete' : 'github-verification-unavailable',
          source,
          collaborationEvidence: evidence,
        },
      };
    }
    return { ok: true, evidence };
  }

  private async mergedBaseRefCommitEvidence(
    settled: SettledStoryRun,
    collaborationEvidence?: CollaborationEvidence,
  ): Promise<StoryCommitEvidence | null> {
    const mergeCommit =
      collaborationEvidence?.pr?.mergeCommitSha ??
      settled.evidence?.mergeCommit ??
      settled.evidence?.github?.merge?.commit;
    if (!mergeCommit || !this.deps.gitInspector.isCommitReachableFromRef) return null;
    const baseRef = `origin/${this.deps.git.baseBranch}`;
    const reachable = await this.deps.gitInspector.isCommitReachableFromRef({
      cwdAbs: invocationCwd(settled) ?? this.deps.childCwdAbs,
      commit: mergeCommit,
      ref: baseRef,
    });
    return {
      committed: reachable,
      branch: baseRef,
      isBaseBranch: true,
      headSha: mergeCommit,
      baseSha: reachable ? mergeCommit : null,
      uncommittedChanges: false,
      mergedPullRequest:
        reachable && typeof (collaborationEvidence?.pr?.number ?? settled.evidence?.prNumber) === 'number'
          ? {
              number: collaborationEvidence?.pr?.number ?? settled.evidence?.prNumber ?? 0,
              url: collaborationEvidence?.pr?.url ?? settled.evidence?.prUrl ?? null,
              mergeCommitSha: mergeCommit,
            }
          : null,
    };
  }

  private async readCompleteBaseTrackerStory(
    settled: SettledStoryRun,
    returnedStory: WorkflowStory,
  ): Promise<WorkflowStory | null> {
    if (!shouldReadBaseTracker(this.deps.pr, settled)) return null;
    if (!this.deps.gitInspector.readFileFromRef) return null;
    const trackerPath = returnedStory.metadata.trackerPath;
    await this.deps.gitInspector.refreshBaseBranch?.({
      cwdAbs: invocationCwd(settled) ?? this.deps.childCwdAbs,
      git: this.deps.git,
    });
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

  private async readCompleteChildTrackerStory(
    settled: SettledStoryRun,
    returnedStory: WorkflowStory,
  ): Promise<WorkflowStory | null> {
    const trackerPath = returnedStory.metadata.trackerPath;
    const cwd = invocationCwd(settled) ?? this.deps.childCwdAbs;
    let content: string;
    try {
      content = await readFile(path.resolve(cwd, trackerPath), 'utf8');
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return null;
      throw error;
    }
    const childStories = parseTrackerStories(content, {
      completeStatuses: new Set(this.deps.statuses.complete),
      eligibleStatuses: new Set(this.deps.statuses.eligible),
      idPattern: new RegExp(this.deps.tracker.idPattern),
      trackId: returnedStory.metadata.trackId,
      trackTitle: returnedStory.metadata.trackTitle,
      trackerPath,
    });
    const childStory = childStories.find((entry) => entry.id === settled.storyId) ?? null;
    if (!childStory || !isCompleteStatus(childStory.status, this.deps.statuses.complete)) return null;
    return childStory;
  }
}

function shouldReadBaseTracker(pr: ResolvedWorkflowConfig['pr'], settled: SettledStoryRun): boolean {
  return (
    pr.merge.auto ||
    settled.evidence?.merged === true ||
    typeof settled.evidence?.mergeCommit === 'string' ||
    typeof settled.evidence?.github?.merge?.commit === 'string'
  );
}

function isAcceptedAutoMergeEvidence(
  pr: ResolvedWorkflowConfig['pr'],
  commitEvidence: StoryCommitEvidence,
  collaborationEvidence?: CollaborationEvidence,
): boolean {
  return (
    pr.merge.auto &&
    commitEvidence.committed &&
    commitEvidence.headSha !== null &&
    commitEvidence.baseSha !== null &&
    commitEvidence.headSha === commitEvidence.baseSha &&
    commitEvidence.mergedPullRequest?.mergeCommitSha === commitEvidence.headSha &&
    collaborationEvidence?.verified === true &&
    collaborationEvidence.pr?.state === 'merged' &&
    collaborationEvidence.pr.mergeCommitSha === commitEvidence.headSha
  );
}

function autoMergeIncompleteReason(pr: ResolvedWorkflowConfig['pr'], evidence: CollaborationEvidence): string | null {
  if (!evidence.available) {
    return `github-verification-unavailable: ${evidence.missingSignal ?? 'unknown'}`;
  }
  if (evidence.pr?.state !== 'merged' || !evidence.pr.mergeCommitSha) {
    return 'github-verification-incomplete: pull request is not verified merged';
  }
  if (pr.ci.wait && (evidence.checks.length === 0 || evidence.checks.some((check) => check.status !== 'passed'))) {
    return 'github-verification-incomplete: required checks are not verified passed';
  }
  if (pr.review.wait === 'bot' && evidence.review?.signal !== 'approved') {
    return 'github-verification-incomplete: bot review is not verified approved';
  }
  if (pr.merge.deleteBranch && evidence.branch?.exists !== false) {
    return 'github-verification-incomplete: branch deletion is not verified';
  }
  return null;
}

function preMergeReady(pr: ResolvedWorkflowConfig['pr'], evidence: CollaborationEvidence): boolean {
  if (pr.ci.wait && (evidence.checks.length === 0 || evidence.checks.some((check) => check.status !== 'passed'))) {
    return false;
  }
  if (pr.review.wait === 'bot' && evidence.review?.signal !== 'approved') return false;
  return true;
}

function pullRequestIdentity(
  settled: SettledStoryRun,
  story: WorkflowStory,
): { owner: string; repo: string; number: number } | null {
  const number =
    settled.evidence?.prNumber ?? settled.evidence?.github?.prNumber ?? pullRequestNumber(story.metadata.pr);
  const url = settled.evidence?.prUrl ?? settled.evidence?.github?.prUrl ?? story.metadata.pr;
  const match = url?.match(/github\.com\/([^/\s)]+)\/([^/\s)]+)\/pull\/(\d+)/);
  if (!match || typeof number !== 'number') return null;
  return { owner: match[1], repo: match[2], number };
}

function pullRequestNumber(value: string | undefined): number | null {
  const match = value?.match(/(?:pull\/|#|PR\s*#)(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function invocationCwd(settled: SettledStoryRun): string | null {
  const cwd = settled.invocation?.cwd;
  return typeof cwd === 'string' && cwd.length > 0 ? cwd : null;
}
