export type OrchestratorDriver = 'codex-mcp';

export type RunStatus = 'blocked' | 'complete' | 'dry-run' | 'running' | 'supervision_lost';

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
  lastHeartbeatAt: string | null;
}

export type ChildLaunchStatus = 'launched' | 'settled' | 'supervision_lost';

export interface ChildLaunchRecord extends ActiveChildRun {
  runId: string;
  status: ChildLaunchStatus;
  updatedAt: string;
  trackerPath: string;
  childCwd: string;
  baseShaAtLaunch: string | null;
  promptHash: string;
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

export interface ResolvedWorkflowConfig {
  version: 1;
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
  orchestrator: {
    driver: OrchestratorDriver;
    maxParallel: number;
    stopLaunchingOnBlocked: boolean;
    childTimeoutMs: number;
  };
  codex: {
    childSession: ResolvedChildSessionConfig;
  };
}

export type ApprovalPolicy = 'never' | 'on-failure' | 'on-request' | 'untrusted';
export type SandboxMode = 'danger-full-access' | 'read-only' | 'workspace-write';

export interface ResolvedChildSessionConfig {
  cwdAbs: string;
  model?: string;
  approvalPolicy?: ApprovalPolicy;
  sandbox?: SandboxMode;
  config?: Record<string, unknown>;
}

export interface CliOverrides {
  configPath?: string;
  json?: boolean;
  force?: boolean;
  maxParallel?: number;
  childTimeoutMs?: number;
  track?: string;
  tracksDir?: string;
  dryRun?: boolean;
  watch?: boolean;
  sessionRoot?: string;
  cwd?: string;
  model?: string;
  reasoning?: string;
  approvalPolicy?: ApprovalPolicy;
  sandbox?: SandboxMode;
}

export type WorkflowCommand =
  | { kind: 'help' }
  | { kind: 'list-tracks'; overrides: CliOverrides }
  | { kind: 'list-stories'; overrides: CliOverrides }
  | { kind: 'list-eligible'; overrides: CliOverrides }
  | { kind: 'run-story'; storyId: string; overrides: CliOverrides }
  | { kind: 'run-eligible'; overrides: CliOverrides }
  | { kind: 'watch-run'; runPath: string; overrides: CliOverrides }
  | { kind: 'analyze-run'; runPath: string; overrides: CliOverrides }
  | { kind: 'mcp-check'; overrides: CliOverrides };

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
  subagentCounts: Record<string, number>;
  tokenTotals: TokenTotals | null;
  latestProgress: string | null;
  sessionLogPath: string | null;
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
}

export interface RunEvent {
  recordedAt: string;
  eventAt: string;
  type: string;
  [key: string]: unknown;
}

export interface ArtifactStore {
  writeJson(relativePath: string, value: unknown): Promise<void>;
  writeText(relativePath: string, value: string): Promise<void>;
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
