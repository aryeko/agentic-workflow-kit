import path from 'node:path';
import { artifactRootDirForDriver, SUPPORTED_DRIVERS, unsupportedDriverMessage } from '../drivers/registry.js';
import type {
  AgentBudgetPolicy,
  AgentBudgetSupport,
  AgentTaskType,
  CliOverrides,
  OrchestratorDriver,
  ResolvedAgentProfile,
  ResolvedWorkflowConfig,
} from '../types.js';
import { loadConfig } from './resolve.js';
import { assertRepoRelativePath, ConfigSchema, type WorkflowConfig } from './schema.js';

const DEFAULT_CHILD_NO_PROGRESS_TIMEOUT_MS = 1_800_000;
const DEFAULT_CHILD_STARTUP_TIMEOUT_MS = 60_000;
const DEFAULT_WATCH_INTERVAL_MS = 300_000;
const DEFAULT_WATCH_TIMEOUT_MS = 300_000;
const AGENT_TASK_TYPES: AgentTaskType[] = [
  'implementStory',
  'prePrReview',
  'planTrack',
  'analyzeRun',
  'recoverRun',
  'migrateTracker',
];
const UNAVAILABLE_TOKEN_BUDGET_REASON = 'live token telemetry is not available before AWK06/AWK08 budget enforcement';
const UNAVAILABLE_COST_BUDGET_REASON = 'live cost telemetry is not available before AWK06/AWK08 budget enforcement';

export async function loadResolvedConfig(
  overrides: CliOverrides = {},
  cwd = process.cwd(),
): Promise<ResolvedWorkflowConfig> {
  const { config, workspaceRoot, configPath } = await loadConfig({
    cwd,
    configPath: overrides.configPath,
  });

  const driver = resolveDriver(config.orchestrator.driver);
  const artifactRootDir = artifactRootDirForDriver(driver);
  const tracksDir = overrides.tracksDir ?? config.paths.tracksDir;
  if (overrides.tracksDir !== undefined) {
    assertRepoRelativePath(overrides.tracksDir, 'tracksDir');
  }
  const archiveDir = config.paths.archiveDir;
  const maxParallel = overrides.maxParallel ?? config.orchestrator.maxParallel;
  const childNoProgressTimeoutMs =
    overrides.childTimeoutMs ??
    (config.orchestrator.childTimeoutMs !== DEFAULT_CHILD_NO_PROGRESS_TIMEOUT_MS &&
    config.orchestrator.childNoProgressTimeoutMs === DEFAULT_CHILD_NO_PROGRESS_TIMEOUT_MS
      ? config.orchestrator.childTimeoutMs
      : config.orchestrator.childNoProgressTimeoutMs);
  const childMaxRuntimeMs = config.orchestrator.childMaxRuntimeMs;
  const childStartupTimeoutMs = config.orchestrator.childStartupTimeoutMs;
  const childSessionConfig: Record<string, unknown> = {};
  if (overrides.reasoning !== undefined) {
    childSessionConfig.model_reasoning_effort = overrides.reasoning;
  }
  const agents = resolveAgentProfiles(config, overrides);
  const configuredChildSessionConfig = {
    ...(config.codex.childSession?.config ?? {}),
    ...(config.childSession?.config ?? {}),
  };
  const configuredChildSession = {
    ...(config.codex.childSession ?? {}),
    ...(config.childSession ?? {}),
    ...(Object.keys(configuredChildSessionConfig).length > 0 ? { config: configuredChildSessionConfig } : {}),
  };
  const resolvedChildSession = {
    cwdAbs: workspaceRoot,
    speed: configuredChildSession.speed ?? 'derive',
    ...(configuredChildSession.model !== undefined ? { model: configuredChildSession.model } : {}),
    ...(configuredChildSession.approvalPolicy !== undefined
      ? { approvalPolicy: configuredChildSession.approvalPolicy }
      : {}),
    ...(configuredChildSession.sandbox !== undefined ? { sandbox: configuredChildSession.sandbox } : {}),
    ...(configuredChildSession.config !== undefined ? { config: configuredChildSession.config } : {}),
    ...(overrides.model !== undefined ? { model: overrides.model } : {}),
    ...(overrides.approvalPolicy !== undefined ? { approvalPolicy: overrides.approvalPolicy } : {}),
    ...(overrides.sandbox !== undefined ? { sandbox: overrides.sandbox } : {}),
    ...(Object.keys(childSessionConfig).length > 0
      ? { config: { ...(configuredChildSession.config ?? {}), ...childSessionConfig } }
      : {}),
  };

  return {
    version: 1,
    configPath,
    workspace: { rootAbs: workspaceRoot },
    paths: {
      tracksDir,
      tracksDirAbs: path.resolve(workspaceRoot, tracksDir),
      archiveDir,
      archiveDirAbs: path.resolve(workspaceRoot, archiveDir),
    },
    artifacts: {
      rootDir: artifactRootDir,
      rootDirAbs: path.resolve(workspaceRoot, artifactRootDir),
      runsDirAbs: path.resolve(workspaceRoot, artifactRootDir, 'runs'),
    },
    statuses: {
      eligible: config.statuses.eligible,
      inProgress: config.statuses.inProgress,
      complete: config.statuses.complete,
    },
    tracker: { idPattern: config.tracker.idPattern },
    git: config.git,
    pr: config.pr,
    implement: config.implement,
    agents,
    orchestrator: {
      driver,
      maxParallel,
      stopLaunchingOnBlocked: config.orchestrator.stopLaunchingOnBlocked,
      watch: config.orchestrator.watch,
      childTimeoutMs: childNoProgressTimeoutMs,
      childNoProgressTimeoutMs,
      childStartupTimeoutMs,
      childMaxRuntimeMs,
      childReviewWaitTimeoutMs: config.orchestrator.childReviewWaitTimeoutMs,
    },
    childSession: resolvedChildSession,
    codex: { childSession: resolvedChildSession },
  };
}

export function resolveCwdOnlyConfig(cwd = process.cwd()): ResolvedWorkflowConfig {
  const workspaceRoot = path.resolve(cwd);
  const config = ConfigSchema.parse({ version: 1 });
  const driver: OrchestratorDriver = 'codex-mcp';
  const artifactRootDir = artifactRootDirForDriver(driver);
  const resolvedChildSession = { cwdAbs: workspaceRoot, speed: 'derive' as const };
  return {
    version: 1,
    configPath: path.resolve(workspaceRoot, '.workflow/config.yaml'),
    workspace: { rootAbs: workspaceRoot },
    paths: {
      tracksDir: 'docs/tracks',
      tracksDirAbs: path.resolve(workspaceRoot, 'docs/tracks'),
      archiveDir: 'docs/tracks/archive',
      archiveDirAbs: path.resolve(workspaceRoot, 'docs/tracks/archive'),
    },
    artifacts: {
      rootDir: artifactRootDir,
      rootDirAbs: path.resolve(workspaceRoot, artifactRootDir),
      runsDirAbs: path.resolve(workspaceRoot, artifactRootDir, 'runs'),
    },
    statuses: {
      eligible: ['specced', 'plan-approved'],
      inProgress: 'implementing',
      complete: ['done', 'verified'],
    },
    tracker: { idPattern: '^[A-Z]{2,}[0-9]+$' },
    git: {
      strategy: 'worktree',
      branchPattern: '{track}/{id-lc}-{slug}',
      baseBranch: 'main',
      commitOnBase: 'forbid',
      worktreeDir: '.worktrees',
    },
    pr: {
      create: true,
      ci: { wait: false, command: null },
      review: {
        wait: 'none',
        bot: 'none',
        triageComments: false,
        maxFixBatches: 1,
        rerequestAfterFix: false,
        waitTimeoutMinutes: 30,
      },
      merge: { auto: false, method: 'squash', deleteBranch: true },
    },
    implement: {
      review: {
        prePr: { enabled: true, mode: 'auto', maxLoops: 2, loopMode: 'incremental', downgradeTo: 'none' },
        semanticChecks: { enabled: true },
      },
      subagents: { enabled: true, maxParallel: 2, allowWorkers: false },
    },
    agents: resolveAgentProfiles(config),
    orchestrator: {
      driver,
      maxParallel: 2,
      stopLaunchingOnBlocked: true,
      watch: {
        enabled: false,
        wait: false,
        intervalMs: DEFAULT_WATCH_INTERVAL_MS,
        timeoutMs: DEFAULT_WATCH_TIMEOUT_MS,
      },
      childTimeoutMs: 1_800_000,
      childNoProgressTimeoutMs: 1_800_000,
      childStartupTimeoutMs: DEFAULT_CHILD_STARTUP_TIMEOUT_MS,
      childMaxRuntimeMs: 7_200_000,
      childReviewWaitTimeoutMs: 1_800_000,
    },
    childSession: resolvedChildSession,
    codex: { childSession: resolvedChildSession },
  };
}

export function createRunId(now = () => new Date().toISOString()): string {
  return now().replace(/[:.]/g, '-');
}

function resolveDriver(value: string): OrchestratorDriver {
  if (!SUPPORTED_DRIVERS.has(value as OrchestratorDriver)) {
    throw new Error(unsupportedDriverMessage(value));
  }
  return value as OrchestratorDriver;
}

function resolveAgentProfiles(
  config: Pick<WorkflowConfig, 'agents'>,
  overrides: CliOverrides = {},
): ResolvedWorkflowConfig['agents'] {
  const resolved = Object.fromEntries(
    AGENT_TASK_TYPES.map((taskType) => {
      const name = config.agents.bindings[taskType];
      const profile = config.agents.profiles[name];
      const effectiveModel =
        taskType === 'implementStory' && overrides.model !== undefined ? overrides.model : profile.model;
      const effectiveReasoning =
        taskType === 'implementStory' && overrides.reasoning !== undefined ? overrides.reasoning : profile.reasoning;
      const resolvedProfile: ResolvedAgentProfile = {
        ...profile,
        name,
        taskType,
        effectiveModel,
        effectiveReasoning,
        budgetSupport: budgetSupportFor(profile.budget),
        capabilityWarnings: capabilityWarningsFor(profile),
      };
      return [taskType, resolvedProfile];
    }),
  ) as Record<AgentTaskType, ResolvedAgentProfile>;

  return {
    profiles: config.agents.profiles,
    bindings: config.agents.bindings,
    resolved,
  };
}

function budgetSupportFor(budget: AgentBudgetPolicy): Record<keyof AgentBudgetPolicy, AgentBudgetSupport> {
  return {
    wallMs: { enforceable: budget.wallMs.limit !== null, unavailableReason: null },
    tokens: { enforceable: false, unavailableReason: UNAVAILABLE_TOKEN_BUDGET_REASON },
    toolCalls: { enforceable: budget.toolCalls.limit !== null, unavailableReason: null },
    failedToolCalls: { enforceable: budget.failedToolCalls.limit !== null, unavailableReason: null },
    costUsd: { enforceable: false, unavailableReason: UNAVAILABLE_COST_BUDGET_REASON },
  };
}

function capabilityWarningsFor(profile: WorkflowConfig['agents']['profiles'][string]): string[] {
  if (profile.driver !== 'inline') return [];
  const warnings: string[] = [];
  if (profile.model !== null) warnings.push('inline profile model is visible but not consumed by a host driver');
  if (profile.reasoning !== null)
    warnings.push('inline profile reasoning is visible but not consumed by a host driver');
  if (profile.approvalPolicy !== null)
    warnings.push('inline profile approvalPolicy is visible but not consumed by a host driver');
  if (profile.sandbox !== null) warnings.push('inline profile sandbox is visible but not consumed by a host driver');
  if (Object.keys(profile.host).length > 0)
    warnings.push('inline profile host settings are visible but not consumed by a host driver');
  return warnings;
}
