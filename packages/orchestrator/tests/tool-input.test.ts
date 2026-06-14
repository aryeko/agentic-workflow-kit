import { describe, expect, it } from 'vitest';
import { resolveCwdOnlyConfig } from '../src/config/configLoader';
import { buildCodexToolInput, buildGenericPrompt } from '../src/drivers/codex-mcp/toolInput';
import { renderStoryImplementerPrompt } from '../src/drivers/promptRenderer';
import type { ResolvedWorkflowConfig, WorkflowStory } from '../src/types';

const config: ResolvedWorkflowConfig = {
  version: 1,
  configPath: '/repo/.workflow/config.yaml',
  workspace: { rootAbs: '/repo' },
  paths: {
    tracksDir: 'docs/tracks',
    tracksDirAbs: '/repo/docs/tracks',
    archiveDir: 'docs/tracks/archive',
    archiveDirAbs: '/repo/docs/tracks/archive',
  },
  artifacts: {
    rootDir: '.codex/agentic-workflow-kit',
    rootDirAbs: '/repo/.codex/agentic-workflow-kit',
    runsDirAbs: '/repo/.codex/agentic-workflow-kit/runs',
  },
  statuses: { eligible: ['specced'], inProgress: 'implementing', complete: ['done'] },
  tracker: { idPattern: '^[A-Z]+[0-9]+$' },
  git: {
    strategy: 'worktree',
    branchPattern: '{track}/{id-lc}-{slug}',
    baseBranch: 'main',
    commitOnBase: 'forbid',
    worktreeDir: '.worktrees',
  },
  pr: {
    create: true,
    ci: { wait: true, command: null },
    review: {
      wait: 'bot',
      bot: 'codex',
      triageComments: true,
      maxFixBatches: 1,
      rerequestAfterFix: false,
      waitTimeoutMinutes: 30,
    },
    merge: { auto: true, method: 'squash', deleteBranch: true },
  },
  implement: {
    review: {
      prePr: { enabled: true, mode: 'auto', maxLoops: 2, loopMode: 'incremental' },
      semanticChecks: { enabled: true },
    },
    subagents: { enabled: true, maxParallel: 2, allowWorkers: false },
  },
  agents: resolveCwdOnlyConfig('/repo').agents,
  orchestrator: {
    driver: 'codex-mcp',
    maxParallel: 2,
    stopLaunchingOnBlocked: true,
    watch: { enabled: false, wait: false, intervalMs: 300_000, timeoutMs: 300_000 },
    childTimeoutMs: 1_800_000,
    childNoProgressTimeoutMs: 1_800_000,
    childStartupTimeoutMs: 60_000,
    childMaxRuntimeMs: 7_200_000,
  },
  childSession: { cwdAbs: '/repo' },
  codex: { childSession: { cwdAbs: '/repo' } },
};

const story: WorkflowStory = {
  id: 'L002',
  title: 'Pilot',
  status: 'specced',
  owner: null,
  dependencies: ['L001'],
  eligible: true,
  blockedReason: null,
  metadata: {
    trackId: 'linkly',
    trackTitle: 'Linkly tracker',
    trackerPath: 'docs/tracks/linkly/README.md',
    order: 2,
    wave: '2',
    spec: '[spec](../../specs/l002.md)',
    plan: '—',
  },
};

describe('buildGenericPrompt', () => {
  it('uses the host-neutral story prompt renderer without Codex-only tool names', () => {
    const prompt = renderStoryImplementerPrompt(story, config);

    expect(buildGenericPrompt(story, config)).toBe(prompt);
    expect(prompt).not.toContain('@codex');
    expect(prompt).not.toContain('codex_reply');
    expect(prompt).not.toContain('codex_interrupt');
    expect(prompt).not.toContain('check_codex_mcp');
  });

  it('builds a one-story prompt with tracker context and completion rules', () => {
    const prompt = buildGenericPrompt(story, config);
    expect(prompt).toContain('Implement exactly one workflow tracker story');
    expect(prompt).toContain('- ID: L002');
    expect(prompt).toContain('- Tracker file: docs/tracks/linkly/README.md');
    expect(prompt).toContain('Do not bundle adjacent tracker rows');
    expect(prompt).toContain('The tracker row status is the only completion authority');
  });

  it('includes the resolved forbidden git policy', () => {
    const prompt = buildGenericPrompt(story, config);

    expect(prompt).toContain('Git policy');
    expect(prompt).toContain('- Isolation strategy: worktree');
    expect(prompt).toContain('- Create/use branch: linkly/l002-pilot (base: main)');
    expect(prompt).toContain('- Worktree directory: .worktrees under the workspace root.');
    expect(prompt).toContain('- Expected worktree path: /repo/.worktrees/l002-pilot');
    expect(prompt).toContain('The parent orchestrator has already prepared the expected branch/worktree.');
    expect(prompt).toContain('You are launched in the expected worktree cwd.');
    expect(prompt).toContain('Committing directly on `main` is forbidden.');
    expect(prompt).toContain('commit your work there, and confirm the commit exists BEFORE reporting the story done');
    expect(prompt).toContain('An uncommitted tracker edit is not acceptance.');
    expect(prompt).toContain('Do not create story worktrees outside the workspace root');
    expect(prompt).toContain('Do not symlink node_modules from another checkout');
  });

  it('renders permissive base-commit wording when commitOnBase is allow', () => {
    const prompt = buildGenericPrompt(story, { ...config, git: { ...config.git, commitOnBase: 'allow' } });

    expect(prompt).toContain('Committing directly on `main` is allowed by this repo policy.');
  });

  it('describes bot review as reaction/comment based rather than native GitHub approval based', () => {
    const prompt = buildGenericPrompt(story, config);

    expect(prompt).toContain('PR policy (from .workflow/config.yaml - follow exactly):');
    expect(prompt).toContain('- Review gate: wait for bot `codex`.');
    expect(prompt).toContain('Bot review signal is reaction/comment based, not a native GitHub approval gate.');
    expect(prompt).toContain('Check PR body reactions, issue comments, and PR review comments');
    expect(prompt).toContain('A +1 reaction from bot `codex` means approval');
    expect(prompt).toContain('An eyes reaction from bot `codex` means review is pending');
    expect(prompt).toContain('PR review comments or PR comments are findings');
    expect(prompt).toContain(
      'Do not require a GitHub PullRequestReview APPROVED or CHANGES_REQUESTED state from the review bot.',
    );
    expect(prompt).toContain('Do not re-request review after a +1 reaction has been observed.');
    expect(prompt).not.toContain('@codex');
    expect(prompt).toContain('Final evidence MUST include the PR URL and PR number.');
    expect(prompt).toContain('Final evidence MUST include CI/check evidence');
    expect(prompt).toContain('Final evidence MUST include bot review evidence');
    expect(prompt).toContain('Final evidence MUST include merge evidence');
    expect(prompt).toContain('Final evidence MUST identify blockers');
  });

  it('includes interactive implementation review and subagent policy', () => {
    const prompt = buildGenericPrompt(story, config);

    expect(prompt).toContain('Implementation policy (from .workflow/config.yaml - follow exactly):');
    expect(prompt).toContain('- Pre-PR review: enabled, mode auto, max loops 2, loop mode incremental.');
    expect(prompt).toContain('- Semantic checks: enabled.');
    expect(prompt).toContain('- Sidecar subagents: enabled, max parallel 2.');
    expect(prompt).toContain('- Worker subagents may write files: no.');
    expect(prompt).toContain('Workers require disjoint write scopes and explicit permission.');
    expect(prompt).toContain('auto downgrades to inline, record/report the downgrade');
    expect(prompt).toContain('subagent cannot spawn a reviewer, fail closed');
    expect(prompt).toContain('- PR review fix batches: 1.');
    expect(prompt).toContain('- Re-request review after fixes: no.');
  });

  it('requires child preflight, review packet validation, and rendered verification fallback evidence', () => {
    const prompt = buildGenericPrompt(story, config);

    expect(prompt).toContain('Before editing, verify the parent-prepared worktree');
    expect(prompt).toContain('cwd must be `/repo/.worktrees/l002-pilot`');
    expect(prompt).toContain('git top-level must be `/repo/.worktrees/l002-pilot`');
    expect(prompt).toContain('current branch must be `linkly/l002-pilot`');
    expect(prompt).toContain(
      'If cwd, git top-level, branch, or worktree path verification fails, stop and report the blocker before editing.',
    );
    expect(prompt).toContain('configured base branch');
    expect(prompt).not.toContain('needs-create/expected');
    expect(prompt).toContain('Validate reviewer payloads before calling');
    expect(prompt).toContain('product docs, architecture docs, story brief, spec, and plan');
    expect(prompt).toContain('correctness, code quality, and spec compliance');
    expect(prompt).toContain('If Browser rendered verification is unavailable');
    expect(prompt).toContain('fall back to repo Playwright/e2e gates');
    expect(prompt).toContain('record the rendered-verification downgrade reason and evidence');
    expect(prompt).toContain('Do not re-request review after fix batches when rerequestAfterFix is false');
  });
});

describe('buildCodexToolInput', () => {
  it('builds codex MCP input for the child session', () => {
    expect(buildCodexToolInput(config, story)).toMatchObject({
      cwd: '/repo',
      prompt: expect.stringContaining('- ID: L002'),
    });
  });

  it('uses the prompt passed through the story runner boundary', () => {
    expect(buildCodexToolInput(config, story, 'custom prompt', '/repo/.worktrees/l002-pilot')).toMatchObject({
      cwd: '/repo/.worktrees/l002-pilot',
      prompt: 'custom prompt',
    });
  });

  it('passes child-session overrides through to Codex MCP input', () => {
    expect(
      buildCodexToolInput(
        {
          ...config,
          codex: {
            childSession: {
              cwdAbs: '/repo',
              model: 'gpt-5.5',
              approvalPolicy: 'on-request',
              sandbox: 'workspace-write',
              config: {
                model_reasoning_effort: 'medium',
              },
            },
          },
        },
        story,
        'custom prompt',
      ),
    ).toMatchObject({
      cwd: '/repo',
      prompt: 'custom prompt',
      model: 'gpt-5.5',
      'approval-policy': 'on-request',
      sandbox: 'workspace-write',
      // model_reasoning_effort must survive the merge (D8 must not overwrite existing config keys)
      config: expect.objectContaining({ model_reasoning_effort: 'medium' }),
    });
  });

  it('prefers resolved implementStory profile launch policy without sending WorkflowKit metadata as Codex config', () => {
    const profile = {
      ...config.agents.resolved.implementStory,
      effectiveModel: 'gpt-5.5',
      effectiveReasoning: 'high',
      approvalPolicy: 'never',
      sandbox: 'workspace-write',
    };
    const promptMetadata = {
      template: profile.prompt.template,
      promptHash: 'hash-123',
      structuredOutputSchema: profile.structuredOutput.schema,
      structuredOutputRequired: profile.structuredOutput.required,
    };
    const result = buildCodexToolInput(
      {
        ...config,
        codex: {
          childSession: {
            cwdAbs: '/repo',
            model: 'legacy-model',
            approvalPolicy: 'on-request',
            sandbox: 'danger-full-access',
            config: { model_reasoning_effort: 'legacy-low' },
          },
        },
      },
      story,
      'custom prompt',
      '/repo/.worktrees/l002-pilot',
      profile,
      promptMetadata,
    );

    expect(result).toMatchObject({
      cwd: '/repo/.worktrees/l002-pilot',
      prompt: 'custom prompt',
      model: 'gpt-5.5',
      'approval-policy': 'never',
      sandbox: 'workspace-write',
      config: expect.objectContaining({
        model_reasoning_effort: 'legacy-low',
      }),
    });
    expect(result.config).not.toHaveProperty('workflowkit_profile');
    expect(result.config).not.toHaveProperty('workflowkit_structured_output');
  });

  // D8: writable roots are always injected so the child can git commit / git worktree add under
  // --sandbox workspace-write. Harmless under danger-full-access or read-only.
  it('always injects sandbox_workspace_write.writable_roots into config (D8)', () => {
    const result = buildCodexToolInput(config, story, 'p');
    expect(result.config).toEqual(
      expect.objectContaining({
        sandbox_workspace_write: {
          writable_roots: ['/repo/.git', '/repo/.worktrees'],
        },
      }),
    );
  });

  it('merges pre-existing config entries with the injected writable roots (D8)', () => {
    const result = buildCodexToolInput(
      {
        ...config,
        codex: {
          childSession: {
            cwdAbs: '/repo',
            config: { model_reasoning_effort: 'high' },
          },
        },
      },
      story,
      'p',
    );
    // Both keys must be present — merge, not overwrite
    expect(result.config).toEqual(
      expect.objectContaining({
        model_reasoning_effort: 'high',
        sandbox_workspace_write: {
          writable_roots: ['/repo/.git', '/repo/.worktrees'],
        },
      }),
    );
  });

  it('uses the workspace root from config to compute writable root paths (D8)', () => {
    const result = buildCodexToolInput(
      {
        ...config,
        workspace: { rootAbs: '/workspace/myproject' },
        childSession: { cwdAbs: '/workspace/myproject' },
        codex: { childSession: { cwdAbs: '/workspace/myproject' } },
      },
      story,
      'p',
    );
    expect(result.config).toEqual(
      expect.objectContaining({
        sandbox_workspace_write: {
          writable_roots: ['/workspace/myproject/.git', '/workspace/myproject/.worktrees'],
        },
      }),
    );
  });

  it('keeps writable roots tied to the workspace root when launch cwd is a worktree', () => {
    const result = buildCodexToolInput(config, story, 'p', '/repo/.worktrees/l002-pilot');

    expect(result).toMatchObject({ cwd: '/repo/.worktrees/l002-pilot' });
    expect(result.config).toEqual(
      expect.objectContaining({
        sandbox_workspace_write: {
          writable_roots: ['/repo/.git', '/repo/.worktrees'],
        },
      }),
    );
  });
});
