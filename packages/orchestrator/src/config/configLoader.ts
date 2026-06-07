import path from 'node:path';

import type { CliOverrides, OrchestratorDriver, ResolvedWorkflowConfig } from '../types.js';
import { loadConfig } from './resolve.js';

const SUPPORTED_DRIVERS = new Set<OrchestratorDriver>(['codex-mcp']);

export async function loadResolvedConfig(
  overrides: CliOverrides = {},
  cwd = process.cwd(),
): Promise<ResolvedWorkflowConfig> {
  const { config, workspaceRoot, configPath } = await loadConfig({
    cwd,
    configPath: overrides.configPath,
  });

  const driver = resolveDriver(config.orchestrator.driver);
  const tracksDir = overrides.tracksDir ?? config.paths.tracksDir;
  const archiveDir = config.paths.archiveDir;
  const maxParallel = overrides.maxParallel ?? config.orchestrator.maxParallel;
  const childTimeoutMs = overrides.childTimeoutMs ?? config.orchestrator.childTimeoutMs;
  const childSessionConfig: Record<string, unknown> = {};
  if (overrides.reasoning !== undefined) {
    childSessionConfig.model_reasoning_effort = overrides.reasoning;
  }

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
      rootDir: '.codex/agentic-workflow-kit',
      rootDirAbs: path.resolve(workspaceRoot, '.codex/agentic-workflow-kit'),
      runsDirAbs: path.resolve(workspaceRoot, '.codex/agentic-workflow-kit/runs'),
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
    orchestrator: {
      driver,
      maxParallel,
      stopLaunchingOnBlocked: config.orchestrator.stopLaunchingOnBlocked,
      childTimeoutMs,
    },
    codex: {
      childSession: {
        cwdAbs: workspaceRoot,
        ...(overrides.model !== undefined ? { model: overrides.model } : {}),
        ...(overrides.approvalPolicy !== undefined ? { approvalPolicy: overrides.approvalPolicy } : {}),
        ...(overrides.sandbox !== undefined ? { sandbox: overrides.sandbox } : {}),
        ...(Object.keys(childSessionConfig).length > 0 ? { config: childSessionConfig } : {}),
      },
    },
  };
}

export function resolveCwdOnlyConfig(cwd = process.cwd()): ResolvedWorkflowConfig {
  const workspaceRoot = path.resolve(cwd);
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
      rootDir: '.codex/agentic-workflow-kit',
      rootDirAbs: path.resolve(workspaceRoot, '.codex/agentic-workflow-kit'),
      runsDirAbs: path.resolve(workspaceRoot, '.codex/agentic-workflow-kit/runs'),
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
    },
    pr: {
      create: true,
      ci: { wait: false, command: null },
      review: { wait: 'none', bot: 'none', triageComments: false, maxLoops: 3, waitTimeoutMinutes: 30 },
      merge: { auto: false, method: 'squash', deleteBranch: true },
    },
    implement: {
      review: {
        prePr: { enabled: true, mode: 'inline', maxLoops: 2 },
        semanticChecks: { enabled: true },
      },
      subagents: { enabled: true, maxParallel: 2, allowWorkers: false },
    },
    orchestrator: {
      driver: 'codex-mcp',
      maxParallel: 2,
      stopLaunchingOnBlocked: true,
      childTimeoutMs: 1_800_000,
    },
    codex: {
      childSession: { cwdAbs: workspaceRoot },
    },
  };
}

export function createRunId(now = () => new Date().toISOString()): string {
  return now().replace(/[:.]/g, '-');
}

function resolveDriver(value: string): OrchestratorDriver {
  if (!SUPPORTED_DRIVERS.has(value as OrchestratorDriver)) {
    throw new Error(`Unsupported orchestrator.driver "${value}". Supported drivers: codex-mcp.`);
  }
  return value as OrchestratorDriver;
}
