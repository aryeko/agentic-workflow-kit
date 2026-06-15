import type { CollaborationInspector } from '../collaboration/CollaborationInspector.js';
import type { StoryPromptMetadata, StoryRunner } from '../drivers/StoryRunner.js';
import type { GitInspector } from '../git/GitInspector.js';
import type {
  ArtifactStore,
  ChildLaunchRecord,
  Clock,
  ResolvedAgentProfile,
  ResolvedWorkflowConfig,
  RunState,
  WorkflowStory,
} from '../types.js';
import type { PrepareChildWorkspaceArgs, PreparedChildWorkspace } from './ChildWorkspacePreparer.js';
import type { ReturnEvaluation } from './CompletionGate.js';
import type { MetricsCollector } from './MetricsCollector.js';
import type { RunJournal, SettledStoryRun } from './RunJournal.js';

export interface ChildTimer {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

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

export interface ChildSupervisorContext {
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

export interface ChildLaunchContext {
  state: RunState;
  dependencies: {
    config: ResolvedWorkflowConfig;
    storyRunner: StoryRunner;
    gitInspector: {
      snapshotBaseSha?: (args: { git: ResolvedWorkflowConfig['git']; cwdAbs: string }) => Promise<string | null>;
    };
    artifactStore: ArtifactStore;
    clock: Clock;
    childWorkspacePreparer?: (args: PrepareChildWorkspaceArgs) => Promise<PreparedChildWorkspace>;
  };
  journal: Pick<RunJournal, 'record' | 'recordChildLaunch'>;
  metrics: Pick<MetricsCollector, 'start'>;
  blockOnce(storyId: string, reason: string): void;
  trackerClaims: Map<string, ClaimedWorkflowStory>;
  writeState(): Promise<void>;
  writeLiveMetrics(): Promise<void>;
}

export interface EligibleWorkflowContext {
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
  processSettled(settled: SettledStoryRun, stories: WorkflowStory[]): Promise<ReturnEvaluation>;
}
