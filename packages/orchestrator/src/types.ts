export type OrchestratorDriver = 'codex-mcp';
export type AgentDriver = 'codex-mcp' | 'inline';
export type AgentTaskType =
  | 'implementStory'
  | 'prePrReview'
  | 'planTrack'
  | 'analyzeRun'
  | 'recoverRun'
  | 'migrateTracker';
export type AgentBudgetAction = 'warn' | 'stop-new-launches' | 'checkpoint-stop' | 'abort';

export type RunStatus = 'aborted' | 'aborting' | 'blocked' | 'complete' | 'dry-run' | 'running' | 'supervision_lost';
export type RunControlAction = 'abort';
export type RunControlOutcome = 'already-terminal' | 'applied' | 'requested' | 'unsupported';

export interface RunControlRequest {
  id: string;
  runId: string;
  action: RunControlAction;
  storyId: string | null;
  reason: string | null;
  requestedAt: string;
  requestedBy: string;
}

export interface RunControlChildOutcome {
  storyId: string;
  sessionId: string | null;
  outcome: RunControlOutcome;
  detail: string | null;
}

export interface RunControlResult {
  ok: true;
  runId: string;
  action: RunControlAction;
  outcome: RunControlOutcome;
  reason: string | null;
  requestedAt: string;
  appliedAt: string | null;
  runPath: string;
  activeStoryIds: string[];
  childOutcomes: RunControlChildOutcome[];
  artifacts: {
    controls: string;
    events: string;
    state: string;
  };
}

export interface ResolvedGitConfig {
  strategy: 'worktree' | 'branch';
  branchPattern: string;
  baseBranch: string;
  commitOnBase: 'forbid' | 'allow';
  worktreeDir: string;
}

export interface ActiveChildRun {
  storyId: string;
  launchId: string;
  expectedBranch: string;
  expectedWorktreePath: string | null;
  startedAt: string;
  lastSupervisorPollAt: string | null;
  lastObservedChildProgressAt: string | null;
  progressSource: ChildProgressSource | null;
  /**
   * Legacy field kept for compatibility with existing run artifacts.
   */
  lastHeartbeatAt: string | null;
}

export type ChildLaunchStatus = 'requested' | 'launched' | 'startup_failed' | 'settled' | 'supervision_lost';
export type ChildProgressSource =
  | 'codex-event'
  | 'session-linked'
  | 'mcp-progress'
  | 'session-log'
  | 'git'
  | 'pr'
  | 'structured';

export interface VerificationEvidence {
  command: string | null;
  status: 'passed' | 'failed' | 'skipped';
  phase?: string | null;
  detail?: string | null;
}

export type GithubCheckConclusion =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'skipped'
  | 'neutral'
  | 'timed_out'
  | 'action_required'
  | 'unknown';

export interface GithubCheckEvidence {
  command: string | null;
  status: 'passed' | 'failed' | 'skipped' | 'unknown';
  conclusion?: GithubCheckConclusion | null;
  detail?: string | null;
}

export interface GithubReviewEvidence {
  reviewer: string | null;
  signal: 'approved' | 'pending' | 'findings' | 'commented' | 'unknown';
  mechanism: 'reaction' | 'comment' | 'review-comment' | 'native-review' | 'unknown';
  triaged?: boolean | null;
  findings?: number | null;
  detail?: string | null;
}

export interface GithubMergeEvidence {
  merged: boolean;
  method?: 'squash' | 'merge' | 'rebase' | 'unknown' | null;
  commit: string | null;
  mergedAt?: string | null;
  branchDeleted?: boolean | null;
  detail?: string | null;
}

export interface GithubEvidence {
  prNumber?: number;
  prUrl?: string;
  checks?: GithubCheckEvidence[];
  review?: GithubReviewEvidence;
  merge?: GithubMergeEvidence;
}

export interface ChildResultEvidence {
  storyId?: string;
  finalStatus?: string;
  trackerPath?: string;
  trackerStatusEvidence?: string;
  prNumber?: number;
  prUrl?: string;
  merged?: boolean;
  mergedAt?: string;
  mergeCommit?: string;
  branchDeleted?: boolean;
  verification?: VerificationEvidence[];
  prePrReview?: unknown;
  prReview?: unknown;
  github?: GithubEvidence;
  downgrades?: string[];
  profile?: {
    name: string;
    taskType: AgentTaskType;
  };
  prompt?: {
    template: string;
    hash: string;
  };
  structuredOutput?: {
    schema: string;
    required: boolean;
    enforced: boolean;
  };
  capabilityDowngrades?: CapabilityDowngrade[];
  blockers?: string[];
}

export interface CapabilityDowngrade {
  capability: string;
  reason: string;
  severity: 'warning' | 'error';
  source: 'driver' | 'profile';
}

export interface ChildLaunchRecord extends ActiveChildRun {
  runId: string;
  status: ChildLaunchStatus;
  updatedAt: string;
  trackerPath: string;
  childCwd: string;
  baseShaAtLaunch: string | null;
  promptHash: string;
  profileName?: string;
  profileTaskType?: AgentTaskType;
  promptTemplate?: string;
  structuredOutputSchema?: string;
  structuredOutputRequired?: boolean;
  capabilityDowngrades?: CapabilityDowngrade[];
  sessionId: string | null;
  sessionLogPath: string | null;
}

export interface ResolvedPrConfig {
  create: boolean;
  ci: {
    wait: boolean;
    command: string | null;
  };
  review: {
    wait: 'none' | 'bot' | 'human';
    bot: string;
    triageComments: boolean;
    maxFixBatches: number;
    rerequestAfterFix: boolean;
    waitTimeoutMinutes: number;
  };
  merge: {
    auto: boolean;
    method: 'squash' | 'merge' | 'rebase';
    deleteBranch: boolean;
  };
}

export interface AgentPromptRef {
  template: string;
  variables: Record<string, unknown>;
}

export interface AgentStructuredOutputRef {
  schema: string;
  required: boolean;
}

export interface AgentBudgetDimension {
  limit: number | null;
  warnAtPercent: number | null;
  action: AgentBudgetAction;
}

export interface AgentBudgetPolicy {
  wallMs: AgentBudgetDimension;
  tokens: AgentBudgetDimension;
  toolCalls: AgentBudgetDimension;
  failedToolCalls: AgentBudgetDimension;
}

export interface AgentProfile {
  driver: AgentDriver;
  model: string | null;
  reasoning: string | null;
  approvalPolicy: string | null;
  sandbox: string | null;
  prompt: AgentPromptRef;
  structuredOutput: AgentStructuredOutputRef;
  budget: AgentBudgetPolicy;
  host: Record<string, unknown>;
}

export interface AgentBudgetSupport {
  enforceable: boolean;
  unavailableReason: string | null;
}

export interface ResolvedAgentProfile extends AgentProfile {
  name: string;
  taskType: AgentTaskType;
  effectiveModel: string | null;
  effectiveReasoning: string | null;
  budgetSupport: Record<keyof AgentBudgetPolicy, AgentBudgetSupport>;
  capabilityWarnings: string[];
}

export interface ResolvedWorkflowConfig {
  version: '0.6.0';
  configPath: string;
  workspace: {
    rootAbs: string;
  };
  paths: {
    tracksDir: string;
    tracksDirAbs: string;
    archiveDir: string;
    archiveDirAbs: string;
  };
  artifacts: {
    rootDir: string;
    rootDirAbs: string;
    runsDirAbs: string;
  };
  statuses: {
    eligible: string[];
    inProgress: string;
    complete: string[];
  };
  tracker: {
    idPattern: string;
  };
  git: ResolvedGitConfig;
  pr: ResolvedPrConfig;
  implement: {
    review: {
      prePr: {
        enabled: boolean;
        mode: 'auto' | 'subagent' | 'inline';
        maxLoops: number;
        loopMode: 'incremental' | 'full';
      };
      semanticChecks: {
        enabled: boolean;
      };
    };
    subagents: {
      enabled: boolean;
      maxParallel: number;
      allowWorkers: boolean;
    };
  };
  agents: {
    profiles: Record<string, AgentProfile>;
    bindings: Record<AgentTaskType, string>;
    resolved: Record<AgentTaskType, ResolvedAgentProfile>;
  };
  orchestrator: {
    driver: OrchestratorDriver;
    maxParallel: number;
    stopLaunchingOnBlocked: boolean;
    watch: {
      enabled: boolean;
      wait: boolean;
      intervalMs: number;
      timeoutMs: number;
    };
    /**
     * Compatibility alias for childNoProgressTimeoutMs.
     */
    childTimeoutMs: number;
    childNoProgressTimeoutMs: number;
    childStartupTimeoutMs: number;
    childMaxRuntimeMs: number;
  };
  childSession: ResolvedChildSessionConfig;
  codex: {
    childSession: ResolvedChildSessionConfig;
  };
}

export type ApprovalPolicy = 'never' | 'on-failure' | 'on-request' | 'untrusted';
export type SandboxMode = 'danger-full-access' | 'read-only' | 'workspace-write';
export type ChildSessionSpeed = 'derive' | 'fast' | 'standard';

export interface ResolvedChildSessionConfig {
  cwdAbs: string;
  speed: ChildSessionSpeed;
  model?: string;
  approvalPolicy?: ApprovalPolicy;
  sandbox?: SandboxMode;
  config?: Record<string, unknown>;
}

export interface CliOverrides {
  configPath?: string;
  json?: boolean;
  requestId?: string;
  force?: boolean;
  maxParallel?: number;
  childTimeoutMs?: number;
  track?: string;
  tracksDir?: string;
  dryRun?: boolean;
  confirmNonDryRun?: boolean;
  asyncLaunch?: boolean;
  watch?: boolean;
  wait?: boolean;
  intervalMs?: number;
  timeoutMs?: number;
  sessionRoot?: string;
  storyId?: string;
  reason?: string;
  limit?: number;
  out?: string;
  exportInclude?: 'summary' | 'full-bounded';
  format?: 'json' | 'ndjson' | 'table' | 'markdown';
  cwd?: string;
  model?: string;
  reasoning?: string;
  approvalPolicy?: ApprovalPolicy;
  sandbox?: SandboxMode;
}

export type WorkflowCommand =
  | { kind: 'help' }
  | { kind: 'version'; overrides: CliOverrides }
  | { kind: 'config-status'; overrides: CliOverrides }
  | { kind: 'config-upgrade'; overrides: CliOverrides }
  | { kind: 'project-inspect'; overrides: CliOverrides }
  | { kind: 'list-tracks'; overrides: CliOverrides }
  | { kind: 'list-stories'; overrides: CliOverrides }
  | { kind: 'list-eligible'; overrides: CliOverrides }
  | { kind: 'tracker-validate'; overrides: CliOverrides }
  | { kind: 'tracker-migrate'; from: string; track: string; overrides: CliOverrides }
  | { kind: 'run-preview'; target: WorkflowRunPreviewTarget; overrides: CliOverrides }
  | { kind: 'run-status'; runRef: string; overrides: CliOverrides }
  | { kind: 'run-stream'; runRef: string; overrides: CliOverrides }
  | { kind: 'run-inspect'; runRef: string; overrides: CliOverrides }
  | { kind: 'run-report'; runRef: string; overrides: CliOverrides }
  | { kind: 'run-export'; runRef: string; overrides: CliOverrides }
  | { kind: 'run-story'; storyId: string; overrides: CliOverrides }
  | { kind: 'run-eligible'; overrides: CliOverrides }
  | { kind: 'watch-run'; runPath: string; overrides: CliOverrides }
  | { kind: 'abort-run'; runPath: string; overrides: CliOverrides }
  | { kind: 'analyze-run'; runPath: string; overrides: CliOverrides }
  | { kind: 'mcp-check'; overrides: CliOverrides };

export type WorkflowRunPreviewTarget =
  | { type: 'story'; trackId?: string; storyId: string }
  | { type: 'track'; trackId?: string; mode: 'eligible' };

export interface WorkflowStory {
  id: string;
  title: string;
  status: string;
  owner: string | null;
  dependencies: string[];
  eligible: boolean;
  blockedReason: string | null;
  metadata: {
    trackId: string;
    trackTitle: string;
    trackerPath: string;
    order: number;
    wave?: string;
    spec?: string;
    plan?: string;
    pr?: string;
    invalidDependencies?: string[];
  };
}

export interface WorkflowTrack {
  id: string;
  title: string;
  relativePath: string;
  pathAbs: string;
  status?: string;
  owner?: string | null;
  stories: WorkflowStory[];
}

export interface StorySource {
  listStories(): Promise<WorkflowStory[]>;
}

export interface ChildRunMetric {
  storyId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export type MetricAvailabilityStatus = 'available' | 'unavailable';

export interface MetricAvailability {
  status: MetricAvailabilityStatus;
  unavailableReason: string | null;
}

export interface NullableMetric<T> {
  value: T | null;
  unavailableReason: string | null;
}

export interface TokenTotals {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
}

export interface ChildMetricsSnapshot {
  storyId: string;
  toolCounts: Record<string, number>;
  failedToolCalls?: number | null;
  subagentCounts: Record<string, number>;
  tokenTotals: TokenTotals | null;
  latestProgress: string | null;
  sessionLogPath: string | null;
  availability?: ChildMetricAvailability;
}

export interface ChildMetricAvailability {
  toolCounts: MetricAvailability;
  failedToolCalls?: MetricAvailability;
  subagentCounts: MetricAvailability;
  tokenTotals: MetricAvailability;
  sessionLog: MetricAvailability;
}

export interface LiveMetricsSnapshot {
  runId: string;
  status: RunStatus;
  elapsedMs: number;
  maxParallel: number;
  active: string[];
  completedCount: number;
  blockedStoryId: string | null;
  blockedReason: string | null;
  children: Record<string, ChildMetricsSnapshot>;
  aggregate: {
    toolCounts: Record<string, number>;
    failedToolCalls: number | null;
    subagentCounts: Record<string, number>;
    tokenTotals: TokenTotals | null;
  };
}

export interface RunMetrics {
  elapsedMs: number;
  launchedCount: number;
  completedCount: number;
  blockedCount: number;
  blockedReason: string | null;
  criticalPath: ChildRunMetric[];
}

export interface RunState {
  runId: string;
  command: string;
  workspaceRoot: string;
  artifactDir: string;
  status: RunStatus;
  maxParallel: number;
  startedAt: string;
  completedAt?: string;
  active: string[];
  activeChildren?: ActiveChildRun[];
  completed: Array<{
    storyId: string;
    ok: boolean;
    sessionId: string | null;
    completedAt: string;
    startedAt?: string;
    durationMs?: number;
    returnedStatus?: string | null;
    returnedComplete?: boolean | null;
  }>;
  blockedStoryId: string | null;
  blockedReason: string | null;
  dryRunDispatch?: string[];
  metrics?: RunMetrics;
  interactive?: {
    storyId: string;
    ok: boolean;
    sessionId: string | null;
    sessionLogPath: string | null;
  };
}

export interface RunEvent {
  recordedAt: string;
  eventAt: string;
  type: string;
  [key: string]: unknown;
}

export interface RunSummaryArtifact {
  schemaVersion: 1;
  runId: string;
  command: string;
  status: RunStatus;
  derivedStatus: string;
  startedAt: string;
  completedAt: string | null;
  elapsedMs: number | null;
  blockedStoryId: string | null;
  blockedReason: string | null;
  activeStoryIds: string[];
  completedStoryIds: string[];
  artifactPaths: Record<string, string>;
  aggregate: LiveMetricsSnapshot['aggregate'];
  unavailable: Record<string, string>;
}

export interface RunRowsArtifact {
  schemaVersion: 1;
  rows: RunRowArtifact[];
}

export interface RunRowArtifact {
  runId: string;
  storyId: string;
  status: string;
  ok: boolean | null;
  sessionId: string | null;
  sessionLogPath: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  latestProgress: string | null;
  toolCalls: NullableMetric<number>;
  failedToolCalls: NullableMetric<number>;
  subagents: NullableMetric<number>;
  tokens: NullableMetric<TokenTotals>;
}

export interface BudgetProfileSnapshot {
  taskType: AgentTaskType;
  profileName: string;
  budget: AgentBudgetPolicy;
  support: Record<keyof AgentBudgetPolicy, AgentBudgetSupport>;
}

export interface BudgetArtifact {
  schemaVersion: 1;
  runId: string;
  profiles: Record<string, BudgetProfileSnapshot>;
  evaluations: BudgetEvaluation[];
}

export interface BudgetEvaluation {
  profileName: string;
  taskType: AgentTaskType;
  dimension: keyof AgentBudgetPolicy;
  limit: number | null;
  observed: number | null;
  warnAtPercent: number | null;
  action: AgentBudgetAction;
  status: 'not-configured' | 'within-limit' | 'warning' | 'limit-reached' | 'unavailable';
  unavailableReason: string | null;
  eventType: 'budget-warning' | 'budget-stop' | null;
}

export interface TranscriptIndexArtifact {
  schemaVersion: 1;
  runId: string;
  transcripts: Array<{
    storyId: string;
    sessionId: string | null;
    sessionLogPath: string | null;
    status: 'linked' | 'unlinked' | 'missing';
    unavailableReason: string | null;
  }>;
}

export interface ArtifactStore {
  writeJson(relativePath: string, value: unknown): Promise<void>;
  writeText(relativePath: string, value: string): Promise<void>;
  readText?(relativePath: string): Promise<string | null>;
  appendText?(relativePath: string, value: string): Promise<void>;
  appendEvent(event: RunEvent): Promise<void>;
}

export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export interface Clock {
  now(): string;
  nowMs(): number;
}
