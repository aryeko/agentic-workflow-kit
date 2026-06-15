import pLimit from 'p-limit';
import type { ResolvedWorkflowConfig, RunState, WorkflowStory } from '../types.js';
import { renderExpectedBranch, renderExpectedWorktreePath } from './launchMetadata.js';
import type { RunJournal, SettledStoryRun } from './RunJournal.js';

interface ClaimedWorkflowStory {
  story: WorkflowStory;
}

interface PreparedChildLaunch {
  startup: Promise<'acknowledged' | 'failed'>;
}

interface SettledEvaluation {
  complete: boolean;
  reason: string;
  returnedStory?: WorkflowStory | null;
}

interface EligibleWorkflowRunner {
  state: RunState;
  dependencies: {
    config: ResolvedWorkflowConfig;
    storySource: {
      listStories(): Promise<WorkflowStory[]>;
    };
  };
  budgetControlDecision: { stopNewLaunches?: boolean; reason?: string | null } | null;
  journal: Pick<RunJournal, 'record' | 'writeConfigSnapshot' | 'writeRunMetadata' | 'writeStorySnapshot'>;
  applyPendingAbortControl(stage: string): Promise<boolean>;
  blockOnce(storyId: string, reason: string): void;
  writeState(): Promise<void>;
  writeLiveMetrics(): Promise<void>;
  preflightDuplicateLaunch(story: WorkflowStory): Promise<boolean>;
  claimBeforeLaunch(story: WorkflowStory): Promise<ClaimedWorkflowStory | null>;
  recordChildLaunch(claim: ClaimedWorkflowStory): Promise<PreparedChildLaunch | null>;
  executeChild(story: WorkflowStory, launch: PreparedChildLaunch): Promise<SettledStoryRun>;
  finish(): Promise<RunState>;
  recordSettledChild(settled: SettledStoryRun): Promise<void>;
  processSettled(settled: SettledStoryRun, stories: WorkflowStory[]): Promise<SettledEvaluation>;
}

export async function runEligibleWorkflow(
  runner: unknown,
  options: { returnAfterInitialLaunch?: boolean } = {},
): Promise<RunState> {
  const self = runner as EligibleWorkflowRunner;
  await self.journal.writeRunMetadata(self.state);
  await self.journal.writeConfigSnapshot(self.dependencies.config);
  await self.journal.record('run-started', {
    command: 'run-eligible',
    maxParallel: self.dependencies.config.orchestrator.maxParallel,
  });

  let stories = await self.dependencies.storySource.listStories();
  await self.journal.writeStorySnapshot('initial', stories);
  const active = new Map<string, Promise<SettledStoryRun>>();
  const attemptedStoryIds = new Set<string>();
  const limit = pLimit(self.dependencies.config.orchestrator.maxParallel);
  let stopLaunching = false;

  const launchAvailable = async (): Promise<void> => {
    stopLaunching = self.budgetControlDecision?.stopNewLaunches === true || stopLaunching;
    if (stopLaunching) return;
    if (await self.applyPendingAbortControl('before-launch')) {
      stopLaunching = true;
      return;
    }

    const activeIds = new Set(active.keys());
    const availableSlots = Math.max(0, self.dependencies.config.orchestrator.maxParallel - activeIds.size);
    const dispatchable = stories
      .filter((story: WorkflowStory) => story.eligible && !activeIds.has(story.id) && !attemptedStoryIds.has(story.id))
      .slice(0, availableSlots);
    const batchConflict = findDispatchBatchConflict(dispatchable, self.dependencies.config);
    if (batchConflict) {
      self.blockOnce(batchConflict.storyId, batchConflict.reason);
      await self.journal.record('child-launch-blocked', batchConflict);
      await self.writeState();
      await self.writeLiveMetrics();
      stopLaunching = true;
      return;
    }

    for (const story of dispatchable) {
      if (await self.applyPendingAbortControl('before-launch')) {
        stopLaunching = true;
        break;
      }
      if (!(await self.preflightDuplicateLaunch(story))) {
        stopLaunching = true;
        break;
      }
      const claimedStory = await self.claimBeforeLaunch(story);
      if (!claimedStory) {
        stopLaunching = true;
        break;
      }
      const launch = await self.recordChildLaunch(claimedStory);
      if (!launch) {
        stopLaunching = true;
        break;
      }
      attemptedStoryIds.add(claimedStory.story.id);
      active.set(
        claimedStory.story.id,
        limit(() => self.executeChild(claimedStory.story, launch)),
      );
      const startup = await launch.startup;
      stopLaunching = self.budgetControlDecision?.stopNewLaunches === true || stopLaunching;
      if (stopLaunching) break;
      if (startup === 'failed') {
        stopLaunching = self.dependencies.config.orchestrator.stopLaunchingOnBlocked;
        break;
      }
      if (await self.applyPendingAbortControl('after-startup')) {
        stopLaunching = true;
        break;
      }
    }
  };

  await launchAvailable();
  if (active.size === 0) return await self.finish();

  const supervise = async (): Promise<RunState> => {
    while (active.size > 0) {
      const settled = await Promise.race(active.values());
      active.delete(settled.storyId);
      const abortRequested = await self.applyPendingAbortControl('child-settled');
      if (abortRequested) {
        stopLaunching = true;
      }

      if (!settled.ok) {
        await self.recordSettledChild(settled);
        await self.journal.record('child-error', { storyId: settled.storyId, error: settled.error });
        if (abortRequested) continue;
        self.blockOnce(settled.storyId, settled.error ?? 'child session failed');
        stopLaunching =
          self.budgetControlDecision?.stopNewLaunches === true ||
          self.dependencies.config.orchestrator.stopLaunchingOnBlocked;
        await self.writeState();
        await self.writeLiveMetrics();
        if (!stopLaunching) await launchAvailable();
        continue;
      }
      if (abortRequested) {
        await self.recordSettledChild(settled);
        continue;
      }

      try {
        stories = await self.dependencies.storySource.listStories();
      } catch (error) {
        const reason = trackerRefreshFailureReason(error);
        self.blockOnce(settled.storyId, reason);
        await self.journal.record('tracker-refresh-failed', { storyId: settled.storyId, reason });
        await self.recordSettledChild(settled);
        stopLaunching = true;
        continue;
      }
      const evaluation = await self.processSettled(settled, stories);

      if (!evaluation.complete) {
        self.blockOnce(settled.storyId, evaluation.reason);
        await self.journal.record('story-not-complete', {
          storyId: settled.storyId,
          status: evaluation.returnedStory?.status ?? null,
        });
        stopLaunching =
          self.budgetControlDecision?.stopNewLaunches === true ||
          self.dependencies.config.orchestrator.stopLaunchingOnBlocked;
        if (!stopLaunching) await launchAvailable();
        continue;
      }

      await self.journal.record('child-complete', { storyId: settled.storyId, sessionId: settled.sessionId });
      stopLaunching = self.budgetControlDecision?.stopNewLaunches === true || stopLaunching;
      if (!stopLaunching) await launchAvailable();
    }

    if (self.budgetControlDecision?.stopNewLaunches) {
      self.blockOnce('run-eligible', self.budgetControlDecision.reason ?? 'budget policy stopped new launches');
    }
    return await self.finish();
  };

  if (options.returnAfterInitialLaunch === true) {
    void supervise().catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      self.blockOnce('run-eligible', message);
      await self.journal.record('run-supervision-error', { error: message });
      await self.finish();
    });
    return { ...self.state };
  }
  return await supervise();
}

function trackerRefreshFailureReason(error: unknown): string {
  return `tracker refresh failed: ${error instanceof Error ? error.message : String(error)}`;
}

function findDispatchBatchConflict(
  stories: WorkflowStory[],
  config: ResolvedWorkflowConfig,
): { storyId: string; reason: string } | null {
  const seenBranches = new Set<string>();
  const seenWorktrees = new Set<string>();
  for (const story of stories) {
    const expectedBranch = renderExpectedBranch(story, config.git);
    const expectedWorktreePath = renderExpectedWorktreePath(config.workspace.rootAbs, config.git, story);
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
