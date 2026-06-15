import type { ChildLifecycleEvent, ChildProgressSource, StoryRunResult } from '../drivers/StoryRunner.js';
import { safeName } from '../internal/guards.js';
import { releaseTrackerClaim } from '../tracks/trackerClaimer.js';
import type { ChildLaunchRecord, RunState, WorkflowStory } from '../types.js';
import { evaluateRecoveryGuard } from './RecoveryGuard.js';
import type { SettledStoryRun } from './RunJournal.js';
import type { ChildSupervisorContext, ChildTimer, PreparedChildLaunch } from './WorkflowRunnerContext.js';

const defaultChildTimer: ChildTimer = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
  setInterval: (callback, ms) => globalThis.setInterval(callback, ms),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>),
};

export async function executeChildWithSupervisor(
  runner: ChildSupervisorContext,
  story: WorkflowStory,
  launch: PreparedChildLaunch,
): Promise<SettledStoryRun> {
  return await new ChildSupervisorRun(runner, story, launch).execute();
}

class ChildSupervisorRun {
  private readonly noProgressTimeoutMs: number;
  private readonly startupTimeoutMs: number;
  private readonly maxRuntimeMs: number;
  private readonly timer: ChildTimer;
  private readonly startedAtMs: number;
  private readonly childAbortController = new AbortController();
  private startupTimeoutHandle: unknown;
  private noProgressTimeoutHandle: unknown;
  private maxRuntimeTimeoutHandle: unknown;
  private heartbeatHandle: unknown;
  private rejectNoProgressTimeout: ((error: Error) => void) | null = null;
  private supervisorPollWrite: Promise<void> = Promise.resolve();
  private startupSettled = false;
  private childLaunchedRecorded = false;
  private terminalStartupFailure = false;

  constructor(
    private readonly runner: ChildSupervisorContext,
    private readonly story: WorkflowStory,
    private launch: PreparedChildLaunch,
  ) {
    this.noProgressTimeoutMs = runner.dependencies.config.orchestrator.childNoProgressTimeoutMs;
    this.startupTimeoutMs = runner.dependencies.config.orchestrator.childStartupTimeoutMs;
    this.maxRuntimeMs = runner.dependencies.config.orchestrator.childMaxRuntimeMs;
    this.timer = runner.dependencies.childTimer ?? defaultChildTimer;
    this.startedAtMs = runner.dependencies.clock.nowMs();
  }

  async execute(): Promise<SettledStoryRun> {
    this.runner.activeChildAbortControllers.set(this.story.id, this.childAbortController);
    try {
      const run = this.runner.dependencies.storyRunner.runStory({
        story: this.story,
        prompt: this.launch.prompt,
        cwd: this.launch.record.childCwd,
        metadata: { runId: this.runner.state.runId, launchId: this.launch.record.launchId },
        profile: this.launch.profile,
        promptMetadata: this.launch.promptMetadata,
        signal: this.childAbortController.signal,
        onLifecycle: (event) => this.handleLifecycle(event),
      });
      const result = await this.waitForResult(run);
      this.stopSupervisorPolling();
      await this.supervisorPollWrite;
      return await this.settleSuccess(result);
    } catch (error) {
      this.stopSupervisorPolling();
      await this.supervisorPollWrite;
      return await this.settleFailure(error);
    } finally {
      this.cleanup();
    }
  }

  private async waitForResult(run: Promise<StoryRunResult>): Promise<StoryRunResult> {
    const maxRuntimeTimeout = new Promise<StoryRunResult>((_, reject) => {
      this.maxRuntimeTimeoutHandle = this.timer.setTimeout(
        () => reject(new Error('child-max-runtime-timeout')),
        this.maxRuntimeMs,
      );
    });
    const startupTimeout = new Promise<StoryRunResult>((_, reject) => {
      this.startupTimeoutHandle = this.timer.setTimeout(() => {
        this.abortChildStartup('child-startup-timeout');
        reject(new Error('child-startup-timeout'));
      }, this.startupTimeoutMs);
    });
    const noProgressTimeout = new Promise<StoryRunResult>((_, reject) => {
      this.rejectNoProgressTimeout = reject;
    });
    return await Promise.race([run, startupTimeout, noProgressTimeout, maxRuntimeTimeout]);
  }

  private async settleSuccess(result: StoryRunResult): Promise<SettledStoryRun> {
    const completedAt = this.runner.metrics.complete(this.story.id);
    if (!this.startupSettled) {
      await this.acknowledgeStartup({
        sessionId: result.sessionId,
        sessionLogPath: result.metrics?.sessionLogPath ?? null,
        progressSource: result.sessionId ? 'session-linked' : 'structured',
      });
    }
    this.runner.state = removeActiveChild(this.runner.state, this.story.id);
    if (result.metrics) {
      this.runner.metrics.updateChildMetric(this.story.id, result.metrics);
      await this.runner.dependencies.artifactStore.writeJson(
        `children/${safeName(this.story.id)}.metrics.json`,
        result.metrics,
      );
    }
    await this.runner.journal.updateChildLaunch(this.launch.record, {
      status: 'settled',
      sessionId: result.sessionId,
      sessionLogPath: result.metrics?.sessionLogPath ?? this.launch.record.sessionLogPath,
    });
    return {
      storyId: this.story.id,
      ok: true,
      sessionId: result.sessionId,
      content: result.content,
      rawResult: result.rawResult,
      invocation: result.invocation,
      evidence: result.evidence,
      completedAt,
      metrics: result.metrics,
      baseShaAtLaunch: this.launch.record.baseShaAtLaunch,
    };
  }

  private async settleFailure(error: unknown): Promise<SettledStoryRun> {
    const completedAt = this.runner.metrics.complete(this.story.id);
    const message = error instanceof Error ? error.message : String(error);
    const classification = this.runner.dependencies.storyRunner.classifyError?.(error) ?? {
      supervisionLost: isSupervisionLostError(message),
      recoverable: isSupervisionLostError(message),
    };
    const isSupervisionLost = classification.supervisionLost;
    const isStartupFailure = !isSupervisionLost && (!this.startupSettled || message === 'child-startup-timeout');
    this.runner.state = removeActiveChild(this.runner.state, this.story.id);
    if (isStartupFailure) {
      await this.settleStartupFailure(message);
    } else if (isSupervisionLost) {
      await this.settleSupervisionLost(message);
    } else {
      await this.runner.journal.updateChildLaunch(this.launch.record, { status: 'settled' });
    }
    return {
      storyId: this.story.id,
      ok: false,
      sessionId: null,
      error: message,
      completedAt,
      baseShaAtLaunch: this.launch.record.baseShaAtLaunch,
    };
  }

  private async settleStartupFailure(message: string): Promise<void> {
    this.abortChildStartup(message);
    if (!this.startupSettled) {
      this.startupSettled = true;
      this.launch.resolveStartup('failed');
    }
    this.launch.record = await this.runner.journal.updateChildLaunch(this.launch.record, { status: 'startup_failed' });
    await releaseStartupClaim(this.runner, this.story, this.launch);
    await this.runner.journal.record('child-startup-failed', {
      storyId: this.story.id,
      launchId: this.launch.record.launchId,
      error: message,
    });
  }

  private async settleSupervisionLost(message: string): Promise<void> {
    this.runner.state = {
      ...this.runner.state,
      status: 'supervision_lost',
      blockedStoryId: this.story.id,
      blockedReason: message,
    };
    await this.runner.journal.updateChildLaunch(this.launch.record, { status: 'supervision_lost' });
    await recordRecoveryGuard(this.runner, this.story, this.launch.record);
    await this.runner.journal.record('child-supervision-lost', {
      storyId: this.story.id,
      launchId: this.launch.record.launchId,
      error: message,
    });
  }

  private abortChildStartup(message: string): void {
    this.terminalStartupFailure = true;
    if (!this.childAbortController.signal.aborted) this.childAbortController.abort(new Error(message));
  }

  private refreshNoProgressTimeout(): void {
    if (this.noProgressTimeoutHandle !== undefined) this.timer.clearTimeout(this.noProgressTimeoutHandle);
    this.noProgressTimeoutHandle = this.timer.setTimeout(() => {
      this.rejectNoProgressTimeout?.(new Error('child-no-progress-timeout'));
    }, this.noProgressTimeoutMs);
  }

  private startSupervisorPolling(): void {
    if (this.heartbeatHandle !== undefined) return;
    this.heartbeatHandle = this.timer.setInterval(() => {
      const pollAt = this.runner.dependencies.clock.now();
      this.runner.state = {
        ...this.runner.state,
        activeChildren: this.runner.state.activeChildren?.map((entry) =>
          entry.storyId === this.story.id ? { ...entry, lastSupervisorPollAt: pollAt } : entry,
        ),
      };
      this.supervisorPollWrite = this.supervisorPollWrite.then(async () => {
        const updated = await this.runner.journal.updateChildLaunch(this.launch.record, {
          lastSupervisorPollAt: pollAt,
        });
        if (this.launch.record.status === 'launched' || this.launch.record.status === 'requested') {
          this.launch.record = updated;
        }
      });
      void this.runner.journal.record('child-supervisor-poll', {
        storyId: this.story.id,
        launchId: this.launch.record.launchId,
        elapsedMs: this.runner.dependencies.clock.nowMs() - this.startedAtMs,
      });
    }, heartbeatIntervalMs(this.noProgressTimeoutMs));
  }

  private stopSupervisorPolling(): void {
    if (this.heartbeatHandle !== undefined) this.timer.clearInterval(this.heartbeatHandle);
    this.heartbeatHandle = undefined;
  }

  private async acknowledgeStartup(
    fields: Partial<ChildLaunchRecord>,
    event: {
      type: 'session-linked';
      sessionId: string;
      sessionLogPath: string | null;
      progressSource: ChildProgressSource;
    } | null = null,
  ): Promise<void> {
    if (this.terminalStartupFailure || this.childAbortController.signal.aborted) return;
    const progressAt = this.runner.dependencies.clock.now();
    if (this.startupTimeoutHandle !== undefined) this.timer.clearTimeout(this.startupTimeoutHandle);
    this.runner.state = {
      ...this.runner.state,
      activeChildren: this.runner.state.activeChildren?.map((entry) =>
        entry.storyId === this.story.id
          ? {
              ...entry,
              lastObservedChildProgressAt: progressAt,
              progressSource: fields.progressSource ?? entry.progressSource,
              lastHeartbeatAt: progressAt,
            }
          : entry,
      ),
    };
    this.launch.record = await this.runner.journal.updateChildLaunch(this.launch.record, {
      status: 'launched',
      ...fields,
      lastObservedChildProgressAt: progressAt,
      lastHeartbeatAt: progressAt,
    });
    this.runner.metrics.observeChildProgress(this.story.id, {
      sessionLogPath: event?.sessionLogPath ?? fields.sessionLogPath ?? this.launch.record.sessionLogPath,
      latestProgress: event ? 'session linked' : undefined,
    });
    await this.recordStartupEvents(event);
    let resolveStartupAfterCheckpoint = false;
    if (!this.startupSettled) {
      this.startupSettled = true;
      resolveStartupAfterCheckpoint = true;
    }
    this.refreshNoProgressTimeout();
    this.startSupervisorPolling();
    await this.runner.writeState();
    await this.runner.writeLiveMetrics();
    if (resolveStartupAfterCheckpoint) this.launch.resolveStartup('acknowledged');
  }

  private async recordStartupEvents(
    event: {
      type: 'session-linked';
      sessionId: string;
      sessionLogPath: string | null;
      progressSource: ChildProgressSource;
    } | null,
  ): Promise<void> {
    if (!this.childLaunchedRecorded) {
      this.childLaunchedRecorded = true;
      await this.runner.journal.record('child-launched', {
        storyId: this.story.id,
        launchId: this.launch.record.launchId,
        expectedBranch: this.launch.record.expectedBranch,
        expectedWorktreePath: this.launch.record.expectedWorktreePath,
      });
    }
    if (event) {
      await this.runner.journal.record('child-session-linked', {
        storyId: this.story.id,
        launchId: this.launch.record.launchId,
        sessionId: event.sessionId,
        sessionLogPath: event.sessionLogPath,
        progressSource: event.progressSource,
      });
    }
  }

  private async handleLifecycle(event: ChildLifecycleEvent): Promise<void> {
    if (event.type === 'session-linked') {
      await this.acknowledgeStartup(
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

    await this.acknowledgeStartup({ progressSource: event.progressSource });
    this.runner.metrics.observeChildProgress(this.story.id, {
      sessionLogPath: this.launch.record.sessionLogPath,
      latestProgress: event.message,
    });
    if (event.journal === false) return;
    await this.runner.journal.record('child-progress', {
      storyId: this.story.id,
      launchId: this.launch.record.launchId,
      message: event.message,
      progressToken: event.progressToken ?? null,
      progressSource: event.progressSource,
      eventType: event.eventType ?? null,
      elapsedMs: this.runner.dependencies.clock.nowMs() - this.startedAtMs,
    });
  }

  private cleanup(): void {
    this.runner.activeChildAbortControllers.delete(this.story.id);
    if (this.startupTimeoutHandle !== undefined) this.timer.clearTimeout(this.startupTimeoutHandle);
    if (this.noProgressTimeoutHandle !== undefined) this.timer.clearTimeout(this.noProgressTimeoutHandle);
    if (this.maxRuntimeTimeoutHandle !== undefined) this.timer.clearTimeout(this.maxRuntimeTimeoutHandle);
    if (this.heartbeatHandle !== undefined) this.timer.clearInterval(this.heartbeatHandle);
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
  self: ChildSupervisorContext,
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
  self: ChildSupervisorContext,
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
  self: ChildSupervisorContext,
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
