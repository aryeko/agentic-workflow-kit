import type { WorkflowRunAnalysis } from '../analysis/runAnalyzer.js';
import type { RunExportCopyResult } from '../analysis/runExport.js';
import type { CodexMcpStoryRunnerOptions } from '../drivers/codex-mcp/CodexMcpStoryRunner.js';
import type { StoryRunner } from '../drivers/StoryRunner.js';
import type { TrackerMigrationReport, TrackerValidationReport } from '../tracks/markdownTracker.js';
import type {
  CliOverrides,
  LiveMetricsSnapshot,
  Logger,
  ResolvedWorkflowConfig,
  RunControlRequest,
  TokenTotals,
  WorkflowCommand,
  WorkflowStory,
  WorkflowTrack,
} from '../types.js';
import type { RunSubscriptionInspectSummary } from './runSubscriptions.js';

export interface CommandHandlerOptions {
  stdout?: (line: string) => void;
  logger?: Logger;
  createCodexMcpClient?: CodexMcpStoryRunnerOptions['createClient'];
}

export interface TracksResult {
  config: ResolvedWorkflowConfig;
  tracks: WorkflowTrack[];
}

export interface StoriesResult {
  config: ResolvedWorkflowConfig;
  stories: WorkflowStory[];
}

export interface TrackerValidateResult {
  config: ResolvedWorkflowConfig;
  track: {
    id: string;
    relativePath: string;
  };
  report: TrackerValidationReport;
}

export interface TrackerMigrateInput {
  from: string;
  track: string;
}

export interface TrackerMigrateResult {
  config: ResolvedWorkflowConfig;
  track: {
    id: string;
  };
  draftMarkdown: string;
  report: TrackerMigrationReport;
}

export interface WatchRunSnapshot {
  state: unknown | null;
  metrics: unknown | null;
  summary?: WatchRunSummary;
  wait?: {
    timedOut: boolean;
    elapsedMs: number;
    polls: number;
  };
}

export interface WatchRunSummary {
  runId: string | null;
  status: string | null;
  active: string[];
  completedCount: number;
  blockedStoryId: string | null;
  blockedReason: string | null;
  elapsedMs: number | null;
  aggregate: LiveMetricsSnapshot['aggregate'] | null;
  stories: WatchStorySummary[];
}

export interface WatchStorySummary {
  storyId: string;
  status: 'requested' | 'launched' | 'active' | 'blocked' | 'complete' | 'supervision_lost' | 'unknown';
  sessionId: string | null;
  sessionLogPath: string | null;
  expectedBranch: string | null;
  expectedWorktreePath: string | null;
  latestMilestone: string | null;
  latestProgressAt: string | null;
  planSteps: { done: number; total: number } | null;
  toolCounts: Record<string, number>;
  subagentCounts: Record<string, number>;
  tokenTotals: TokenTotals | null;
}

export interface WatchRunCursor {
  eventOffset: number;
}

export interface StartWatchRunResult extends WatchRunSnapshot {
  watchId: string;
  cursor: WatchRunCursor;
}

export interface PollWatchRunResult extends WatchRunSnapshot {
  cursor: WatchRunCursor;
  changes: unknown[];
}

export interface AbortRunInput {
  runPath: string;
  storyId?: string;
  reason?: string;
  requestedBy?: string;
  controlRunner?: StoryRunner;
}

export type WorkflowRunEventTopic =
  | 'run'
  | 'tracker'
  | 'story'
  | 'child'
  | 'review'
  | 'pr'
  | 'merge'
  | 'budget'
  | 'control'
  | 'error'
  | 'debug';
export type WorkflowRunEventLevel = 'debug' | 'info' | 'warn' | 'error';

export interface WorkflowRunEventQuery {
  limit?: number;
  topics?: WorkflowRunEventTopic[];
  storyIds?: string[];
  minLevel?: WorkflowRunEventLevel;
}

export interface WorkflowRunStreamSubscription extends WorkflowRunEventQuery {
  replay?: { lastEvents?: number };
  includeData?: 'none' | 'summary' | 'full-bounded';
  throttleMs?: number;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export interface WorkflowRunStatusInput extends CliOverrides {
  runId?: string;
  runPath?: string;
  events?: WorkflowRunEventQuery;
}

export interface WorkflowRunStreamInput extends CliOverrides {
  runId?: string;
  runPath?: string;
  subscription?: WorkflowRunStreamSubscription;
  onProgress?: (event: NormalizedRunEvent, delivered: number) => Promise<void> | void;
}

export interface WorkflowRunInspectInput extends CliOverrides {
  runId?: string;
  runPath?: string;
  include?: 'summary' | 'artifacts' | 'children' | 'full-bounded';
}

export interface NormalizedRunEvent {
  id: string;
  recordedAt: string | null;
  eventAt: string | null;
  type: string;
  topic: WorkflowRunEventTopic;
  level: WorkflowRunEventLevel;
  message: string;
  storyId: string | null;
  childId: string | null;
  data?: Record<string, unknown>;
}

export interface WorkflowRunStatusResult {
  runId: string;
  status: string | null;
  active: string[];
  completedCount: number;
  blockedStoryId: string | null;
  blockedReason: string | null;
  controls: RunControlRequest[];
  artifacts: Record<string, string>;
  metrics: unknown | null;
  recentEvents: NormalizedRunEvent[];
}

export interface WorkflowRunStreamResult {
  runId: string;
  terminal: boolean;
  status: string | null;
  eventsDelivered: number;
  timedOut: boolean;
  events: NormalizedRunEvent[];
}

export interface WorkflowRunInspectResult {
  runId: string;
  status: string | null;
  artifactDir: string;
  artifacts: Array<{ kind: string; path: string; exists: boolean; sizeBytes: number | null }>;
  children: Array<{
    storyId: string;
    launchPath: string | null;
    resultPath: string | null;
    sessionId: string | null;
    sessionLogPath: string | null;
  }>;
  pr: { urls: string[]; numbers: number[] };
  metrics: unknown | null;
  subscriptions: RunSubscriptionInspectSummary;
}

export interface WorkflowRunReportInput extends CliOverrides {
  runId?: string;
  runPath?: string;
  write?: boolean;
}

export interface WorkflowRunReportResult {
  runId: string;
  artifactDir: string;
  format: 'json' | 'markdown';
  analysis: WorkflowRunAnalysis;
  markdown: string;
  artifacts: {
    analysis: string;
    report: string;
  };
  written: boolean;
}

export interface WorkflowRunExportInput extends CliOverrides {
  runId?: string;
  runPath?: string;
  out?: string;
  include?: 'summary' | 'full-bounded';
}

export interface WorkflowRunExportResult {
  runId: string;
  artifactDir: string;
  bundleDir: string;
  include: 'summary' | 'full-bounded';
  files: RunExportCopyResult[];
}

export type RunCommand = Extract<WorkflowCommand, { kind: 'run-story' | 'run-eligible' }>;
export type WatchOptions = ResolvedWorkflowConfig['orchestrator']['watch'];

export const DEFAULT_WATCH_OPTIONS: WatchOptions = {
  enabled: false,
  wait: false,
  intervalMs: 5 * 60 * 1000,
  timeoutMs: 5 * 60 * 1000,
};
