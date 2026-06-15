import type { CollaborationInspector } from '../collaboration/CollaborationInspector.js';
import type { ChildLifecycleEvent, ChildProgressSource, StoryRunner, StoryRunResult } from '../drivers/StoryRunner.js';
import type { GitInspector } from '../git/GitInspector.js';
import { safeName } from '../internal/guards.js';
import { releaseTrackerClaim } from '../tracks/trackerClaimer.js';
import type {
  ArtifactStore,
  ChildLaunchRecord,
  Clock,
  ResolvedWorkflowConfig,
  RunState,
  WorkflowStory,
} from '../types.js';
import type { ClaimedWorkflowStory, PreparedChildLaunch } from './ChildLaunchRecorder.js';
import type { MetricsCollector } from './MetricsCollector.js';
import { evaluateRecoveryGuard } from './RecoveryGuard.js';
import type { RunJournal, SettledStoryRun } from './RunJournal.js';

interface ChildSupervisorRunner {
  state: RunState;
  dependencies: {
    config: ResolvedWorkflowConfig;
    storyRunner: StoryRunner;
    gitInspector: GitInspector;
    collaborationInspector?: CollaborationInspector;
    artifactStore: ArtifactStore;
    clock: Clock;
    childTimer?: ChildTimer;
  };
  journal: Pick<RunJournal, 'record' | 'updateChildLaunch'>;
  metrics: Pick<MetricsCollector, 'complete' | 'observeChildProgress' | 'updateChildMetric'>;
  activeChildAbortControllers: Map<string, AbortController>;
  trackerClaims: Map<string, ClaimedWorkflowStory>;
  writeState(): Promise<void>;
  writeLiveMetrics(): Promise<void>;
}

interface ChildTimer {
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

export async function executeChildWithSupervisor(
  runner: unknown,
  story: WorkflowStory,
  launch: PreparedChildLaunch,
): Promise<SettledStoryRun> {
  const self = runner as ChildSupervisorRunner;
  const noProgressTimeoutMs = self.dependencies.config.orchestrator.childNoProgressTimeoutMs;
  const startupTimeoutMs = self.dependencies.config.orchestrator.childStartupTimeoutMs;
  const maxRuntimeMs = self.dependencies.config.orchestrator.childMaxRuntimeMs;
  const timer = self.dependencies.childTimer ?? defaultChildTimer;
  const startedAtMs = self.dependencies.clock.nowMs();
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
  self.activeChildAbortControllers.set(story.id, childAbortController);

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
      const pollAt = self.dependencies.clock.now();
      self.state = {
        ...self.state,
        activeChildren: self.state.activeChildren?.map((entry) =>
          entry.storyId === story.id ? { ...entry, lastSupervisorPollAt: pollAt } : entry,
        ),
      };
      supervisorPollWrite = supervisorPollWrite.then(async () => {
        const updated = await self.journal.updateChildLaunch(launch.record, { lastSupervisorPollAt: pollAt });
        if (launch.record.status === 'launched' || launch.record.status === 'requested') launch.record = updated;
      });
      void self.journal.record('child-supervisor-poll', {
        storyId: story.id,
        launchId: launch.record.launchId,
        elapsedMs: self.dependencies.clock.nowMs() - startedAtMs,
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
    const progressAt = self.dependencies.clock.now();
    if (startupTimeoutHandle !== undefined) timer.clearTimeout(startupTimeoutHandle);
    self.state = {
      ...self.state,
      activeChildren: self.state.activeChildren?.map((entry) =>
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
    launch.record = await self.journal.updateChildLaunch(launch.record, {
      status: 'launched',
      ...fields,
      lastObservedChildProgressAt: progressAt,
      lastHeartbeatAt: progressAt,
    });
    self.metrics.observeChildProgress(story.id, {
      sessionLogPath: event?.sessionLogPath ?? fields.sessionLogPath ?? launch.record.sessionLogPath,
      latestProgress: event ? 'session linked' : undefined,
    });
    if (!childLaunchedRecorded) {
      childLaunchedRecorded = true;
      await self.journal.record('child-launched', {
        storyId: story.id,
        launchId: launch.record.launchId,
        expectedBranch: launch.record.expectedBranch,
        expectedWorktreePath: launch.record.expectedWorktreePath,
      });
    }
    if (event) {
      await self.journal.record('child-session-linked', {
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
    await self.writeState();
    await self.writeLiveMetrics();
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
    self.metrics.observeChildProgress(story.id, {
      sessionLogPath: launch.record.sessionLogPath,
      latestProgress: event.message,
    });
    if (event.journal === false) return;
    await self.journal.record('child-progress', {
      storyId: story.id,
      launchId: launch.record.launchId,
      message: event.message,
      progressToken: event.progressToken ?? null,
      progressSource: event.progressSource,
      eventType: event.eventType ?? null,
      elapsedMs: self.dependencies.clock.nowMs() - startedAtMs,
    });
  };

  try {
    const run = self.dependencies.storyRunner.runStory({
      story,
      prompt: launch.prompt,
      cwd: launch.record.childCwd,
      metadata: { runId: self.state.runId, launchId: launch.record.launchId },
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
    const completedAt = self.metrics.complete(story.id);
    if (!startupSettled) {
      await acknowledgeStartup({
        sessionId: result.sessionId,
        sessionLogPath: result.metrics?.sessionLogPath ?? null,
        progressSource: result.sessionId ? 'session-linked' : 'structured',
      });
    }
    self.state = removeActiveChild(self.state, story.id);
    if (result.metrics) {
      self.metrics.updateChildMetric(story.id, result.metrics);
      await self.dependencies.artifactStore.writeJson(`children/${safeName(story.id)}.metrics.json`, result.metrics);
    }
    await self.journal.updateChildLaunch(launch.record, {
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
    const completedAt = self.metrics.complete(story.id);
    const message = error instanceof Error ? error.message : String(error);
    const classification = self.dependencies.storyRunner.classifyError?.(error) ?? {
      supervisionLost: isSupervisionLostError(message),
      recoverable: isSupervisionLostError(message),
    };
    const isSupervisionLost = classification.supervisionLost;
    const isStartupFailure = !isSupervisionLost && (!startupSettled || message === 'child-startup-timeout');
    if (heartbeatHandle !== undefined) timer.clearInterval(heartbeatHandle);
    heartbeatHandle = undefined;
    await supervisorPollWrite;
    self.state = removeActiveChild(self.state, story.id);
    if (isStartupFailure) {
      abortChildStartup(message);
      if (!startupSettled) {
        startupSettled = true;
        launch.resolveStartup('failed');
      }
      launch.record = await self.journal.updateChildLaunch(launch.record, { status: 'startup_failed' });
      await releaseStartupClaim(self, story, launch);
      await self.journal.record('child-startup-failed', {
        storyId: story.id,
        launchId: launch.record.launchId,
        error: message,
      });
    } else if (isSupervisionLost) {
      self.state = {
        ...self.state,
        status: 'supervision_lost',
        blockedStoryId: story.id,
        blockedReason: message,
      };
      await self.journal.updateChildLaunch(launch.record, { status: 'supervision_lost' });
      await recordRecoveryGuard(self, story, launch.record);
      await self.journal.record('child-supervision-lost', {
        storyId: story.id,
        launchId: launch.record.launchId,
        error: message,
      });
    } else {
      await self.journal.updateChildLaunch(launch.record, { status: 'settled' });
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
    self.activeChildAbortControllers.delete(story.id);
    if (startupTimeoutHandle !== undefined) timer.clearTimeout(startupTimeoutHandle);
    if (noProgressTimeoutHandle !== undefined) timer.clearTimeout(noProgressTimeoutHandle);
    if (maxRuntimeTimeoutHandle !== undefined) timer.clearTimeout(maxRuntimeTimeoutHandle);
    if (heartbeatHandle !== undefined) timer.clearInterval(heartbeatHandle);
  }
}

function heartbeatIntervalMs(timeoutMs: number): number {
  return Math.max(1, Math.floor(timeoutMs / 4));
}

export function isSupervisionLostError(message: string): boolean {
  return /child-(?:no-progress|max-runtime)-timeout|child-timeout/i.test(message);
}

function removeActiveChild(state: RunState, storyId: string): RunState {
  return {
    ...state,
    active: state.active.filter((entry) => entry !== storyId),
    activeChildren: state.activeChildren?.filter((entry) => entry.storyId !== storyId),
  };
}

async function releaseStartupClaim(
  self: ChildSupervisorRunner,
  story: WorkflowStory,
  launch: PreparedChildLaunch,
): Promise<void> {
  if (!launch.claim.trackerClaimed) return;
  if (
    launch.record.sessionId !== null ||
    launch.record.lastObservedChildProgressAt !== null ||
    launch.record.lastHeartbeatAt !== null
  ) {
    await self.journal.record('tracker-claim-release-skipped', {
      storyId: story.id,
      launchId: launch.record.launchId,
      reason: 'child startup has acknowledgement evidence',
    });
    return;
  }
  try {
    const result = await releaseTrackerClaim({
      config: self.dependencies.config,
      story,
      owner: launch.claim.owner,
      previousStatus: launch.claim.previousStatus,
    });
    if (result.ok) {
      await self.journal.record('tracker-claim-released', {
        storyId: story.id,
        launchId: launch.record.launchId,
        fromStatus: result.fromStatus,
        toStatus: result.toStatus,
        owner: launch.claim.owner,
      });
    } else {
      await self.journal.record('tracker-claim-release-skipped', {
        storyId: story.id,
        launchId: launch.record.launchId,
        reason: result.reason,
      });
    }
  } catch (error) {
    await self.journal.record('tracker-claim-release-skipped', {
      storyId: story.id,
      launchId: launch.record.launchId,
      reason: error instanceof Error ? error.message : String(error),
    });
  } finally {
    self.trackerClaims.delete(story.id);
  }
}

async function recordRecoveryGuard(
  self: ChildSupervisorRunner,
  story: WorkflowStory,
  launch: ChildLaunchRecord,
): Promise<void> {
  try {
    const evidence = await self.dependencies.gitInspector.inspectStory({
      story,
      git: self.dependencies.config.git,
      cwdAbs: launch.childCwd,
      baseShaAtLaunch: launch.baseShaAtLaunch,
    });
    const collaborationRecovery = await inspectRecoveryCollaboration(self, story, launch);
    const result = evaluateRecoveryGuard({
      storyId: story.id,
      now: self.dependencies.clock.now(),
      staleAfterMs: self.dependencies.config.orchestrator.childNoProgressTimeoutMs,
      session: {
        sessionId: launch.sessionId,
        lastHeartbeatAt: launch.lastHeartbeatAt,
      },
      git: {
        expectedBranch: launch.expectedBranch,
        remoteBranchExists: collaborationRecovery.remoteBranchExists,
        latestCommitSha: evidence.headSha,
        worktreeClean: !evidence.uncommittedChanges,
      },
      pr: collaborationRecovery.pr,
      trackerOnBase: {
        status: story.status,
        complete: self.dependencies.config.statuses.complete.includes(story.status),
      },
    });
    await self.journal.record(recoveryEventType(result.decision), {
      storyId: story.id,
      launchId: launch.launchId,
      decision: result.decision,
      evidence: result.evidence,
    });
  } catch (error) {
    await self.journal.record('parent_takeover_blocked', {
      storyId: story.id,
      launchId: launch.launchId,
      decision: 'manual_recovery_required',
      evidence: [
        `recovery guard could not inspect child evidence: ${error instanceof Error ? error.message : String(error)}`,
      ],
    });
  }
}

async function inspectRecoveryCollaboration(
  self: ChildSupervisorRunner,
  story: WorkflowStory,
  launch: ChildLaunchRecord,
): Promise<{
  remoteBranchExists: boolean | null;
  pr: {
    state: 'none' | 'open' | 'merged' | 'closed' | 'unknown';
    number: number | null;
    mergedAt: string | null;
  };
}> {
  const fallback = { remoteBranchExists: null, pr: prRecoveryState(story) };
  if (!self.dependencies.collaborationInspector) return fallback;
  const identity = pullRequestIdentity(story);
  if (!identity) return fallback;
  const evidence = await self.dependencies.collaborationInspector.inspectPullRequest({
    cwdAbs: launch.childCwd,
    owner: identity.owner,
    repo: identity.repo,
    prNumber: identity.number,
    branchName: launch.expectedBranch,
    reviewBot: self.dependencies.config.pr.review.bot,
  });
  if (!evidence.available) return fallback;
  return {
    remoteBranchExists: evidence.branch?.exists ?? null,
    pr: {
      state: evidence.pr?.state ?? 'unknown',
      number: evidence.pr?.number ?? identity.number,
      mergedAt: evidence.pr?.mergedAt ?? null,
    },
  };
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

function pullRequestIdentity(story: WorkflowStory): { owner: string; repo: string; number: number } | null {
  const value = story.metadata.pr;
  const number = value ? pullRequestNumber(value) : null;
  const match = value?.match(/github\.com\/([^/\s)]+)\/([^/\s)]+)\/pull\/(\d+)/);
  if (!match || number === null) return null;
  return { owner: match[1], repo: match[2], number };
}

function pullRequestNumber(value: string): number | null {
  const match = value.match(/(?:pull\/|#|PR\s*#)(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
