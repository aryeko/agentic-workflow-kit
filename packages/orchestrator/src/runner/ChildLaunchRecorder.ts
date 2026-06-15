import { renderStoryImplementerPrompt } from '../drivers/promptRenderer.js';
import type { StoryPromptMetadata, StoryRunner } from '../drivers/StoryRunner.js';
import { releaseTrackerClaim } from '../tracks/trackerClaimer.js';
import type {
  ActiveChildRun,
  ArtifactStore,
  ChildLaunchRecord,
  Clock,
  ResolvedAgentProfile,
  ResolvedWorkflowConfig,
  RunState,
  WorkflowStory,
} from '../types.js';
import { type PreparedChildWorkspace, prepareChildWorkspace } from './ChildWorkspacePreparer.js';
import { buildLaunchId, hashPrompt } from './launchMetadata.js';
import type { MetricsCollector } from './MetricsCollector.js';
import type { RunJournal } from './RunJournal.js';

export interface ClaimedWorkflowStory {
  story: WorkflowStory;
  owner: string;
  previousStatus: string;
  trackerClaimed: boolean;
}

export interface PreparedChildLaunch {
  record: ChildLaunchRecord;
  prompt: string;
  profile: ResolvedAgentProfile;
  promptMetadata: StoryPromptMetadata;
  claim: ClaimedWorkflowStory;
  startup: Promise<'acknowledged' | 'failed'>;
  resolveStartup: (outcome: 'acknowledged' | 'failed') => void;
}

interface ChildLaunchRunner {
  state: RunState;
  dependencies: {
    config: ResolvedWorkflowConfig;
    storyRunner: StoryRunner;
    gitInspector: {
      snapshotBaseSha?: (args: { git: ResolvedWorkflowConfig['git']; cwdAbs: string }) => Promise<string | null>;
    };
    artifactStore: ArtifactStore;
    clock: Clock;
    childWorkspacePreparer?: typeof prepareChildWorkspace;
  };
  journal: Pick<RunJournal, 'record' | 'recordChildLaunch'>;
  metrics: Pick<MetricsCollector, 'start'>;
  blockOnce(storyId: string, reason: string): void;
  trackerClaims: Map<string, ClaimedWorkflowStory>;
  writeState(): Promise<void>;
  writeLiveMetrics(): Promise<void>;
}

export async function recordChildLaunchWithWorkspace(
  runner: unknown,
  claim: ClaimedWorkflowStory,
): Promise<PreparedChildLaunch | null> {
  const self = runner as ChildLaunchRunner;
  const { story } = claim;
  const workspacePreparer = self.dependencies.childWorkspacePreparer ?? prepareChildWorkspace;
  let preparedWorkspace: PreparedChildWorkspace;
  try {
    preparedWorkspace = await workspacePreparer({
      story,
      workspaceRootAbs: self.dependencies.config.workspace.rootAbs,
      fallbackCwdAbs: self.dependencies.config.childSession.cwdAbs,
      git: self.dependencies.config.git,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    self.blockOnce(story.id, reason);
    await self.journal.record('child-workspace-prepare-failed', {
      storyId: story.id,
      reason,
    });
    await releaseUnlaunchedClaim(self, claim, reason);
    await self.writeState();
    await self.writeLiveMetrics();
    return null;
  }
  self.metrics.start(story.id);
  const startedAt = self.dependencies.clock.now();
  const childCwd = preparedWorkspace.childCwdAbs;
  const prompt = renderStoryImplementerPrompt(story, self.dependencies.config);
  const profile = self.dependencies.config.agents.resolved.implementStory;
  const promptHash = hashPrompt(prompt);
  const promptMetadata: StoryPromptMetadata = {
    template: profile.prompt.template,
    promptHash,
    structuredOutputSchema: profile.structuredOutput.schema,
    structuredOutputRequired: profile.structuredOutput.required,
  };
  const capabilityDowngrades = self.dependencies.storyRunner.describeCapabilityDowngrades?.(promptMetadata) ?? [];
  const baseShaAtLaunch =
    (await self.dependencies.gitInspector.snapshotBaseSha?.({
      git: self.dependencies.config.git,
      cwdAbs: childCwd,
    })) ?? null;
  const activeChild: ActiveChildRun = {
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
    runId: self.state.runId,
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
  self.state = {
    ...self.state,
    active: [...self.state.active, story.id],
    activeChildren: [...(self.state.activeChildren ?? []), activeChild],
  };
  await self.journal.recordChildLaunch(launchRecord);
  await self.journal.record('child-launch-requested', {
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
  await self.writeState();
  await self.writeLiveMetrics();
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

async function releaseUnlaunchedClaim(
  self: ChildLaunchRunner,
  claim: ClaimedWorkflowStory,
  reason: string,
): Promise<void> {
  if (!claim.trackerClaimed) return;
  try {
    const result = await releaseTrackerClaim({
      config: self.dependencies.config,
      story: claim.story,
      owner: claim.owner,
      previousStatus: claim.previousStatus,
    });
    if (result.ok) {
      await self.journal.record('tracker-claim-released', {
        storyId: claim.story.id,
        fromStatus: result.fromStatus,
        toStatus: result.toStatus,
        owner: claim.owner,
        reason,
      });
    } else {
      await self.journal.record('tracker-claim-release-skipped', {
        storyId: claim.story.id,
        reason: result.reason,
      });
    }
  } catch (error) {
    await self.journal.record('tracker-claim-release-skipped', {
      storyId: claim.story.id,
      reason: error instanceof Error ? error.message : String(error),
    });
  } finally {
    self.trackerClaims.delete(claim.story.id);
  }
}

function startupSignal(): {
  promise: Promise<'acknowledged' | 'failed'>;
  resolve: (outcome: 'acknowledged' | 'failed') => void;
} {
  let resolveStartup: (outcome: 'acknowledged' | 'failed') => void = () => undefined;
  const promise = new Promise<'acknowledged' | 'failed'>((resolve) => {
    resolveStartup = resolve;
  });
  return { promise, resolve: resolveStartup };
}
