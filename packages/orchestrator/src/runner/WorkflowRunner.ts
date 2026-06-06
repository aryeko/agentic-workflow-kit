import path from 'node:path';
import pLimit from 'p-limit';

import { buildGenericPrompt } from '../drivers/codex-mcp/toolInput.js';
import type { StoryRunner, StoryRunResult } from '../drivers/StoryRunner.js';
import type { GitInspector } from '../git/GitInspector.js';
import { safeName } from '../internal/guards.js';
import { selectDispatchableStories } from '../scheduler/scheduler.js';
import type {
  ArtifactStore,
  Clock,
  Logger,
  ResolvedWorkflowConfig,
  RunState,
  StorySource,
  WorkflowStory,
} from '../types.js';
import { CompletionGate, type ReturnEvaluation } from './CompletionGate.js';
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

    const settled = await this.launchChild(story);
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

      const launched: WorkflowStory[] = [];
      for (const story of dispatchable) {
        await this.recordChildLaunch(story);
        launched.push(story);
      }

      for (const story of launched) {
        active.set(
          story.id,
          limit(() => this.executeChild(story)),
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

  private async launchChild(story: WorkflowStory): Promise<SettledStoryRun> {
    await this.recordChildLaunch(story);
    return await this.executeChild(story);
  }

  private async recordChildLaunch(story: WorkflowStory): Promise<void> {
    this.metrics.start(story.id);
    this.state = { ...this.state, active: [...this.state.active, story.id] };
    await this.journal.record('child-launched', { storyId: story.id });
    await this.writeState();
    await this.writeLiveMetrics();
  }

  private async executeChild(story: WorkflowStory): Promise<SettledStoryRun> {
    const timeoutMs = this.dependencies.config.orchestrator.childTimeoutMs;
    const timer = this.dependencies.childTimer ?? defaultChildTimer;
    const startedAtMs = this.dependencies.clock.nowMs();
    const childCwd = this.dependencies.config.codex.childSession.cwdAbs;
    const baseShaAtLaunch =
      (await this.dependencies.gitInspector.snapshotBaseSha?.({
        git: this.dependencies.config.git,
        cwdAbs: childCwd,
      })) ?? null;
    let timeoutHandle: unknown;
    let heartbeatHandle: unknown;
    try {
      const run = this.dependencies.storyRunner.runStory({
        story,
        prompt: buildGenericPrompt(story, this.dependencies.config),
        cwd: childCwd,
        metadata: { runId: this.state.runId },
      });
      const timeout = new Promise<StoryRunResult>((_, reject) => {
        timeoutHandle = timer.setTimeout(() => reject(new Error('child-timeout')), timeoutMs);
      });
      heartbeatHandle = timer.setInterval(() => {
        void this.journal.record('child-heartbeat', {
          storyId: story.id,
          elapsedMs: this.dependencies.clock.nowMs() - startedAtMs,
        });
      }, heartbeatIntervalMs(timeoutMs));
      const result: StoryRunResult = await Promise.race([run, timeout]);
      const completedAt = this.metrics.complete(story.id);
      this.state = { ...this.state, active: this.state.active.filter((entry) => entry !== story.id) };
      if (result.metrics) {
        this.metrics.updateChildMetric(story.id, result.metrics);
        await this.dependencies.artifactStore.writeJson(`children/${safeName(story.id)}.metrics.json`, result.metrics);
      }
      return {
        storyId: story.id,
        ok: true,
        sessionId: result.sessionId,
        content: result.content,
        rawResult: result.rawResult,
        invocation: result.invocation,
        completedAt,
        metrics: result.metrics,
        baseShaAtLaunch,
      };
    } catch (error) {
      const completedAt = this.metrics.complete(story.id);
      this.state = { ...this.state, active: this.state.active.filter((entry) => entry !== story.id) };
      return {
        storyId: story.id,
        ok: false,
        sessionId: null,
        error: error instanceof Error ? error.message : String(error),
        completedAt,
        baseShaAtLaunch,
      };
    } finally {
      if (timeoutHandle !== undefined) timer.clearTimeout(timeoutHandle);
      if (heartbeatHandle !== undefined) timer.clearInterval(heartbeatHandle);
    }
  }

  private async processSettled(settled: SettledStoryRun, stories?: WorkflowStory[]): Promise<ReturnEvaluation> {
    const returnedStories = stories ?? (await this.dependencies.storySource.listStories());
    await this.journal.writeStorySnapshot(`after-${settled.storyId}`, returnedStories);
    const evaluation = await this.completionGate.evaluate(settled, returnedStories);
    const settledWithEvidence = evaluation.commitEvidence
      ? { ...settled, commitEvidence: evaluation.commitEvidence }
      : settled;
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
    this.state = { ...this.state, status: 'blocked', blockedStoryId: storyId, blockedReason: reason };
    this.dependencies.logger.warn('run blocked', { storyId, reason });
  }

  private async finish(): Promise<RunState> {
    if (this.state.status !== 'blocked' && this.state.status !== 'dry-run') {
      this.state = { ...this.state, status: 'complete' };
      await this.journal.record('run-complete');
    } else if (this.state.status === 'blocked') {
      await this.journal.record('run-blocked', {
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
}

function heartbeatIntervalMs(timeoutMs: number): number {
  return Math.max(1, Math.floor(timeoutMs / 4));
}
