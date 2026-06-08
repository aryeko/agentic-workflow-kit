import { describe, expect, it } from 'vitest';
import { buildCodexToolInput, buildGenericPrompt } from '../src/drivers/codex-mcp/toolInput';
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
  orchestrator: { driver: 'codex-mcp', maxParallel: 2, stopLaunchingOnBlocked: true, childTimeoutMs: 1_800_000 },
  codex: {
    childSession: {
      cwdAbs: '/repo',
    },
  },
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
    expect(prompt).toContain('- Create/use branch: linkly/l002-{slug} (base: main)');
    expect(prompt).toContain('- Worktree directory: .worktrees under the workspace root.');
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

  it('describes Codex bot review as reaction/comment based rather than native GitHub approval based', () => {
    const prompt = buildGenericPrompt(story, config);

    expect(prompt).toContain('PR policy (from .workflow/config.yaml - follow exactly):');
    expect(prompt).toContain('- Review gate: wait for bot `codex`.');
    expect(prompt).toContain('Codex review signal is reaction/comment based, not a native GitHub approval gate.');
    expect(prompt).toContain('eyes reaction means review started/pending');
    expect(prompt).toContain('thumbs-up reaction means clear/no findings');
    expect(prompt).toContain('PR review comments or PR comments are findings');
    expect(prompt).toContain(
      'Do not require a GitHub PullRequestReview APPROVED or CHANGES_REQUESTED state from Codex.',
    );
    expect(prompt).toContain('Do not mention @codex unless auto review failed to start or a manual retry is needed.');
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
});

describe('buildCodexToolInput', () => {
  it('builds codex MCP input for the child session', () => {
    expect(buildCodexToolInput(config, story)).toMatchObject({
      cwd: '/repo',
      prompt: expect.stringContaining('- ID: L002'),
    });
  });

  it('uses the prompt passed through the story runner boundary', () => {
    expect(buildCodexToolInput(config, story, 'custom prompt')).toMatchObject({
      cwd: '/repo',
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

  it('uses the workspace root from cwdAbs to compute writable root paths (D8)', () => {
    const result = buildCodexToolInput(
      {
        ...config,
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
});
