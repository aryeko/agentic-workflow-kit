import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createRunId, loadResolvedConfig, resolveCwdOnlyConfig } from '../src/config/configLoader';
import {
  artifactRootDirForDriver,
  createStoryRunner,
  DEFAULT_ARTIFACT_ROOT_DIR,
  supportedDriverNames,
} from '../src/drivers/registry';

async function writeWorkflowConfig(root: string, yaml: string): Promise<void> {
  await mkdir(path.join(root, '.workflow'), { recursive: true });
  await writeFile(path.join(root, '.workflow', 'config.yaml'), yaml);
}

describe('loadResolvedConfig', () => {
  it('loads a full agentic-workflow-kit config and resolves orchestrator defaults', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-'));
    await writeWorkflowConfig(
      root,
      `
version: 1
paths:
  tracksDir: docs/tracks
  archiveDir: docs/tracks/archive
statuses:
  eligible: [specced, plan-approved]
  inProgress: implementing
  complete: [done, verified]
tracker:
  idPattern: "^[A-Z]{2,}[0-9]+$"
verify:
  changed: pnpm check:changed
  full: pnpm check
git:
  strategy: worktree
  branchPattern: "{track}/{id-lc}-{slug}"
  baseBranch: main
  commitOnBase: forbid
pr:
  create: true
  ci:
    wait: false
    command: null
  review:
    wait: none
    bot: none
    triageComments: false
  merge:
    auto: false
    method: squash
    deleteBranch: true
orchestrator:
  driver: codex-mcp
  maxParallel: 3
  stopLaunchingOnBlocked: false
  childTimeoutMs: 9000
`,
    );

    const config = await loadResolvedConfig({}, root);

    expect(config.version).toBe(1);
    expect(config.configPath).toBe(path.join(root, '.workflow', 'config.yaml'));
    expect(config.workspace.rootAbs).toBe(root);
    expect(config.paths.tracksDirAbs).toBe(path.join(root, 'docs/tracks'));
    expect(config.paths.archiveDirAbs).toBe(path.join(root, 'docs/tracks/archive'));
    expect(config.artifacts.rootDir).toBe(DEFAULT_ARTIFACT_ROOT_DIR);
    expect(config.artifacts.rootDirAbs).toBe(path.join(root, DEFAULT_ARTIFACT_ROOT_DIR));
    expect(config.artifacts.runsDirAbs).toBe(path.join(root, DEFAULT_ARTIFACT_ROOT_DIR, 'runs'));
    expect(config.statuses.eligible).toEqual(['specced', 'plan-approved']);
    expect(config.statuses.complete).toEqual(['done', 'verified']);
    expect(config.orchestrator).toMatchObject({
      driver: 'codex-mcp',
      maxParallel: 3,
      stopLaunchingOnBlocked: false,
      watch: {
        enabled: false,
        wait: false,
        intervalMs: 300_000,
        timeoutMs: 300_000,
      },
      childTimeoutMs: 9000,
      childNoProgressTimeoutMs: 9000,
      childStartupTimeoutMs: 60_000,
      childMaxRuntimeMs: 7_200_000,
    });
    expect(config.git).toEqual({
      strategy: 'worktree',
      branchPattern: '{track}/{id-lc}-{slug}',
      baseBranch: 'main',
      commitOnBase: 'forbid',
      worktreeDir: '.worktrees',
    });
    expect(config.pr).toEqual({
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
    });
    expect(config.implement).toEqual({
      review: {
        prePr: { enabled: true, mode: 'auto', maxLoops: 2, loopMode: 'incremental' },
        semanticChecks: { enabled: true },
      },
      subagents: { enabled: true, maxParallel: 2, allowWorkers: false },
    });
    expect(config.agents.bindings.implementStory).toBe('storyImplementer');
    expect(config.agents.resolved.implementStory).toMatchObject({
      name: 'storyImplementer',
      taskType: 'implementStory',
      driver: 'codex-mcp',
      prompt: { template: 'built-in/story-implementer' },
      structuredOutput: { schema: 'built-in/child-run-result', required: true },
      effectiveModel: null,
      effectiveReasoning: 'medium',
    });
    expect(config.agents.resolved.implementStory.budgetSupport.tokens).toEqual({
      enforceable: false,
      unavailableReason: 'live token telemetry is not available before AWK06/AWK08 budget enforcement',
    });
    expect(config.codex.childSession).toEqual({ cwdAbs: root });
    expect(config.childSession).toBe(config.codex.childSession);
  });

  it('exposes driver registry helpers for configured runner creation and artifact roots', () => {
    const config = resolveCwdOnlyConfig('/repo');
    const runner = createStoryRunner(config);

    expect(supportedDriverNames()).toEqual(['codex-mcp']);
    expect(artifactRootDirForDriver('codex-mcp')).toBe(DEFAULT_ARTIFACT_ROOT_DIR);
    expect(typeof runner.runStory).toBe('function');
    expect(typeof runner.checkTools).toBe('function');
  });

  it('copies non-default git policy and child timeout overrides into the resolved config', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-git-'));
    await writeWorkflowConfig(
      root,
      `
version: 1
git:
  strategy: branch
  branchPattern: "stories/{id-lc}"
  baseBranch: trunk
  commitOnBase: allow
orchestrator:
  childTimeoutMs: 42
`,
    );

    const config = await loadResolvedConfig({ childTimeoutMs: 84 }, root);

    expect(config.git).toEqual({
      strategy: 'branch',
      branchPattern: 'stories/{id-lc}',
      baseBranch: 'trunk',
      commitOnBase: 'allow',
      worktreeDir: '.worktrees',
    });
    expect(config.orchestrator.childTimeoutMs).toBe(84);
    expect(config.orchestrator.childNoProgressTimeoutMs).toBe(84);
    expect(config.orchestrator.childStartupTimeoutMs).toBe(60_000);
    expect(config.orchestrator.childMaxRuntimeMs).toBe(7_200_000);
  });

  it('resolves configured git.worktreeDir', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-worktree-dir-'));
    await writeWorkflowConfig(
      root,
      `
version: 1
git:
  strategy: worktree
  branchPattern: "{track}/{id-lc}-{slug}"
  baseBranch: main
  commitOnBase: forbid
  worktreeDir: .wk-worktrees
`,
    );

    const config = await loadResolvedConfig({}, root);

    expect(config.git.worktreeDir).toBe('.wk-worktrees');
  });

  it('rejects git.worktreeDir values that escape the workspace', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-bad-worktree-dir-'));
    await writeWorkflowConfig(root, 'version: 1\ngit:\n  worktreeDir: ../outside\n');

    await expect(loadResolvedConfig({}, root)).rejects.toThrow(/git\.worktreeDir/);
  });

  it('rejects configured repo-relative paths that escape the workspace', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-bad-paths-'));
    await writeWorkflowConfig(root, 'version: 1\npaths:\n  tracksDir: ../../etc\n');

    await expect(loadResolvedConfig({}, root)).rejects.toThrow(/paths\.tracksDir/);
  });

  it('rejects tracksDir overrides that escape the workspace', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-bad-override-'));
    await writeWorkflowConfig(root, 'version: 1\n');

    await expect(loadResolvedConfig({ tracksDir: '../../etc' }, root)).rejects.toThrow(/tracksDir/);
    await expect(loadResolvedConfig({ tracksDir: 'C:tracks' }, root)).rejects.toThrow(/tracksDir/);
  });

  it('applies documented defaults for missing optional keys', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-defaults-'));
    await writeWorkflowConfig(root, 'version: 1\n');

    const config = await loadResolvedConfig({}, root);

    expect(config.paths.tracksDir).toBe('docs/tracks');
    expect(config.paths.archiveDir).toBe('docs/tracks/archive');
    expect(config.statuses.eligible).toEqual(['specced', 'plan-approved']);
    expect(config.statuses.complete).toEqual(['done', 'verified']);
    expect(config.tracker.idPattern).toBe('^[A-Z]{2,}[0-9]+$');
    expect(config.orchestrator.driver).toBe('codex-mcp');
    expect(config.orchestrator.maxParallel).toBe(2);
    expect(config.orchestrator.stopLaunchingOnBlocked).toBe(true);
    expect(config.orchestrator.childTimeoutMs).toBe(1_800_000);
    expect(config.orchestrator.childNoProgressTimeoutMs).toBe(1_800_000);
    expect(config.orchestrator.childStartupTimeoutMs).toBe(60_000);
    expect(config.orchestrator.childMaxRuntimeMs).toBe(7_200_000);
    expect(config.git).toEqual({
      strategy: 'worktree',
      branchPattern: '{track}/{id-lc}-{slug}',
      baseBranch: 'main',
      commitOnBase: 'forbid',
      worktreeDir: '.worktrees',
    });
    expect(config.pr).toEqual({
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
    });
    expect(config.implement).toEqual({
      review: {
        prePr: { enabled: true, mode: 'auto', maxLoops: 2, loopMode: 'incremental' },
        semanticChecks: { enabled: true },
      },
      subagents: { enabled: true, maxParallel: 2, allowWorkers: false },
    });
  });

  it('preserves child-session CLI overrides for the Codex MCP driver', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-child-'));
    await writeWorkflowConfig(root, 'version: 1\n');

    const config = await loadResolvedConfig(
      {
        cwd: root,
        model: 'gpt-5.5',
        reasoning: 'medium',
        approvalPolicy: 'on-request',
        sandbox: 'workspace-write',
      },
      root,
    );

    expect(config.codex.childSession).toMatchObject({
      cwdAbs: root,
      model: 'gpt-5.5',
      approvalPolicy: 'on-request',
      sandbox: 'workspace-write',
      config: {
        model_reasoning_effort: 'medium',
      },
    });
    expect(config.agents.resolved.implementStory.effectiveModel).toBe('gpt-5.5');
    expect(config.agents.resolved.implementStory.effectiveReasoning).toBe('medium');
    expect(config.agents.profiles.storyImplementer.model).toBeNull();
    expect(config.agents.profiles.storyImplementer.reasoning).toBe('medium');
  });

  it('resolves neutral childSession and keeps codex as a compatibility alias', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-neutral-child-'));
    await writeWorkflowConfig(
      root,
      `
version: 1
childSession:
  model: gpt-5.2
  approvalPolicy: on-request
  sandbox: workspace-write
  config:
    model_reasoning_effort: high
`,
    );

    const config = await loadResolvedConfig({}, root);

    expect(config.childSession).toEqual({
      cwdAbs: root,
      model: 'gpt-5.2',
      approvalPolicy: 'on-request',
      sandbox: 'workspace-write',
      config: { model_reasoning_effort: 'high' },
    });
    expect(config.codex.childSession).toBe(config.childSession);
  });

  it('accepts legacy codex childSession while preferring neutral childSession when both exist', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-child-alias-'));
    await writeWorkflowConfig(
      root,
      `
version: 1
codex:
  childSession:
    model: legacy-model
    approvalPolicy: never
    sandbox: workspace-write
    config:
      raw: true
      shared: legacy
childSession:
  model: neutral-model
  approvalPolicy: on-request
  config:
    shared: neutral
`,
    );

    const config = await loadResolvedConfig({}, root);

    expect(config.childSession).toMatchObject({
      cwdAbs: root,
      model: 'neutral-model',
      approvalPolicy: 'on-request',
      sandbox: 'workspace-write',
      config: {
        raw: true,
        shared: 'neutral',
      },
    });
    expect(config.codex.childSession).toBe(config.childSession);
  });

  it('resolves legacy childTimeoutMs as the no-progress timeout', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-legacy-timeout-'));
    await writeWorkflowConfig(
      root,
      `
version: 1
orchestrator:
  childTimeoutMs: 60000
`,
    );

    const config = await loadResolvedConfig({}, root);

    expect(config.orchestrator.childTimeoutMs).toBe(60_000);
    expect(config.orchestrator.childNoProgressTimeoutMs).toBe(60_000);
    expect(config.orchestrator.childStartupTimeoutMs).toBe(60_000);
    expect(config.orchestrator.childMaxRuntimeMs).toBe(7_200_000);
  });

  it('resolves explicit no-progress and wall-clock child timeouts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-split-timeout-'));
    await writeWorkflowConfig(
      root,
      `
version: 1
orchestrator:
  childNoProgressTimeoutMs: 120000
  childStartupTimeoutMs: 45000
  childMaxRuntimeMs: 3600000
`,
    );

    const config = await loadResolvedConfig({}, root);

    expect(config.orchestrator.childTimeoutMs).toBe(120_000);
    expect(config.orchestrator.childNoProgressTimeoutMs).toBe(120_000);
    expect(config.orchestrator.childStartupTimeoutMs).toBe(45_000);
    expect(config.orchestrator.childMaxRuntimeMs).toBe(3_600_000);
  });

  it('rejects unsupported drivers early', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-driver-'));
    await writeWorkflowConfig(root, 'version: 1\norchestrator:\n  driver: claude-mcp\n');

    await expect(loadResolvedConfig({}, root)).rejects.toThrow(
      'Unsupported orchestrator.driver "claude-mcp". Supported drivers: codex-mcp.',
    );
  });

  it('resolves a cwd-only config without reading .workflow/config.yaml', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-cwd-only-'));

    const config = resolveCwdOnlyConfig(root);

    expect(config.workspace.rootAbs).toBe(root);
    expect(config.artifacts.rootDir).toBe(DEFAULT_ARTIFACT_ROOT_DIR);
    expect(config.artifacts.runsDirAbs).toBe(path.join(root, DEFAULT_ARTIFACT_ROOT_DIR, 'runs'));
    expect(config.codex.childSession.cwdAbs).toBe(root);
    expect(config.childSession).toBe(config.codex.childSession);
    expect(config.agents.bindings.prePrReview).toBe('prePrReviewer');
    expect(config.agents.resolved.prePrReview.prompt.template).toBe('built-in/pre-pr-reviewer');
    expect(config.orchestrator.childTimeoutMs).toBe(1_800_000);
    expect(config.orchestrator.childNoProgressTimeoutMs).toBe(1_800_000);
    expect(config.orchestrator.childStartupTimeoutMs).toBe(60_000);
    expect(config.orchestrator.childMaxRuntimeMs).toBe(7_200_000);
    expect(config.git).toEqual({
      strategy: 'worktree',
      branchPattern: '{track}/{id-lc}-{slug}',
      baseBranch: 'main',
      commitOnBase: 'forbid',
      worktreeDir: '.worktrees',
    });
  });

  it('keeps full config loading strict when .workflow/config.yaml is missing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-missing-'));

    await expect(loadResolvedConfig({}, root)).rejects.toThrow(
      'Missing .workflow/config.yaml. Run /workflow-init before using agentic-workflow-kit orchestrator.',
    );
  });

  it('creates filesystem-safe run IDs', () => {
    expect(createRunId(() => '2026-06-02T10:11:12.123Z')).toBe('2026-06-02T10-11-12-123Z');
  });

  it('reports all Zod validation issues when multiple fields are invalid', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-multi-issue-'));
    await writeWorkflowConfig(
      root,
      `
version: 1
git:
  strategy: invalid-strategy
  baseBranch: 123
`,
    );

    await expect(loadResolvedConfig({}, root)).rejects.toSatisfy((error: unknown) => {
      const message = error instanceof Error ? error.message : '';
      return message.includes('git.strategy') && message.includes('git.baseBranch');
    });
  });
});
