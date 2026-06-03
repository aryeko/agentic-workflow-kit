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
  git: { strategy: 'worktree', branchPattern: '{track}/{id-lc}-{slug}', baseBranch: 'main', commitOnBase: 'forbid' },
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
    const prompt = buildGenericPrompt(story, config.git);
    expect(prompt).toContain('Implement exactly one workflow tracker story');
    expect(prompt).toContain('- ID: L002');
    expect(prompt).toContain('- Tracker file: docs/tracks/linkly/README.md');
    expect(prompt).toContain('Do not bundle adjacent tracker rows');
    expect(prompt).toContain('The tracker row status is the only completion authority');
  });

  it('includes the resolved forbidden git policy', () => {
    const prompt = buildGenericPrompt(story, config.git);

    expect(prompt).toContain('Git policy');
    expect(prompt).toContain('- Isolation strategy: worktree');
    expect(prompt).toContain('- Create/use branch: linkly/l002-{slug} (base: main)');
    expect(prompt).toContain('Committing directly on `main` is forbidden.');
    expect(prompt).toContain('commit your work there, and confirm the commit exists BEFORE reporting the story done');
    expect(prompt).toContain('An uncommitted tracker edit is not acceptance.');
  });

  it('renders permissive base-commit wording when commitOnBase is allow', () => {
    const prompt = buildGenericPrompt(story, { ...config.git, commitOnBase: 'allow' });

    expect(prompt).toContain('Committing directly on `main` is allowed by this repo policy.');
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
