import path from 'node:path';
import pLimit from 'p-limit';

import { buildGenericPrompt } from '../drivers/codex-mcp/toolInput.js';
import type { ChildLifecycleEvent, StoryRunner, StoryRunResult } from '../drivers/StoryRunner.js';
import type { GitInspector } from '../git/GitInspector.js';
import { safeName } from '../internal/guards.js';
import { selectDispatchableStories } from '../scheduler/scheduler.js';
import { claimTrackerRow, trackerFileExists } from '../tracks/trackerClaimer.js';
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
import { CompletionGate, type ReturnEvaluation } from './CompletionGate.js';
import { findDuplicateLaunch } from './DuplicateLaunchGuard.js';
import { buildLaunchId, hashPrompt, renderExpectedBranch, renderExpectedWorktreePath } from './launchMetadata.js';
import { MetricsCollector } from './MetricsCollector.js';
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

  constructor(private readonly dependencies: WorkflowRunnerDependencies) {
    this.metrics = new MetricsCollector(dependencies.clock);
    this.journal = new RunJournal({ artifactStore: dependencies.artifactStore, clock: dependencies.clock });
    this.completionGate = new CompletionGate({
      gitInspector: dependencies.gitInspector,
      statuses: dependencies.config.statuses,
      git: dependencies.config.git,
      pr: dependencies.config.pr,
      childCwdAbs: dependencies.config.codex.childSession.cwdAbs,
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

    const settled = await this.launchChild(story, { force: options.force === true });
    if (!settled.ok) {
      await this.recordSettledChild(settled);
      await this.journal.record('child-error', { storyId: settled.storyId, error: settled.error });
      this.blockOnce(story.id, settled.error ?? 'child session failed');
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

  async runEligible(): Promise<RunState> {
    await this.journal.writeRunMetadata(this.state);
    await this.journal.writeConfigSnapshot(this.dependencies.config);
    await this.journal.record('run-started', {
      command: 'run-eligible',
      maxParallel: this.dependencies.config.orchestrator.maxParallel,
    });

    let stories = await this.dependencies.storySource.listStories();
    await this.journal.writeStorySnapshot('initial', stories);
    const active = new Map<string, Promise<SettledStoryRun>>();
    const limit = pLimit(this.dependencies.config.orchestrator.maxParallel);
    let stopLaunching = false;

    const launchAvailable = async (): Promise<void> => {
      if (stopLaunching) return;

      const dispatchable = selectDispatchableStories(stories, {
        maxParallel: this.dependencies.config.orchestrator.maxParallel,
        activeIds: new Set(active.keys()),
      });
      const batchConflict = this.findDispatchBatchConflict(dispatchable);
      if (batchConflict) {
        this.blockOnce(batchConflict.storyId, batchConflict.reason);
        await this.journal.record('child-launch-blocked', batchConflict);
        await this.writeState();
        await this.writeLiveMetrics();
        stopLaunching = true;
        return;
      }

      const launched: Array<{ story: WorkflowStory; launch: PreparedChildLaunch }> = [];
      for (const story of dispatchable) {
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
        launched.push({ story: claimedStory, launch });
      }

      for (const { story, launch } of launched) {
        active.set(
          story.id,
          limit(() => this.executeChild(story, launch)),
        );
      }
    };

    await launchAvailable();
    if (active.size === 0) return await this.finish();

    while (active.size > 0) {
      const settled = await Promise.race(active.values());
      active.delete(settled.storyId);

      if (!settled.ok) {
        await this.recordSettledChild(settled);
        await this.journal.record('child-error', { storyId: settled.storyId, error: settled.error });
        this.blockOnce(settled.storyId, settled.error ?? 'child session failed');
        stopLaunching = this.dependencies.config.orchestrator.stopLaunchingOnBlocked;
        await this.writeState();
        await this.writeLiveMetrics();
        await launchAvailable();
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
        stopLaunching = this.dependencies.config.orchestrator.stopLaunchingOnBlocked;
        await launchAvailable();
        continue;
      }

      await this.journal.record('child-complete', { storyId: settled.storyId, sessionId: settled.sessionId });
      await launchAvailable();
    }

    return await this.finish();
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
    const claimedStory = await this.claimBeforeLaunch(story, options);
    if (!claimedStory) {
      return {
        storyId: story.id,
        ok: false,
        sessionId: null,
        error: this.state.blockedReason ?? 'tracker claim failed',
        completedAt: this.dependencies.clock.now(),
        baseShaAtLaunch: null,
      };
    }
    const launch = await this.recordChildLaunch(claimedStory);
    if (!launch) {
      return {
        storyId: claimedStory.id,
        ok: false,
        sessionId: null,
        error: this.state.blockedReason ?? 'duplicate active launch',
        completedAt: this.dependencies.clock.now(),
        baseShaAtLaunch: null,
      };
    }
    return await this.executeChild(claimedStory, launch);
  }

  private async claimBeforeLaunch(
    story: WorkflowStory,
    options: { force?: boolean } = {},
  ): Promise<WorkflowStory | null> {
    if (!(await trackerFileExists(this.dependencies.config, story))) return story;
    const owner = `awk:${this.state.runId}:${story.id}`;
    const claim = await claimTrackerRow({ config: this.dependencies.config, story, owner, force: options.force });
    if (!claim.ok) {
      this.blockOnce(story.id, claim.reason);
      await this.journal.record('tracker-claim-blocked', { storyId: story.id, reason: claim.reason });
      await this.writeState();
      await this.writeLiveMetrics();
      return null;
    }
    await this.journal.record('tracker-claimed', { storyId: story.id, owner });
    return claim.story;
  }

  private async preflightDuplicateLaunch(story: WorkflowStory): Promise<boolean> {
    const duplicate = await findDuplicateLaunch({
      story,
      config: this.dependencies.config,
      activeChildren: this.state.activeChildren ?? [],
    });
    if (!duplicate) return true;
    this.blockOnce(story.id, duplicate.reason);
    await this.journal.record('child-launch-blocked', {
      storyId: story.id,
      reason: duplicate.reason,
      duplicateStoryId: duplicate.storyId,
      expectedBranch: duplicate.expectedBranch,
      expectedWorktreePath: duplicate.expectedWorktreePath,
    });
    await this.writeState();
    await this.writeLiveMetrics();
    return false;
  }

  private async recordChildLaunch(story: WorkflowStory): Promise<PreparedChildLaunch | null> {
    this.metrics.start(story.id);
    const startedAt = this.dependencies.clock.now();
    const childCwd = this.dependencies.config.codex.childSession.cwdAbs;
    const prompt = buildGenericPrompt(story, this.dependencies.config);
    const baseShaAtLaunch =
      (await this.dependencies.gitInspector.snapshotBaseSha?.({
        git: this.dependencies.config.git,
        cwdAbs: childCwd,
      })) ?? null;
    const activeChild = {
      storyId: story.id,
      launchId: buildLaunchId(story.id, startedAt),
      expectedBranch: renderExpectedBranch(story, this.dependencies.config.git),
      expectedWorktreePath: renderExpectedWorktreePath(
        this.dependencies.config.workspace.rootAbs,
        this.dependencies.config.git,
        story,
      ),
      startedAt,
      lastHeartbeatAt: null,
    };
    const launchRecord: ChildLaunchRecord = {
      ...activeChild,
      runId: this.state.runId,
      status: 'launched',
      updatedAt: startedAt,
      trackerPath: story.metadata.trackerPath,
      childCwd,
      baseShaAtLaunch,
      promptHash: hashPrompt(prompt),
      sessionId: null,
      sessionLogPath: null,
    };
    this.state = {
      ...this.state,
      active: [...this.state.active, story.id],
      activeChildren: [...(this.state.activeChildren ?? []), activeChild],
    };
    await this.journal.recordChildLaunch(launchRecord);
    await this.journal.record('child-launched', {
      storyId: story.id,
      launchId: launchRecord.launchId,
      expectedBranch: launchRecord.expectedBranch,
      expectedWorktreePath: launchRecord.expectedWorktreePath,
    });
    await this.writeState();
    await this.writeLiveMetrics();
    return { record: launchRecord, prompt };
  }

  private async executeChild(story: WorkflowStory, launch: PreparedChildLaunch): Promise<SettledStoryRun> {
    const noProgressTimeoutMs = this.dependencies.config.orchestrator.childNoProgressTimeoutMs;
    const maxRuntimeMs = this.dependencies.config.orchestrator.childMaxRuntimeMs;
    const timer = this.dependencies.childTimer ?? defaultChildTimer;
    const startedAtMs = this.dependencies.clock.nowMs();
    let noProgressTimeoutHandle: unknown;
    let maxRuntimeTimeoutHandle: unknown;
    let heartbeatHandle: unknown;
    let rejectNoProgressTimeout: ((error: Error) => void) | null = null;

    const refreshNoProgressTimeout = (): void => {
      if (noProgressTimeoutHandle !== undefined) timer.clearTimeout(noProgressTimeoutHandle);
      noProgressTimeoutHandle = timer.setTimeout(() => {
        rejectNoProgressTimeout?.(new Error('child-no-progress-timeout'));
      }, noProgressTimeoutMs);
    };

    const handleLifecycle = async (event: ChildLifecycleEvent): Promise<void> => {
      if (event.type === 'session-linked') {
        launch.record = await this.journal.updateChildLaunch(launch.record, {
          sessionId: event.sessionId,
          sessionLogPath: event.sessionLogPath ?? null,
        });
        await this.journal.record('child-session-linked', {
          storyId: story.id,
          launchId: launch.record.launchId,
          sessionId: event.sessionId,
          sessionLogPath: event.sessionLogPath ?? null,
        });
        refreshNoProgressTimeout();
        return;
      }

      const progressAt = this.dependencies.clock.now();
      this.state = {
        ...this.state,
        activeChildren: this.state.activeChildren?.map((entry) =>
          entry.storyId === story.id ? { ...entry, lastHeartbeatAt: progressAt } : entry,
        ),
      };
      launch.record = await this.journal.updateChildLaunch(launch.record, { lastHeartbeatAt: progressAt });
      await this.journal.record('child-progress', {
        storyId: story.id,
        launchId: launch.record.launchId,
        message: event.message,
        progressToken: event.progressToken ?? null,
        elapsedMs: this.dependencies.clock.nowMs() - startedAtMs,
      });
      await this.writeState();
      await this.writeLiveMetrics();
      refreshNoProgressTimeout();
    };

    try {
      const run = this.dependencies.storyRunner.runStory({
        story,
        prompt: launch.prompt,
        cwd: launch.record.childCwd,
        metadata: { runId: this.state.runId, launchId: launch.record.launchId },
        onLifecycle: handleLifecycle,
      });
      const maxRuntimeTimeout = new Promise<StoryRunResult>((_, reject) => {
        maxRuntimeTimeoutHandle = timer.setTimeout(() => reject(new Error('child-max-runtime-timeout')), maxRuntimeMs);
      });
      const noProgressTimeout = new Promise<StoryRunResult>((_, reject) => {
        rejectNoProgressTimeout = reject;
        refreshNoProgressTimeout();
      });
      heartbeatHandle = timer.setInterval(() => {
        const heartbeatAt = this.dependencies.clock.now();
        this.state = {
          ...this.state,
          activeChildren: this.state.activeChildren?.map((entry) =>
            entry.storyId === story.id ? { ...entry, lastHeartbeatAt: heartbeatAt } : entry,
          ),
        };
        void this.journal.record('child-heartbeat', {
          storyId: story.id,
          launchId: launch.record.launchId,
          elapsedMs: this.dependencies.clock.nowMs() - startedAtMs,
        });
      }, heartbeatIntervalMs(noProgressTimeoutMs));
      const result: StoryRunResult = await Promise.race([run, noProgressTimeout, maxRuntimeTimeout]);
      const completedAt = this.metrics.complete(story.id);
      this.state = this.removeActiveChild(story.id);
      if (result.metrics) {
        this.metrics.updateChildMetric(story.id, result.metrics);
        await this.dependencies.artifactStore.writeJson(`children/${safeName(story.id)}.metrics.json`, result.metrics);
      }
      await this.journal.updateChildLaunch(launch.record, {
        status: 'settled',
        sessionId: result.sessionId,
        sessionLogPath: result.metrics?.sessionLogPath ?? null,
      });
      return {
        storyId: story.id,
        ok: true,
        sessionId: result.sessionId,
        content: result.content,
        rawResult: result.rawResult,
        invocation: result.invocation,
        completedAt,
        metrics: result.metrics,
        baseShaAtLaunch: launch.record.baseShaAtLaunch,
      };
    } catch (error) {
      const completedAt = this.metrics.complete(story.id);
      const message = error instanceof Error ? error.message : String(error);
      const isSupervisionLost = isSupervisionLostError(message);
      this.state = this.removeActiveChild(story.id);
      if (isSupervisionLost) {
        this.state = {
          ...this.state,
          status: 'supervision_lost',
          blockedStoryId: story.id,
          blockedReason: message,
        };
        await this.journal.updateChildLaunch(launch.record, { status: 'supervision_lost' });
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
    };
    await this.journal.record('completion_authority', {
      storyId: settled.storyId,
      authority: evaluation.authority,
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
  }

  private blockOnce(storyId: string, reason: string): void {
    if (this.state.status === 'blocked') return;
    if (this.state.status === 'supervision_lost') return;
    this.state = { ...this.state, status: 'blocked', blockedStoryId: storyId, blockedReason: reason };
    this.dependencies.logger.warn('run blocked', { storyId, reason });
  }

  private async finish(): Promise<RunState> {
    if (
      this.state.status !== 'blocked' &&
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
    await this.journal.writeLiveMetrics(this.state, this.metrics.observedChildMetrics());
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
  return /child-(?:no-progress|max-runtime)-timeout|child-timeout|Codex MCP request timed out/i.test(message);
}

interface PreparedChildLaunch {
  record: ChildLaunchRecord;
  prompt: string;
}
