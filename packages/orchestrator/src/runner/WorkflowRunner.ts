import path from 'node:path';
import type { CollaborationInspector } from '../collaboration/CollaborationInspector.js';
import type { StoryRunner } from '../drivers/StoryRunner.js';
import type { GitInspector } from '../git/GitInspector.js';
import { selectDispatchableStories } from '../scheduler/scheduler.js';
import { claimTrackerRow, releaseTrackerClaim, trackerFileExists } from '../tracks/trackerClaimer.js';
import type {
  ArtifactStore,
  Clock,
  Logger,
  ResolvedWorkflowConfig,
  RunState,
  StorySource,
  WorkflowStory,
} from '../types.js';
import { type BudgetControlDecision, isStrongerBudgetControl, selectBudgetControlDecision } from './BudgetControl.js';
import {
  type ClaimedWorkflowStory,
  type PreparedChildLaunch,
  recordChildLaunchWithWorkspace,
} from './ChildLaunchRecorder.js';
import { executeChildWithSupervisor, isSupervisionLostError } from './ChildSupervisor.js';
import type { PrepareChildWorkspaceArgs, PreparedChildWorkspace } from './ChildWorkspacePreparer.js';
import { CompletionGate, type ReturnEvaluation } from './CompletionGate.js';
import { findDuplicateLaunch } from './DuplicateLaunchGuard.js';
import { MetricsCollector } from './MetricsCollector.js';
import { RunJournal, type SettledStoryRun } from './RunJournal.js';
import { runEligibleWorkflow } from './WorkflowRunnerEligible.js';

export interface WorkflowRunnerDependencies {
  command: string;
  config: ResolvedWorkflowConfig;
  storySource: StorySource;
  storyRunner: StoryRunner;
  collaborationInspector?: CollaborationInspector;
  gitInspector: GitInspector;
  artifactStore: ArtifactStore;
  logger: Logger;
  clock: Clock;
  runId: string;
  childTimer?: ChildTimer;
  childWorkspacePreparer?: (args: PrepareChildWorkspaceArgs) => Promise<PreparedChildWorkspace>;
}

export interface ChildTimer {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export class WorkflowRunner {
  private state: RunState;
  private readonly metrics: MetricsCollector;
  private readonly journal: RunJournal;
  private readonly completionGate: CompletionGate;
  private readonly trackerClaims = new Map<string, ClaimedWorkflowStory>();
  private readonly emittedBudgetEvents = new Set<string>();
  private readonly activeChildAbortControllers = new Map<string, AbortController>();
  private budgetControlDecision: BudgetControlDecision | null = null;

  constructor(private readonly dependencies: WorkflowRunnerDependencies) {
    this.metrics = new MetricsCollector(dependencies.clock);
    this.journal = new RunJournal({ artifactStore: dependencies.artifactStore, clock: dependencies.clock });
    this.completionGate = new CompletionGate({
      gitInspector: dependencies.gitInspector,
      statuses: dependencies.config.statuses,
      git: dependencies.config.git,
      pr: dependencies.config.pr,
      tracker: dependencies.config.tracker,
      childCwdAbs: dependencies.config.childSession.cwdAbs,
      collaborationInspector: dependencies.collaborationInspector,
    });
    this.state = {
      runId: dependencies.runId,
      command: dependencies.command,
      workspaceRoot: dependencies.config.workspace.rootAbs,
      artifactDir: path.join(dependencies.config.artifacts.runsDirAbs, dependencies.runId),
      status: 'running',
      maxParallel: dependencies.config.orchestrator.maxParallel,
      startedAt: dependencies.clock.now(),
      active: [],
      completed: [],
      blockedStoryId: null,
      blockedReason: null,
    };
  }

  async listEligible(): Promise<WorkflowStory[]> {
    const stories = await this.dependencies.storySource.listStories();
    return stories.filter((story) => story.eligible);
  }

  async dryRunEligible(): Promise<RunState> {
    await this.journal.writeRunMetadata(this.state);
    await this.journal.writeConfigSnapshot(this.dependencies.config);
    await this.journal.record('run-started', { command: 'run-eligible', dryRun: true });
    const stories = await this.dependencies.storySource.listStories();
    await this.journal.writeStorySnapshot('initial', stories);
    const dispatchable = selectDispatchableStories(stories, {
      maxParallel: this.dependencies.config.orchestrator.maxParallel,
    });
    this.state = { ...this.state, status: 'dry-run', dryRunDispatch: dispatchable.map((story) => story.id) };
    await this.writeState();
    await this.writeLiveMetrics();
    return { ...this.state };
  }

  async dryRunStory(storyId: string, options: { force?: boolean } = {}): Promise<RunState> {
    await this.journal.writeRunMetadata(this.state);
    await this.journal.writeConfigSnapshot(this.dependencies.config);
    await this.journal.record('run-started', {
      command: 'run-story',
      storyId,
      dryRun: true,
      force: options.force === true,
    });

    const stories = await this.dependencies.storySource.listStories();
    await this.journal.writeStorySnapshot('initial', stories);
    const story = stories.find((entry) => entry.id === storyId);

    if (!story) {
      this.blockOnce(storyId, `story ${storyId} was not found`);
      return await this.finish();
    }
    if (!story.eligible && options.force !== true) {
      this.blockOnce(story.id, story.blockedReason ?? `story ${story.id} is not eligible`);
      return await this.finish();
    }

    this.state = { ...this.state, status: 'dry-run', dryRunDispatch: [story.id] };
    await this.writeState();
    await this.writeLiveMetrics();
    return { ...this.state };
  }

  async runStory(storyId: string, options: { force?: boolean } = {}): Promise<RunState> {
    await this.journal.writeRunMetadata(this.state);
    await this.journal.writeConfigSnapshot(this.dependencies.config);
    await this.journal.record('run-started', { command: 'run-story', storyId, force: options.force === true });

    const stories = await this.dependencies.storySource.listStories();
    await this.journal.writeStorySnapshot('initial', stories);
    const story = stories.find((entry) => entry.id === storyId);

    if (!story) {
      this.blockOnce(storyId, `story ${storyId} was not found`);
      return await this.finish();
    }
    if (!story.eligible && options.force !== true) {
      this.blockOnce(story.id, story.blockedReason ?? `story ${story.id} is not eligible`);
      return await this.finish();
    }

    if (await this.applyPendingAbortControl('before-launch')) {
      return await this.finish();
    }
    const settled = await this.launchChild(story, { force: options.force === true });
    const abortRequested = await this.applyPendingAbortControl('child-settled');
    if (!settled.ok) {
      await this.recordSettledChild(settled);
      await this.journal.record('child-error', { storyId: settled.storyId, error: settled.error });
      if (abortRequested) return await this.finish();
      this.blockOnce(story.id, settled.error ?? 'child session failed');
      return await this.finish();
    }
    if (abortRequested) {
      await this.recordSettledChild(settled);
      return await this.finish();
    }

    const evaluation = await this.processSettled(settled);
    if (!evaluation.complete) {
      this.blockOnce(settled.storyId, evaluation.reason);
      await this.journal.record('story-not-complete', {
        storyId: settled.storyId,
        status: evaluation.returnedStory?.status ?? null,
      });
      return await this.finish();
    }

    await this.journal.record('child-complete', { storyId: settled.storyId, sessionId: settled.sessionId });
    return await this.finish();
  }

  async runEligible(options: { returnAfterInitialLaunch?: boolean } = {}): Promise<RunState> {
    return await runEligibleWorkflow(this, options);
  }

  private async launchChild(story: WorkflowStory, options: { force?: boolean } = {}): Promise<SettledStoryRun> {
    if (!(await this.preflightDuplicateLaunch(story))) {
      return {
        storyId: story.id,
        ok: false,
        sessionId: null,
        error: this.state.blockedReason ?? 'duplicate active launch',
        completedAt: this.dependencies.clock.now(),
        baseShaAtLaunch: null,
      };
    }
    const claimed = await this.claimBeforeLaunch(story, options);
    if (!claimed) {
      return {
        storyId: story.id,
        ok: false,
        sessionId: null,
        error: this.state.blockedReason ?? 'tracker claim failed',
        completedAt: this.dependencies.clock.now(),
        baseShaAtLaunch: null,
      };
    }
    const launch = await this.recordChildLaunch(claimed);
    if (!launch) {
      return {
        storyId: claimed.story.id,
        ok: false,
        sessionId: null,
        error: this.state.blockedReason ?? 'duplicate active launch',
        completedAt: this.dependencies.clock.now(),
        baseShaAtLaunch: null,
      };
    }
    return await this.executeChild(claimed.story, launch);
  }

  private async claimBeforeLaunch(
    story: WorkflowStory,
    options: { force?: boolean } = {},
  ): Promise<ClaimedWorkflowStory | null> {
    const owner = `awk:${this.state.runId}:${story.id}`;
    if (this.dependencies.config.git.strategy === 'worktree') {
      await this.journal.record('tracker-claim-skipped', {
        storyId: story.id,
        owner,
        reason: 'worktree-child-owns-tracker',
      });
      return { story, owner, previousStatus: story.status, trackerClaimed: false };
    }
    if (!(await trackerFileExists(this.dependencies.config, story))) {
      return { story, owner, previousStatus: story.status, trackerClaimed: false };
    }
    const claim = await claimTrackerRow({ config: this.dependencies.config, story, owner, force: options.force });
    if (!claim.ok) {
      this.blockOnce(story.id, claim.reason);
      await this.journal.record('tracker-claim-blocked', { storyId: story.id, reason: claim.reason });
      await this.writeState();
      await this.writeLiveMetrics();
      return null;
    }
    await this.journal.record('tracker-claimed', { storyId: story.id, owner });
    this.trackerClaims.set(story.id, { story: claim.story, owner, previousStatus: story.status, trackerClaimed: true });
    return { story: claim.story, owner, previousStatus: story.status, trackerClaimed: true };
  }

  private async preflightDuplicateLaunch(story: WorkflowStory): Promise<boolean> {
    const duplicate = await findDuplicateLaunch({
      story,
      config: this.dependencies.config,
      activeChildren: this.state.activeChildren ?? [],
      now: this.dependencies.clock.now(),
    });
    for (const ignored of duplicate.ignored) {
      await this.journal.record('child-launch-stale-ignored', {
        storyId: story.id,
        duplicateStoryId: ignored.storyId,
        duplicateLaunchId: ignored.launchId,
        reason: ignored.reason,
        expectedBranch: ignored.expectedBranch,
        expectedWorktreePath: ignored.expectedWorktreePath,
        startedAt: ignored.startedAt,
        ageMs: ignored.ageMs,
        startupTimeoutMs: ignored.startupTimeoutMs,
      });
    }
    if (!duplicate.conflict) return true;
    this.blockOnce(story.id, duplicate.conflict.reason);
    await this.journal.record('child-launch-blocked', {
      storyId: story.id,
      reason: duplicate.conflict.reason,
      duplicateStoryId: duplicate.conflict.storyId,
      expectedBranch: duplicate.conflict.expectedBranch,
      expectedWorktreePath: duplicate.conflict.expectedWorktreePath,
    });
    await this.writeState();
    await this.writeLiveMetrics();
    return false;
  }

  private async recordChildLaunch(claim: ClaimedWorkflowStory): Promise<PreparedChildLaunch | null> {
    return await recordChildLaunchWithWorkspace(this, claim);
  }

  private async executeChild(story: WorkflowStory, launch: PreparedChildLaunch): Promise<SettledStoryRun> {
    return await executeChildWithSupervisor(this, story, launch);
  }

  private async processSettled(settled: SettledStoryRun, stories?: WorkflowStory[]): Promise<ReturnEvaluation> {
    let returnedStories: WorkflowStory[];
    try {
      returnedStories = stories ?? (await this.dependencies.storySource.listStories());
    } catch (error) {
      const reason = trackerRefreshFailureReason(error);
      await this.journal.record('tracker-refresh-failed', { storyId: settled.storyId, reason });
      await this.recordSettledChild(settled);
      return {
        complete: false,
        returnedStory: null,
        reason,
        authority: 'inspect-failed',
        source: 'returned-tracker',
      };
    }
    await this.journal.writeStorySnapshot(`after-${settled.storyId}`, returnedStories);
    const evaluation = await this.completionGate.evaluate(settled, returnedStories);
    const settledWithEvidence = {
      ...settled,
      ...(evaluation.commitEvidence ? { commitEvidence: evaluation.commitEvidence } : {}),
      ...(evaluation.collaborationEvidence ? { collaborationEvidence: evaluation.collaborationEvidence } : {}),
      completionAuthority: evaluation.authority,
      completionAuthoritySource: evaluation.source,
    };
    await this.journal.record('completion_authority', {
      storyId: settled.storyId,
      authority: evaluation.authority,
      source: evaluation.source,
      complete: evaluation.complete,
      collaborationVerified: evaluation.collaborationEvidence?.verified ?? false,
      collaborationAvailable: evaluation.collaborationEvidence?.available ?? false,
      collaborationMissingSignal: evaluation.collaborationEvidence?.missingSignal ?? null,
    });
    await this.recordSettledChild(settledWithEvidence, evaluation.returnedStory, evaluation.complete);
    return evaluation;
  }

  private async recordSettledChild(
    settled: SettledStoryRun,
    returnedStory?: WorkflowStory | null,
    returnedComplete?: boolean | null,
  ): Promise<void> {
    const entry = await this.journal.recordSettledChild(this.metrics, settled, returnedStory, returnedComplete);
    this.state = { ...this.state, completed: [...this.state.completed, entry] };
    await this.writeState();
    await this.writeLiveMetrics();
    if (this.state.status !== 'supervision_lost' && !isSupervisionLostError(settled.error ?? '')) {
      await this.releaseSettledClaim(settled.storyId);
    }
  }

  private async releaseSettledClaim(storyId: string): Promise<void> {
    const claim = this.trackerClaims.get(storyId);
    if (!claim?.trackerClaimed) return;
    try {
      const result = await releaseTrackerClaim({
        config: this.dependencies.config,
        story: claim.story,
        owner: claim.owner,
        previousStatus: claim.previousStatus,
      });
      if (result.ok) {
        await this.journal.record('tracker-claim-released', {
          storyId: claim.story.id,
          fromStatus: result.fromStatus,
          toStatus: result.toStatus,
          owner: claim.owner,
          reason: 'child-settled',
        });
      } else {
        await this.journal.record('tracker-claim-release-skipped', {
          storyId: claim.story.id,
          reason: result.reason,
        });
      }
    } catch (error) {
      await this.journal.record('tracker-claim-release-skipped', {
        storyId: claim.story.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.trackerClaims.delete(storyId);
    }
  }

  private blockOnce(storyId: string, reason: string): void {
    if (this.state.status === 'blocked') return;
    if (this.state.status === 'supervision_lost') return;
    this.state = { ...this.state, status: 'blocked', blockedStoryId: storyId, blockedReason: reason };
    this.dependencies.logger.warn('run blocked', { storyId, reason });
  }

  private async applyPendingAbortControl(phase: string): Promise<boolean> {
    const request = (await this.journal.readControls()).find((entry) => entry.action === 'abort');
    if (!request) return false;
    if (this.state.status === 'aborted') return true;
    if (
      this.state.status === 'blocked' ||
      this.state.status === 'complete' ||
      this.state.status === 'supervision_lost'
    ) {
      return true;
    }
    const activeStoryIds = this.state.active;
    const nextStatus = activeStoryIds.length > 0 ? 'aborting' : 'aborted';
    this.state = {
      ...this.state,
      status: nextStatus,
      blockedStoryId: nextStatus === 'aborting' ? (request.storyId ?? activeStoryIds[0] ?? null) : null,
      blockedReason: nextStatus === 'aborting' ? (request.reason ?? 'abort requested') : null,
    };
    await this.journal.record('control-applied', {
      controlId: request.id,
      action: request.action,
      outcome: nextStatus === 'aborted' ? 'applied' : 'requested',
      phase,
      activeStoryIds,
    });
    if (nextStatus === 'aborted') {
      await this.journal.record('run-aborted', {
        controlId: request.id,
        reason: request.reason,
      });
    }
    await this.writeState();
    await this.writeLiveMetrics();
    return true;
  }

  private async finish(): Promise<RunState> {
    if (this.state.status === 'aborting') {
      this.state = { ...this.state, status: 'aborted', blockedStoryId: null, blockedReason: null };
      await this.journal.record('run-aborted');
    }
    if (
      this.state.status !== 'blocked' &&
      this.state.status !== 'aborted' &&
      this.state.status !== 'dry-run' &&
      this.state.status !== 'supervision_lost'
    ) {
      this.state = { ...this.state, status: 'complete' };
      await this.journal.record('run-complete');
    } else if (this.state.status === 'blocked') {
      await this.journal.record('run-blocked', {
        blockedStoryId: this.state.blockedStoryId,
        blockedReason: this.state.blockedReason,
      });
    } else if (this.state.status === 'supervision_lost') {
      await this.journal.record('run-supervision-lost', {
        blockedStoryId: this.state.blockedStoryId,
        blockedReason: this.state.blockedReason,
      });
    }

    const completedAt = this.dependencies.clock.now();
    const runMetrics = this.metrics.buildRunMetrics({
      startedAt: this.state.startedAt,
      completedAt,
      completedCount: this.state.completed.length,
      status: this.state.status,
      blockedReason: this.state.blockedReason,
    });
    this.state = { ...this.state, completedAt, metrics: runMetrics };
    await this.writeState();
    await this.writeLiveMetrics();
    return { ...this.state };
  }

  private async writeState(): Promise<void> {
    await this.journal.writeState(this.state);
  }

  private async writeLiveMetrics(): Promise<void> {
    const liveMetrics = await this.journal.writeLiveMetrics(this.state, this.metrics.observedChildMetrics());
    const budgets = await this.journal.writeRuntimeArtifacts(this.state, this.dependencies.config, liveMetrics);
    for (const evaluation of budgets.evaluations) {
      if (!evaluation.eventType) continue;
      const key = `${evaluation.taskType}:${evaluation.profileName}:${evaluation.dimension}:${evaluation.status}`;
      if (this.emittedBudgetEvents.has(key)) continue;
      this.emittedBudgetEvents.add(key);
      await this.journal.record(evaluation.eventType, {
        topic: 'budget',
        level: evaluation.eventType === 'budget-warning' ? 'warning' : 'error',
        message: `${evaluation.dimension} budget ${evaluation.status}`,
        data: evaluation,
      });
    }
    const implementProfile = this.dependencies.config.agents.resolved.implementStory;
    const decision = selectBudgetControlDecision(
      budgets.evaluations.filter(
        (evaluation) =>
          evaluation.taskType === implementProfile.taskType && evaluation.profileName === implementProfile.name,
      ),
    );
    if (decision.action === 'continue' || decision.action === 'warn') return;
    if (!isStrongerBudgetControl(decision, this.budgetControlDecision)) return;
    this.budgetControlDecision = decision;
    await this.journal.record('budget-control-applied', {
      topic: 'budget',
      level: decision.abort ? 'error' : 'warning',
      controlAction: decision.action,
      stopNewLaunches: decision.stopNewLaunches,
      checkpointStop: decision.checkpointStop,
      abort: decision.abort,
      reason: decision.reason,
      data: decision.evaluation,
    });
    if (decision.abort) {
      for (const controller of this.activeChildAbortControllers.values()) {
        if (!controller.signal.aborted) controller.abort(new Error(decision.reason ?? 'budget abort'));
      }
      this.blockOnce(this.state.active[0] ?? 'run-eligible', decision.reason ?? 'budget abort');
    }
  }
}

function trackerRefreshFailureReason(error: unknown): string {
  return `tracker refresh failed: ${error instanceof Error ? error.message : String(error)}`;
}
