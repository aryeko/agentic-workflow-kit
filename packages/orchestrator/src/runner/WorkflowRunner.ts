import path from 'node:path';
import pLimit from 'p-limit';

import { renderStoryImplementerPrompt } from '../drivers/promptRenderer.js';
import type {
  ChildLifecycleEvent,
  ChildProgressSource,
  StoryPromptMetadata,
  StoryRunner,
  StoryRunResult,
} from '../drivers/StoryRunner.js';
import type { GitInspector } from '../git/GitInspector.js';
import { safeName } from '../internal/guards.js';
import { selectDispatchableStories } from '../scheduler/scheduler.js';
import { claimTrackerRow, releaseTrackerClaim, trackerFileExists } from '../tracks/trackerClaimer.js';
import type {
  ArtifactStore,
  ChildLaunchRecord,
  Clock,
  Logger,
  ResolvedWorkflowConfig,
  RunState,
  StorySource,
  WorkflowStory,
} from '../types.js';
import { type BudgetControlDecision, isStrongerBudgetControl, selectBudgetControlDecision } from './BudgetControl.js';
import {
  type PrepareChildWorkspaceArgs,
  type PreparedChildWorkspace,
  prepareChildWorkspace,
} from './ChildWorkspacePreparer.js';
import { CompletionGate, type ReturnEvaluation } from './CompletionGate.js';
import { findDuplicateLaunch } from './DuplicateLaunchGuard.js';
import { buildLaunchId, hashPrompt, renderExpectedBranch, renderExpectedWorktreePath } from './launchMetadata.js';
import { MetricsCollector } from './MetricsCollector.js';
import { evaluateRecoveryGuard } from './RecoveryGuard.js';
import { RunJournal, type SettledStoryRun } from './RunJournal.js';

export interface WorkflowRunnerDependencies {
  command: string;
  config: ResolvedWorkflowConfig;
  storySource: StorySource;
  storyRunner: StoryRunner;
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

const defaultChildTimer: ChildTimer = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
  setInterval: (callback, ms) => globalThis.setInterval(callback, ms),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>),
};

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
      childCwdAbs: dependencies.config.childSession.childSession.cwdAbs,
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
    await this.journal.writeRunMetadata(this.state);
    await this.journal.writeConfigSnapshot(this.dependencies.config);
    await this.journal.record('run-started', {
      command: 'run-eligible',
      maxParallel: this.dependencies.config.orchestrator.maxParallel,
    });

    let stories = await this.dependencies.storySource.listStories();
    await this.journal.writeStorySnapshot('initial', stories);
    const active = new Map<string, Promise<SettledStoryRun>>();
    const attemptedStoryIds = new Set<string>();
    const limit = pLimit(this.dependencies.config.orchestrator.maxParallel);
    let stopLaunching = false;

    const launchAvailable = async (): Promise<void> => {
      stopLaunching = this.budgetControlDecision?.stopNewLaunches === true || stopLaunching;
      if (stopLaunching) return;
      if (await this.applyPendingAbortControl('before-launch')) {
        stopLaunching = true;
        return;
      }

      const activeIds = new Set(active.keys());
      const availableSlots = Math.max(0, this.dependencies.config.orchestrator.maxParallel - activeIds.size);
      const dispatchable = stories
        .filter((story) => story.eligible && !activeIds.has(story.id) && !attemptedStoryIds.has(story.id))
        .slice(0, availableSlots);
      const batchConflict = this.findDispatchBatchConflict(dispatchable);
      if (batchConflict) {
        this.blockOnce(batchConflict.storyId, batchConflict.reason);
        await this.journal.record('child-launch-blocked', batchConflict);
        await this.writeState();
        await this.writeLiveMetrics();
        stopLaunching = true;
        return;
      }

      for (const story of dispatchable) {
        if (await this.applyPendingAbortControl('before-launch')) {
          stopLaunching = true;
          break;
        }
        if (!(await this.preflightDuplicateLaunch(story))) {
          stopLaunching = true;
          break;
        }
        const claimedStory = await this.claimBeforeLaunch(story);
        if (!claimedStory) {
          stopLaunching = true;
          break;
        }
        const launch = await this.recordChildLaunch(claimedStory);
        if (!launch) {
          stopLaunching = true;
          break;
        }
        attemptedStoryIds.add(claimedStory.story.id);
        active.set(
          claimedStory.story.id,
          limit(() => this.executeChild(claimedStory.story, launch)),
        );
        const startup = await launch.startup;
        stopLaunching = this.budgetControlDecision?.stopNewLaunches === true || stopLaunching;
        if (stopLaunching) break;
        if (startup === 'failed') {
          stopLaunching = this.dependencies.config.orchestrator.stopLaunchingOnBlocked;
          break;
        }
        if (await this.applyPendingAbortControl('after-startup')) {
          stopLaunching = true;
          break;
        }
      }
    };

    await launchAvailable();
    if (active.size === 0) return await this.finish();

    const supervise = async (): Promise<RunState> => {
      while (active.size > 0) {
        const settled = await Promise.race(active.values());
        active.delete(settled.storyId);
        const abortRequested = await this.applyPendingAbortControl('child-settled');
        if (abortRequested) {
          stopLaunching = true;
        }

        if (!settled.ok) {
          await this.recordSettledChild(settled);
          await this.journal.record('child-error', { storyId: settled.storyId, error: settled.error });
          if (abortRequested) continue;
          this.blockOnce(settled.storyId, settled.error ?? 'child session failed');
          stopLaunching =
            this.budgetControlDecision?.stopNewLaunches === true ||
            this.dependencies.config.orchestrator.stopLaunchingOnBlocked;
          await this.writeState();
          await this.writeLiveMetrics();
          if (!stopLaunching) await launchAvailable();
          continue;
        }
        if (abortRequested) {
          await this.recordSettledChild(settled);
          continue;
        }

        stories = await this.dependencies.storySource.listStories();
        const evaluation = await this.processSettled(settled, stories);

        if (!evaluation.complete) {
          this.blockOnce(settled.storyId, evaluation.reason);
          await this.journal.record('story-not-complete', {
            storyId: settled.storyId,
            status: evaluation.returnedStory?.status ?? null,
          });
          stopLaunching =
            this.budgetControlDecision?.stopNewLaunches === true ||
            this.dependencies.config.orchestrator.stopLaunchingOnBlocked;
          if (!stopLaunching) await launchAvailable();
          continue;
        }

        await this.journal.record('child-complete', { storyId: settled.storyId, sessionId: settled.sessionId });
        stopLaunching = this.budgetControlDecision?.stopNewLaunches === true || stopLaunching;
        if (!stopLaunching) await launchAvailable();
      }

      if (this.budgetControlDecision?.stopNewLaunches) {
        this.blockOnce('run-eligible', this.budgetControlDecision.reason ?? 'budget policy stopped new launches');
      }
      return await this.finish();
    };

    if (options.returnAfterInitialLaunch === true) {
      void supervise().catch(async (error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.blockOnce('run-eligible', message);
        await this.journal.record('run-supervision-error', { error: message });
        await this.finish();
      });
      return { ...this.state };
    }

    return await supervise();
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
    const { story } = claim;
    const workspacePreparer = this.dependencies.childWorkspacePreparer ?? prepareChildWorkspace;
    let preparedWorkspace: PreparedChildWorkspace;
    try {
      preparedWorkspace = await workspacePreparer({
        story,
        workspaceRootAbs: this.dependencies.config.workspace.rootAbs,
        fallbackCwdAbs: this.dependencies.config.childSession.childSession.cwdAbs,
        git: this.dependencies.config.git,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.blockOnce(story.id, reason);
      await this.journal.record('child-workspace-prepare-failed', {
        storyId: story.id,
        reason,
      });
      await this.releaseUnlaunchedClaim(claim, reason);
      await this.writeState();
      await this.writeLiveMetrics();
      return null;
    }
    this.metrics.start(story.id);
    const startedAt = this.dependencies.clock.now();
    const childCwd = preparedWorkspace.childCwdAbs;
    const prompt = renderStoryImplementerPrompt(story, this.dependencies.config);
    const profile = this.dependencies.config.agents.resolved.implementStory;
    const promptHash = hashPrompt(prompt);
    const promptMetadata: StoryPromptMetadata = {
      template: profile.prompt.template,
      promptHash,
      structuredOutputSchema: profile.structuredOutput.schema,
      structuredOutputRequired: profile.structuredOutput.required,
    };
    const capabilityDowngrades = this.dependencies.storyRunner.describeCapabilityDowngrades?.(promptMetadata) ?? [];
    const baseShaAtLaunch =
      (await this.dependencies.gitInspector.snapshotBaseSha?.({
        git: this.dependencies.config.git,
        cwdAbs: childCwd,
      })) ?? null;
    const activeChild = {
      storyId: story.id,
      launchId: buildLaunchId(story.id, startedAt),
      expectedBranch: preparedWorkspace.expectedBranch,
      expectedWorktreePath: preparedWorkspace.expectedWorktreePath,
      startedAt,
      lastSupervisorPollAt: null,
      lastObservedChildProgressAt: null,
      progressSource: null,
      lastHeartbeatAt: null,
    };
    const launchRecord: ChildLaunchRecord = {
      ...activeChild,
      runId: this.state.runId,
      status: 'requested',
      updatedAt: startedAt,
      trackerPath: story.metadata.trackerPath,
      childCwd,
      baseShaAtLaunch,
      promptHash,
      profileName: profile.name,
      profileTaskType: profile.taskType,
      promptTemplate: promptMetadata.template,
      structuredOutputSchema: promptMetadata.structuredOutputSchema,
      structuredOutputRequired: promptMetadata.structuredOutputRequired,
      capabilityDowngrades,
      sessionId: null,
      sessionLogPath: null,
    };
    const startup = startupSignal();
    this.state = {
      ...this.state,
      active: [...this.state.active, story.id],
      activeChildren: [...(this.state.activeChildren ?? []), activeChild],
    };
    await this.journal.recordChildLaunch(launchRecord);
    await this.journal.record('child-launch-requested', {
      storyId: story.id,
      launchId: launchRecord.launchId,
      expectedBranch: launchRecord.expectedBranch,
      expectedWorktreePath: launchRecord.expectedWorktreePath,
      profileName: launchRecord.profileName,
      profileTaskType: launchRecord.profileTaskType,
      promptTemplate: launchRecord.promptTemplate,
      promptHash: launchRecord.promptHash,
      structuredOutputSchema: launchRecord.structuredOutputSchema,
      structuredOutputRequired: launchRecord.structuredOutputRequired,
      capabilityDowngrades: launchRecord.capabilityDowngrades,
    });
    await this.writeState();
    await this.writeLiveMetrics();
    return {
      record: launchRecord,
      prompt,
      profile,
      promptMetadata,
      claim,
      startup: startup.promise,
      resolveStartup: startup.resolve,
    };
  }

  private async executeChild(story: WorkflowStory, launch: PreparedChildLaunch): Promise<SettledStoryRun> {
    const noProgressTimeoutMs = this.dependencies.config.orchestrator.childNoProgressTimeoutMs;
    const startupTimeoutMs = this.dependencies.config.orchestrator.childStartupTimeoutMs;
    const maxRuntimeMs = this.dependencies.config.orchestrator.childMaxRuntimeMs;
    const timer = this.dependencies.childTimer ?? defaultChildTimer;
    const startedAtMs = this.dependencies.clock.nowMs();
    let startupTimeoutHandle: unknown;
    let noProgressTimeoutHandle: unknown;
    let maxRuntimeTimeoutHandle: unknown;
    let heartbeatHandle: unknown;
    let rejectNoProgressTimeout: ((error: Error) => void) | null = null;
    let supervisorPollWrite: Promise<void> = Promise.resolve();
    let startupSettled = false;
    let childLaunchedRecorded = false;
    let terminalStartupFailure = false;
    const childAbortController = new AbortController();
    this.activeChildAbortControllers.set(story.id, childAbortController);

    const abortChildStartup = (message: string): void => {
      terminalStartupFailure = true;
      if (!childAbortController.signal.aborted) childAbortController.abort(new Error(message));
    };

    const refreshNoProgressTimeout = (): void => {
      if (noProgressTimeoutHandle !== undefined) timer.clearTimeout(noProgressTimeoutHandle);
      noProgressTimeoutHandle = timer.setTimeout(() => {
        rejectNoProgressTimeout?.(new Error('child-no-progress-timeout'));
      }, noProgressTimeoutMs);
    };

    const startSupervisorPolling = (): void => {
      if (heartbeatHandle !== undefined) return;
      heartbeatHandle = timer.setInterval(() => {
        const pollAt = this.dependencies.clock.now();
        this.state = {
          ...this.state,
          activeChildren: this.state.activeChildren?.map((entry) =>
            entry.storyId === story.id ? { ...entry, lastSupervisorPollAt: pollAt } : entry,
          ),
        };
        supervisorPollWrite = supervisorPollWrite.then(async () => {
          const updated = await this.journal.updateChildLaunch(launch.record, { lastSupervisorPollAt: pollAt });
          if (launch.record.status === 'launched' || launch.record.status === 'requested') launch.record = updated;
        });
        void this.journal.record('child-supervisor-poll', {
          storyId: story.id,
          launchId: launch.record.launchId,
          elapsedMs: this.dependencies.clock.nowMs() - startedAtMs,
        });
      }, heartbeatIntervalMs(noProgressTimeoutMs));
    };

    const acknowledgeStartup = async (
      fields: Partial<ChildLaunchRecord>,
      event: {
        type: 'session-linked';
        sessionId: string;
        sessionLogPath: string | null;
        progressSource: ChildProgressSource;
      } | null = null,
    ): Promise<void> => {
      if (terminalStartupFailure || childAbortController.signal.aborted) return;
      const progressAt = this.dependencies.clock.now();
      if (startupTimeoutHandle !== undefined) timer.clearTimeout(startupTimeoutHandle);
      this.state = {
        ...this.state,
        activeChildren: this.state.activeChildren?.map((entry) =>
          entry.storyId === story.id
            ? {
                ...entry,
                lastObservedChildProgressAt: progressAt,
                progressSource: fields.progressSource ?? entry.progressSource,
                lastHeartbeatAt: progressAt,
              }
            : entry,
        ),
      };
      launch.record = await this.journal.updateChildLaunch(launch.record, {
        status: 'launched',
        ...fields,
        lastObservedChildProgressAt: progressAt,
        lastHeartbeatAt: progressAt,
      });
      this.metrics.observeChildProgress(story.id, {
        sessionLogPath: event?.sessionLogPath ?? fields.sessionLogPath ?? launch.record.sessionLogPath,
        latestProgress: event ? 'session linked' : undefined,
      });
      if (!childLaunchedRecorded) {
        childLaunchedRecorded = true;
        await this.journal.record('child-launched', {
          storyId: story.id,
          launchId: launch.record.launchId,
          expectedBranch: launch.record.expectedBranch,
          expectedWorktreePath: launch.record.expectedWorktreePath,
        });
      }
      if (event) {
        await this.journal.record('child-session-linked', {
          storyId: story.id,
          launchId: launch.record.launchId,
          sessionId: event.sessionId,
          sessionLogPath: event.sessionLogPath,
          progressSource: event.progressSource,
        });
      }
      let resolveStartupAfterCheckpoint = false;
      if (!startupSettled) {
        startupSettled = true;
        resolveStartupAfterCheckpoint = true;
      }
      refreshNoProgressTimeout();
      startSupervisorPolling();
      await this.writeState();
      await this.writeLiveMetrics();
      if (resolveStartupAfterCheckpoint) launch.resolveStartup('acknowledged');
    };

    const handleLifecycle = async (event: ChildLifecycleEvent): Promise<void> => {
      if (event.type === 'session-linked') {
        await acknowledgeStartup(
          {
            sessionId: event.sessionId,
            sessionLogPath: event.sessionLogPath ?? null,
            progressSource: event.progressSource,
          },
          {
            type: 'session-linked',
            sessionId: event.sessionId,
            sessionLogPath: event.sessionLogPath ?? null,
            progressSource: event.progressSource,
          },
        );
        return;
      }

      await acknowledgeStartup({ progressSource: event.progressSource });
      this.metrics.observeChildProgress(story.id, {
        sessionLogPath: launch.record.sessionLogPath,
        latestProgress: event.message,
      });
      if (event.journal === false) return;
      await this.journal.record('child-progress', {
        storyId: story.id,
        launchId: launch.record.launchId,
        message: event.message,
        progressToken: event.progressToken ?? null,
        progressSource: event.progressSource,
        eventType: event.eventType ?? null,
        elapsedMs: this.dependencies.clock.nowMs() - startedAtMs,
      });
    };

    try {
      const run = this.dependencies.storyRunner.runStory({
        story,
        prompt: launch.prompt,
        cwd: launch.record.childCwd,
        metadata: { runId: this.state.runId, launchId: launch.record.launchId },
        profile: launch.profile,
        promptMetadata: launch.promptMetadata,
        signal: childAbortController.signal,
        onLifecycle: handleLifecycle,
      });
      const maxRuntimeTimeout = new Promise<StoryRunResult>((_, reject) => {
        maxRuntimeTimeoutHandle = timer.setTimeout(() => reject(new Error('child-max-runtime-timeout')), maxRuntimeMs);
      });
      const startupTimeout = new Promise<StoryRunResult>((_, reject) => {
        startupTimeoutHandle = timer.setTimeout(() => {
          abortChildStartup('child-startup-timeout');
          reject(new Error('child-startup-timeout'));
        }, startupTimeoutMs);
      });
      const noProgressTimeout = new Promise<StoryRunResult>((_, reject) => {
        rejectNoProgressTimeout = reject;
      });
      const result: StoryRunResult = await Promise.race([run, startupTimeout, noProgressTimeout, maxRuntimeTimeout]);
      if (heartbeatHandle !== undefined) timer.clearInterval(heartbeatHandle);
      heartbeatHandle = undefined;
      await supervisorPollWrite;
      const completedAt = this.metrics.complete(story.id);
      if (!startupSettled) {
        await acknowledgeStartup({
          sessionId: result.sessionId,
          sessionLogPath: result.metrics?.sessionLogPath ?? null,
          progressSource: result.sessionId ? 'session-linked' : 'structured',
        });
      }
      this.state = this.removeActiveChild(story.id);
      if (result.metrics) {
        this.metrics.updateChildMetric(story.id, result.metrics);
        await this.dependencies.artifactStore.writeJson(`children/${safeName(story.id)}.metrics.json`, result.metrics);
      }
      await this.journal.updateChildLaunch(launch.record, {
        status: 'settled',
        sessionId: result.sessionId,
        sessionLogPath: result.metrics?.sessionLogPath ?? launch.record.sessionLogPath,
      });
      return {
        storyId: story.id,
        ok: true,
        sessionId: result.sessionId,
        content: result.content,
        rawResult: result.rawResult,
        invocation: result.invocation,
        evidence: result.evidence,
        completedAt,
        metrics: result.metrics,
        baseShaAtLaunch: launch.record.baseShaAtLaunch,
      };
    } catch (error) {
      const completedAt = this.metrics.complete(story.id);
      const message = error instanceof Error ? error.message : String(error);
      const classification = this.dependencies.storyRunner.classifyError?.(error) ?? {
        supervisionLost: isSupervisionLostError(message),
        recoverable: isSupervisionLostError(message),
      };
      const isSupervisionLost = classification.supervisionLost;
      const isStartupFailure = !isSupervisionLost && (!startupSettled || message === 'child-startup-timeout');
      if (heartbeatHandle !== undefined) timer.clearInterval(heartbeatHandle);
      heartbeatHandle = undefined;
      await supervisorPollWrite;
      this.state = this.removeActiveChild(story.id);
      if (isStartupFailure) {
        abortChildStartup(message);
        if (!startupSettled) {
          startupSettled = true;
          launch.resolveStartup('failed');
        }
        launch.record = await this.journal.updateChildLaunch(launch.record, { status: 'startup_failed' });
        await this.releaseStartupClaim(story, launch);
        await this.journal.record('child-startup-failed', {
          storyId: story.id,
          launchId: launch.record.launchId,
          error: message,
        });
      } else if (isSupervisionLost) {
        this.state = {
          ...this.state,
          status: 'supervision_lost',
          blockedStoryId: story.id,
          blockedReason: message,
        };
        await this.journal.updateChildLaunch(launch.record, { status: 'supervision_lost' });
        await this.recordRecoveryGuard(story, launch.record);
        await this.journal.record('child-supervision-lost', {
          storyId: story.id,
          launchId: launch.record.launchId,
          error: message,
        });
      } else {
        await this.journal.updateChildLaunch(launch.record, { status: 'settled' });
      }
      return {
        storyId: story.id,
        ok: false,
        sessionId: null,
        error: message,
        completedAt,
        baseShaAtLaunch: launch.record.baseShaAtLaunch,
      };
    } finally {
      this.activeChildAbortControllers.delete(story.id);
      if (startupTimeoutHandle !== undefined) timer.clearTimeout(startupTimeoutHandle);
      if (noProgressTimeoutHandle !== undefined) timer.clearTimeout(noProgressTimeoutHandle);
      if (maxRuntimeTimeoutHandle !== undefined) timer.clearTimeout(maxRuntimeTimeoutHandle);
      if (heartbeatHandle !== undefined) timer.clearInterval(heartbeatHandle);
    }
  }

  private async processSettled(settled: SettledStoryRun, stories?: WorkflowStory[]): Promise<ReturnEvaluation> {
    const returnedStories = stories ?? (await this.dependencies.storySource.listStories());
    await this.journal.writeStorySnapshot(`after-${settled.storyId}`, returnedStories);
    const evaluation = await this.completionGate.evaluate(settled, returnedStories);
    const settledWithEvidence = {
      ...settled,
      ...(evaluation.commitEvidence ? { commitEvidence: evaluation.commitEvidence } : {}),
      completionAuthority: evaluation.authority,
      completionAuthoritySource: evaluation.source,
    };
    await this.journal.record('completion_authority', {
      storyId: settled.storyId,
      authority: evaluation.authority,
      source: evaluation.source,
      complete: evaluation.complete,
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

  private async recordRecoveryGuard(story: WorkflowStory, launch: ChildLaunchRecord): Promise<void> {
    try {
      const evidence = await this.dependencies.gitInspector.inspectStory({
        story,
        git: this.dependencies.config.git,
        cwdAbs: launch.childCwd,
        baseShaAtLaunch: launch.baseShaAtLaunch,
      });
      const result = evaluateRecoveryGuard({
        storyId: story.id,
        now: this.dependencies.clock.now(),
        staleAfterMs: this.dependencies.config.orchestrator.childNoProgressTimeoutMs,
        session: {
          sessionId: launch.sessionId,
          lastHeartbeatAt: launch.lastHeartbeatAt,
        },
        git: {
          expectedBranch: launch.expectedBranch,
          remoteBranchExists: null,
          latestCommitSha: evidence.headSha,
          worktreeClean: !evidence.uncommittedChanges,
        },
        pr: prRecoveryState(story),
        trackerOnBase: {
          status: story.status,
          complete: this.dependencies.config.statuses.complete.includes(story.status),
        },
      });
      await this.journal.record(recoveryEventType(result.decision), {
        storyId: story.id,
        launchId: launch.launchId,
        decision: result.decision,
        evidence: result.evidence,
      });
    } catch (error) {
      await this.journal.record('parent_takeover_blocked', {
        storyId: story.id,
        launchId: launch.launchId,
        decision: 'manual_recovery_required',
        evidence: [
          `recovery guard could not inspect child evidence: ${error instanceof Error ? error.message : String(error)}`,
        ],
      });
    }
  }

  private async releaseStartupClaim(story: WorkflowStory, launch: PreparedChildLaunch): Promise<void> {
    if (!launch.claim.trackerClaimed) return;
    if (
      launch.record.sessionId !== null ||
      launch.record.lastObservedChildProgressAt !== null ||
      launch.record.lastHeartbeatAt !== null
    ) {
      await this.journal.record('tracker-claim-release-skipped', {
        storyId: story.id,
        launchId: launch.record.launchId,
        reason: 'child startup has acknowledgement evidence',
      });
      return;
    }
    try {
      const result = await releaseTrackerClaim({
        config: this.dependencies.config,
        story,
        owner: launch.claim.owner,
        previousStatus: launch.claim.previousStatus,
      });
      if (result.ok) {
        await this.journal.record('tracker-claim-released', {
          storyId: story.id,
          launchId: launch.record.launchId,
          fromStatus: result.fromStatus,
          toStatus: result.toStatus,
          owner: launch.claim.owner,
        });
      } else {
        await this.journal.record('tracker-claim-release-skipped', {
          storyId: story.id,
          launchId: launch.record.launchId,
          reason: result.reason,
        });
      }
    } catch (error) {
      await this.journal.record('tracker-claim-release-skipped', {
        storyId: story.id,
        launchId: launch.record.launchId,
        reason: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.trackerClaims.delete(story.id);
    }
  }

  private async releaseUnlaunchedClaim(claim: ClaimedWorkflowStory, reason: string): Promise<void> {
    if (!claim.trackerClaimed) return;
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
          reason,
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
      this.trackerClaims.delete(claim.story.id);
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

  private removeActiveChild(storyId: string): RunState {
    return {
      ...this.state,
      active: this.state.active.filter((entry) => entry !== storyId),
      activeChildren: this.state.activeChildren?.filter((entry) => entry.storyId !== storyId),
    };
  }

  private findDispatchBatchConflict(stories: WorkflowStory[]): { storyId: string; reason: string } | null {
    const seenBranches = new Set<string>();
    const seenWorktrees = new Set<string>();
    for (const story of stories) {
      const expectedBranch = renderExpectedBranch(story, this.dependencies.config.git);
      const expectedWorktreePath = renderExpectedWorktreePath(
        this.dependencies.config.workspace.rootAbs,
        this.dependencies.config.git,
        story,
      );
      if (seenBranches.has(expectedBranch)) {
        return { storyId: story.id, reason: `duplicate active launch for ${story.id}` };
      }
      if (expectedWorktreePath !== null && seenWorktrees.has(expectedWorktreePath)) {
        return { storyId: story.id, reason: `duplicate active launch for ${story.id}` };
      }
      seenBranches.add(expectedBranch);
      if (expectedWorktreePath !== null) seenWorktrees.add(expectedWorktreePath);
    }
    return null;
  }
}

function heartbeatIntervalMs(timeoutMs: number): number {
  return Math.max(1, Math.floor(timeoutMs / 4));
}

function isSupervisionLostError(message: string): boolean {
  return /child-(?:no-progress|max-runtime)-timeout|child-timeout/i.test(message);
}

function recoveryEventType(decision: string): 'parent_takeover_allowed' | 'parent_takeover_blocked' {
  return decision === 'safe_to_take_over' ? 'parent_takeover_allowed' : 'parent_takeover_blocked';
}

function prRecoveryState(story: WorkflowStory): {
  state: 'none' | 'unknown';
  number: number | null;
  mergedAt: null;
} {
  const value = story.metadata.pr;
  if (!value || value === '—') return { state: 'none', number: null, mergedAt: null };
  return { state: 'unknown', number: pullRequestNumber(value), mergedAt: null };
}

function pullRequestNumber(value: string): number | null {
  const match = value.match(/(?:pull\/|#|PR\s*#)(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

interface PreparedChildLaunch {
  record: ChildLaunchRecord;
  prompt: string;
  profile: ResolvedWorkflowConfig['agents']['resolved']['implementStory'];
  promptMetadata: StoryPromptMetadata;
  claim: ClaimedWorkflowStory;
  startup: Promise<StartupOutcome>;
  resolveStartup: (outcome: StartupOutcome) => void;
}

interface ClaimedWorkflowStory {
  story: WorkflowStory;
  owner: string;
  previousStatus: string;
  trackerClaimed: boolean;
}

type StartupOutcome = 'acknowledged' | 'failed';

function startupSignal(): { promise: Promise<StartupOutcome>; resolve: (outcome: StartupOutcome) => void } {
  let resolveStartup: (outcome: StartupOutcome) => void = () => undefined;
  const promise = new Promise<StartupOutcome>((resolve) => {
    resolveStartup = resolve;
  });
  return { promise, resolve: resolveStartup };
}
